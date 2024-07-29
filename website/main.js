import { ethers } from "ethers";
import {getRevealWinnerCalldata, hashCommitment} from "../scripts/proof.js"
import lotteryArtifact from "./abi/lotteryArtifacts.json"  assert { type: 'json' }; 
const lotteryAbi = lotteryArtifact.abi // TODO put only the abi in lotteryArtifacts.json

window.ethers = ethers
window.lotteryAbi = lotteryAbi
window.getRevealWinnerCalldata = getRevealWinnerCalldata
window.hashCommitment = hashCommitment

const bobsCommitmentPreimage = {secret:"0x102030", pickId:103040n, nullifierPreimage:"0x708090"}
const bobsCommitment = hashCommitment(bobsCommitmentPreimage)
const provider =  new ethers.BrowserProvider(window.ethereum)
const signer = await provider.getSigner();
const lotteryContractAddr = "0x80482D6e0484114D42F5EDd63bB34cb797897345"
const lottery = new ethers.Contract(lotteryContractAddr,lotteryAbi,signer)
const bobsRecipientsWallet = "0x0000000000000000000000102030405060708090"

const ticketPrice = await lottery.ticketPrice()
await getRevealWinnerCalldata({...bobsCommitmentPreimage, recipient:bobsRecipientsWallet, lotteryContract: lottery})

console.log("hi")
console.log(ethers)