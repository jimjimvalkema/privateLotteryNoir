const { expect } = require("chai");
const hre = require("hardhat");
const { proxy, PoseidonT3 } = require('poseidon-solidity')
const {poseidon2} = require("poseidon-lite");
const {MerkleTree} = require( "fixed-merkle-tree");

const {
  time,
  loadFixture,
} = require("@nomicfoundation/hardhat-toolbox/network-helpers");
const { anyValue } = require("@nomicfoundation/hardhat-chai-matchers/withArgs");


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
    const lottery = await hre.ethers.deployContract(
      "Lottery",
      //[merkleTreeDepth, verifierAddr, 1n, 420n]
      [30n, "0x0000000000000000000000000000000000000123", 1n, 420n], //TODO deploy verifier and inputs its address here
      {
        value: 420n,
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
    console.log({ticketPrice})
    await lottery.buyTicket(hre.ethers.zeroPadValue("0x0123", 32), { value: ticketPrice} )
    await lottery.buyTicket(hre.ethers.zeroPadValue("0x0e5ba52f96a24b7187ecebb3d59cc6cfcf2ae45a79f054a71039bbcc182304e3", 32), { value: ticketPrice} )

    // get chain data
    const purchaseEventFilter = lottery.filters.Purchase() 
    const events = await lottery.queryFilter(purchaseEventFilter, 0,"latest")
    const onchainLeaves = events.map((event)=>event.topics[1])
    const merkleTreeDepth = await lottery.levels()

    // reproduce tree
    const hashFunction = (left, right)=>poseidon2([left, right])
    const tree = new MerkleTree(Number(merkleTreeDepth), onchainLeaves, {hashFunction, zeroElement:0n})
    console.log(tree.path(1).pathElements.map((x)=>hre.ethers.zeroPadValue(hre.ethers.toBeHex(x), 32)).toString()) 
    console.log({root: hre.ethers.toBeHex( tree.root)})

    expect(await lottery.getLastRoot()).to.equal(hre.ethers.toBeHex( tree.root));


  })
})