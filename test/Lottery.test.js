import { expect } from "chai";
import hre from "hardhat";
// import {ethers} from "ethers";
const { proxy, PoseidonT3 }  = await import( 'poseidon-solidity')
import {poseidon2} from "poseidon-lite";
import {MerkleTree} from "fixed-merkle-tree";
import {time,loadFixture} from "@nomicfoundation/hardhat-toolbox/network-helpers.js";
import { anyValue } from "@nomicfoundation/hardhat-chai-matchers/withArgs.js";

import {getRevealWinnerCalldata, hashCommitment} from "../scripts/proof.js"


describe("Lottery", function () {
  async function deployPoseidon() {

    const Poseidon = await ethers.getContractFactory(`PoseidonT3`)
    // if (process.env.CI || process.env.DEPLOY) {
    //   const deployInfo = PoseidonT3
    //   if ((await ethers.provider.getCode(deployInfo.proxyAddress)) === '0x') {
    //     await owner.sendTransaction({
    //       to: deployInfo.from,
    //       value: deployInfo.gas,
    //     })
    //     await ethers.provider.sendTransaction(deployInfo.tx)
    //   }
    //   if ((await ethers.provider.getCode(deployInfo.address)) === '0x') {
    //     const tx = await owner.sendTransaction({
    //       to: deployInfo.proxyAddress,
    //       data: deployInfo.data,
    //     })
    //     const receipt = await tx.wait()
    //     console.log(
    //       `Cost of deploying T3 (poseidon-solidity): ${receipt.gasUsed.toString()}`
    //     )
    //   }
    //   return Poseidon.attach(deployInfo.address)
    // }
    const _poseidon = await Poseidon.deploy()
    return _poseidon
  }

  async function deploy() {
    const deployedPoseidonT3 = await deployPoseidon()
    const UltraVerifier = await hre.ethers.deployContract("UltraVerifier")
    const initialJackPot = 420n;
    const lottery = await hre.ethers.deployContract(
      "Lottery",
      //[merkleTreeDepth, verifierAddr, ticketPrice, initial jackpot]
      [30n, UltraVerifier.target, 1n, initialJackPot], //TODO deploy verifier and input its address here
      {
        value: initialJackPot,
        libraries: {
          PoseidonT3: deployedPoseidonT3.target,
        }
      }
    );
    return { lottery }

  }

  it("Should deploy", async function () {
    const { lottery } = await deploy()
    expect(await ethers.provider.getCode(lottery.target)).to.not.equal("0x")
  })

  it("runs happy path", async () => {
    const { lottery } = await deploy()
    const provider = hre.ethers.provider

    // buy a ticket
    const ticketPrice = await lottery.ticketPrice()

    const alicesCommitmentPreimage = {secret:"0x1230", pickId:123n, nullifierPreimage:"0x7890"}
    const alicesCommitment = hashCommitment(alicesCommitmentPreimage)
    const alicesRecipientsWallet = "0x0000000000000000000000000000001234567890"

    const bobsCommitmentPreimage = {secret:"0x102030", pickId:103040n, nullifierPreimage:"0x708090"}
    const bobsCommitment = hashCommitment(bobsCommitmentPreimage)
    const bobsRecipientsWallet = "0x0000000000000000000000102030405060708090"
  
    await lottery.buyTicket(alicesCommitment, { value: ticketPrice} )
    await lottery.buyTicket(bobsCommitment, { value: ticketPrice} )

    // a winning pickId is set. For now without a real random seed or oracle
    await lottery.draw(bobsCommitmentPreimage.pickId)

    // bob is a winner
    // makes zk proof and other inputs
    const calldata = await getRevealWinnerCalldata({...bobsCommitmentPreimage, recipient:bobsRecipientsWallet, lotteryContract: lottery})
    //console.log({calldata, onchainRoot: await lottery.getLastRoot(), winningPickId: await lottery.winningPickId()})
    await lottery.revealWinningCommitment(calldata.root, calldata.nullifier, calldata.pickId, calldata.recipient, calldata.snarkProof)
    expect(await lottery.winners(0)).to.equal(bobsRecipientsWallet) //bobs a winner!

    //lets get that bag
    await lottery.payOutWinners()
    expect(await provider.getBalance(bobsRecipientsWallet)).to.equal(420n + 2n*ticketPrice) // initialJackpot + 2*ticketprice


  })

  it("Match offchain and onchain roots",  async function () {
    const { lottery } = await deploy()

    // buy a ticket
    const ticketPrice = await lottery.ticketPrice()
    await lottery.buyTicket(ethers.zeroPadValue("0x01", 32), { value: ticketPrice} )
    await lottery.buyTicket(ethers.zeroPadValue("0x02", 32), { value: ticketPrice} )

    // get chain data
    const purchaseEventFilter = lottery.filters.Purchase() 
    const events = await lottery.queryFilter(purchaseEventFilter, 0,"latest")
    const onchainLeaves = events.map((event)=>event.topics[1])
    const merkleTreeDepth = await lottery.levels()

    // reproduce tree
    const hashFunction = (left, right)=>poseidon2([left, right])
    const tree = new MerkleTree(Number(merkleTreeDepth), onchainLeaves, {hashFunction, zeroElement:0n})
    //console.log(tree.path(1).pathElements.map((x)=>hre.ethers.zeroPadValue(hre.ethers.toBeHex(x), 32)).toString()) 
    expect(await lottery.getLastRoot()).to.equal(hre.ethers.zeroPadValue(hre.ethers.toBeHex( tree.root), 32));


    //console.log({root: hre.ethers.toBeHex( tree.root)})


  })
})