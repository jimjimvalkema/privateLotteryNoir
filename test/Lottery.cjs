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
      [30n],
      {
        value: 0n,
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
    await lottery.buyTicket(hre.ethers.zeroPadValue("0x01", 32))

    // get chain data
    const purchaseEventFilter = lottery.filters.Purchase() 
    const events = await lottery.queryFilter(purchaseEventFilter, 0,"latest")
    const onchainLeaves = events.map((event)=>event.topics[1])
    const merkleTreeDepth = await lottery.levels()

    // reproduce tree
    const hashFunction = (left, right)=>poseidon2([left, right])
    const tree = new MerkleTree(Number(merkleTreeDepth), onchainLeaves, {hashFunction, zeroElement:hre.ethers.zeroPadValue("0x00", 32)})

    expect(await lottery.getLastRoot()).to.equal(hre.ethers.toBeHex( tree.root));


  })
})