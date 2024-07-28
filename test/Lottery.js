// const { expect } = require("chai");
// const hre = require("hardhat");
// const { proxy, PoseidonT3 } = require('poseidon-solidity')
// const {poseidon2} = require("poseidon-lite");
// const {MerkleTree} = require( "fixed-merkle-tree");
// const {time,loadFixture} = require("@nomicfoundation/hardhat-toolbox/network-helpers");
// const { anyValue } = require("@nomicfoundation/hardhat-chai-matchers/withArgs");


// const {getRevealWinnerCalldata, hashCommitment} = require("../scripts/proof.js")
import { expect } from "chai";
import hre from "hardhat";
const { proxy, PoseidonT3 }  = await import( 'poseidon-solidity')
import {poseidon2} from "poseidon-lite";
import {MerkleTree} from "fixed-merkle-tree";
import {time,loadFixture} from "@nomicfoundation/hardhat-toolbox/network-helpers.js";
import { anyValue } from "@nomicfoundation/hardhat-chai-matchers/withArgs.js";

import {getRevealWinnerCalldata, hashCommitment} from "../scripts/proof.js"

// // i fucking hate js
// let getRevealWinnerCalldata
// let hashCommitment
// import("../scripts/proof.js").then((module) => {
//   getRevealWinnerCalldata = module.getRevealWinnerCalldata;
//   hashCommitment =  module.hashCommitment;
// })

// console.log({getRevealWinnerCalldata})



describe("Lottery", function () {
  async function deployPoseidon() {

    const Poseidon = await ethers.getContractFactory(`PoseidonT3`)
    if (process.env.CI || process.env.DEPLOY) {
      const deployInfo = PoseidonT3
      if ((await ethers.provider.getCode(deployInfo.proxyAddress)) === '0x') {
        await owner.sendTransaction({
          to: deployInfo.from,
          value: deployInfo.gas,
        })
        await ethers.provider.sendTransaction(deployInfo.tx)
      }
      if ((await ethers.provider.getCode(deployInfo.address)) === '0x') {
        const tx = await owner.sendTransaction({
          to: deployInfo.proxyAddress,
          data: deployInfo.data,
        })
        const receipt = await tx.wait()
        console.log(
          `Cost of deploying T3 (poseidon-solidity): ${receipt.gasUsed.toString()}`
        )
      }
      return Poseidon.attach(deployInfo.address)
    }
    const _poseidon = await Poseidon.deploy()
    return _poseidon
  }

  async function deploy() {
    const deployedPoseidonT3 = await deployPoseidon()
    const initialJackPot = 420n;
    const lottery = await hre.ethers.deployContract(
      "Lottery",
      //[merkleTreeDepth, verifierAddr, ticketPrice, initial jackpot]
      [30n, "0x0000000000000000000000000000000000000123", 1n, initialJackPot], //TODO deploy verifier and input its address here
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

  it("Match offchain and onchain roots",  async function () {
    const { lottery } = await deploy()

    // buy a ticket
    const ticketPrice = await lottery.ticketPrice()

    const alicesCommitmentPreimage = {secret:"0x1230", pickId:"0x4560", nullifierPreimage:"0x7890"}
    const alicesCommitment = hashCommitment(alicesCommitmentPreimage)
    const alicesRecipientsWallet = "0x0000000000000000000000000000001234567890"

    const bobsCommitmentPreimage = {secret:"0x102030", pickId:"0x405060", nullifierPreimage:"0x708090"}
    const bobsCommitment = hashCommitment(bobsCommitmentPreimage)
    const bobsRecipientsWallet = "0x0000000000000000000000102030405060708090"

    await lottery.buyTicket(alicesCommitment, { value: ticketPrice} )
    await lottery.buyTicket(bobsCommitment, { value: ticketPrice} )

    // get chain data
    const purchaseEventFilter = lottery.filters.Purchase() 
    const events = await lottery.queryFilter(purchaseEventFilter, 0,"latest")
    const onchainLeaves = events.map((event)=>event.topics[1])
    const merkleTreeDepth = await lottery.levels()

    // reproduce tree
    const hashFunction = (left, right)=>poseidon2([left, right])
    const tree = new MerkleTree(Number(merkleTreeDepth), onchainLeaves, {hashFunction, zeroElement:0n})
    //console.log(tree.path(1).pathElements.map((x)=>hre.ethers.zeroPadValue(hre.ethers.toBeHex(x), 32)).toString()) 
    expect(await lottery.getLastRoot()).to.equal(hre.ethers.toBeHex( tree.root));


    const calldata = await getRevealWinnerCalldata({...bobsCommitmentPreimage, recipient:bobsRecipientsWallet, lotteryContract: lottery})
    
    console.log({root: hre.ethers.toBeHex( tree.root)})
    console.log({calldata})

  })
})