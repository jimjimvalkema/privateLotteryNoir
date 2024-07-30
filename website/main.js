import { ethers } from "ethers";
import { getRevealWinnerCalldata, hashCommitment } from "../scripts/proof.js"
import lotteryArtifact from "./abi/lotteryArtifacts.json"  assert { type: 'json' };
//TODO couldn't get bytecode from the artefact because the format is wierd.
// this is copied from etherscan at "contract Creation code" at: https://sepolia.etherscan.io/address/0x80482d6e0484114d42f5edd63bb34cb797897345#code
import lotteryByteCode from "./abi/bytecode.json" assert {type: 'json'}

//@notice cant be changed since you need to also recompile and redeploy the verifier with the new depth 
const merkleTreeDepth = 30n
const verifier = "0x140302A7C2068ba86C073eD183fCA00e7dbE999B"


const PoseidonT3Address = "0x3333333c0a88f9be4fd23ed0536f9b6c427e3b93"
const lotteryAbi = lotteryArtifact.abi // TODO put only the abi in lotteryArtifacts.json
const provider = new ethers.BrowserProvider(window.ethereum)
const signer = await provider.getSigner();
window.signer = signer
window.ethers = ethers
window.lotteryArtifact = lotteryArtifact
window.lotteryAbi = lotteryAbi
window.getRevealWinnerCalldata = getRevealWinnerCalldata
window.hashCommitment = hashCommitment



const contractFactory = new ethers.ContractFactory(lotteryArtifact.abi, lotteryByteCode)
const contractFactoryWifSigner = contractFactory.connect(signer);



const ticketPrice = 1n;
const initialJackPot = 420n
const deployedLottery = await contractFactoryWifSigner.deploy(merkleTreeDepth, verifier, ticketPrice, initialJackPot,
    {
        value: initialJackPot,
        libraries: {
            PoseidonT3: PoseidonT3Address,
        }
    });
await deployedLottery.waitForDeployment()

const bobsCommitmentPreimage = { secret: "0x102030", pickId: 103040n, nullifierPreimage: "0x708090" }
const bobsCommitment = hashCommitment(bobsCommitmentPreimage)

const lotteryContractAddr = deployedLottery.target
const lottery = new ethers.Contract(lotteryContractAddr, lotteryAbi, signer)
const bobsRecipientsWallet = "0x0000000000000000000000102030405060708090"


const ticketPriceFromChain = await lottery.ticketPrice()
const buyTicketTx = await lottery.buyTicket(bobsCommitment, {value:ticketPrice})
await buyTicketTx.wait(3)

const calldata = await getRevealWinnerCalldata({ ...bobsCommitmentPreimage, recipient: bobsRecipientsWallet, lotteryContract: lottery })

console.log({ticketPriceFromChain,calldata })
console.log(ethers)