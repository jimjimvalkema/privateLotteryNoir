import LotteryModule from "../ignition/modules/Lottery.cjs"
import hre from "hardhat"
import { ethers } from "ethers";
import poseidonSolidity from 'poseidon-solidity'
import { poseidon2 } from "poseidon-lite";

//TODO use hardhat vars
const merkleTreeDepth = 30n;
const ticketPrice = 1n;
const initialJackPot = 420n;

async function deployPoseidon() {

    //https://github.com/chancehudson/poseidon-solidity/tree/main?tab=readme-ov-file#deploy
    //readme is wrong using ethers.provider instead of hre.ethers.provider
    const provider = hre.ethers.provider

    // common js imports struggles
    const proxy = poseidonSolidity.proxy
    const PoseidonT3 = poseidonSolidity.PoseidonT3

    const [sender] = await hre.ethers.getSigners()
    // First check if the proxy exists
    if (await provider.getCode(proxy.address) === '0x') {
        // fund the keyless account
        await sender.sendTransaction({
            to: proxy.from,
            value: proxy.gas,
        })

        //readme is wrong using provider.sendTransaction
        // then send the presigned transaction deploying the proxy
        await provider.broadcastTransaction(proxy.tx)
    } else {
        console.log(`Proxy for poseidon was already deployed at: ${proxy.address}`)
    }

    // Then deploy the hasher, if needed
    if (await provider.getCode(PoseidonT3.address) === '0x') {
        //readme is wrong having typo here: send.sendTransaction instead of sender
        await sender.sendTransaction({
            to: proxy.address,
            data: PoseidonT3.data
        })
    } else {
        console.log(`PoseidonT3 was already deployed at: ${PoseidonT3.address}`)
    }
    console.log(`PoseidonT3 deployed to: ${PoseidonT3.address}`)
    return PoseidonT3.address
}


async function main() {
    const PoseidonT3Address = await deployPoseidon()
    const { Lottery, UltraVerifier } = await hre.ignition.deploy(LotteryModule, {
        parameters: {
            LotteryModule: {
                merkleTreeDepth,
                ticketPrice,
                initialJackPot,
                PoseidonT3Address
            }
        },
    });

    //verify (source: https://hardhat.org/hardhat-runner/plugins/nomiclabs-hardhat-etherscan#using-programmatically)
    //TODO check that it actually verifies since the contract is already deployed on sepolia
    const PoseidonT3Verification =  hre.run("verify:verify", {
        address: PoseidonT3Address,
        //contract: "contracts/MyContract.sol:MyContract", //Filename.sol:ClassName
        constructorArguments: [],
        value: 0n
    });

    const UltraVerifierVerification =  hre.run("verify:verify", {
        address: UltraVerifier.target,
        //contract: "contracts/MyContract.sol:MyContract", //Filename.sol:ClassName
        constructorArguments: [],
        value: 0n
    });

    const LotteryVerification =  hre.run("verify:verify", {
        address: Lottery.target,
        //contract: "contracts/MyContract.sol:MyContract", //Filename.sol:ClassName
        constructorArguments: [merkleTreeDepth,UltraVerifier.target,ticketPrice,initialJackPot],
        value: initialJackPot,
        libraries: {
          PoseidonT3: PoseidonT3Address,
        }
    });

    await Promise.all([PoseidonT3Verification, UltraVerifierVerification, LotteryVerification])


    

    // quick sanity check
    console.log(await Lottery.jackPot())
    const preImage = [ethers.zeroPadValue("0x0123", 32), ethers.zeroPadValue("0x0456", 32)]
    console.log(await Lottery.hashLeftRight(...preImage))
    console.log(ethers.toBeHex(poseidon2(preImage)))

}

await main().catch(console.error);