import { ethers } from "ethers";
import { getRevealWinnerCalldata, hashCommitment } from "../scripts/proof.js"
import lotteryArtifact from "./abi/lotteryArtifacts.json"  assert { type: 'json' };
//TODO couldn't get bytecode from the artefact because the format is wierd.
// this is copied from etherscan at "contract Creation code" at: https://sepolia.etherscan.io/address/0x13e27cb47f4633a1c8bd295f2bade4e222074488#code
import lotteryByteCode from "./abi/bytecode.json" assert {type: 'json'}
import { poseidon1 } from "poseidon-lite";
const lotteryAbi = lotteryArtifact.abi // TODO put only the abi in lotteryArtifacts.json
const FIELD_LIMIT = 21888242871839275222246405745257275088548364400416034343698204186575808495617n //using poseidon so we work with 254 bits instead of 256


window.ethers = ethers
window.lotteryArtifact = lotteryArtifact
window.lotteryAbi = lotteryAbi
window.getRevealWinnerCalldata = getRevealWinnerCalldata
window.hashCommitment = hashCommitment
const provider = new ethers.BrowserProvider(window.ethereum)
const signer = await provider.getSigner();
window.signer = signer
const lotteryContractAddr = getLotteryContractAddr()
await listPurchasedTickets()
await listWinnners()

console.log({lotteryContractAddr})
const lottery = new ethers.Contract(lotteryContractAddr, lotteryAbi, signer)
const gameState = await lottery.gameState()
if (gameState === 2n) {document.querySelector("#itsSoOver").hidden = false}

function getLotteryContractAddr() {

    const lotteryInteractionUi = document.querySelector("#lotteryInteractionUi")
    const address = (new URL(window.location)).searchParams.get("lottery")
    if (ethers.isAddress(address)) {
        lotteryInteractionUi.hidden = false
        return address
    } else {
        lotteryInteractionUi.hidden = true
        if (ethers.isAddress(address) === false && address !== null) {
            console.warn(`${address} is invallid`)
        }
        return false
    }
}

//TODO do actually math or better lib instead of just rerolling :p
function getSafeRandomNumber() {
    let isBigger = true
    let number = 0n
    while (isBigger) {
        number = ethers.toBigInt(crypto.getRandomValues(new Uint8Array( new Array(32))))
        isBigger = number > FIELD_LIMIT
    }
    return number
}

async function deployBtnHandler() {
    //@notice cant be changed since you need to also recompile and redeploy the verifier with the new depth 
    const merkleTreeDepth = 30n
    const verifier = "0xf9f32B424ecC29321f220C27442C8482D66F64e3"
    const PoseidonT3Address = "0x3333333c0a88f9be4fd23ed0536f9b6c427e3b93"

    const ticketPrice = ethers.parseEther(document.querySelector("#ticketPrice").value)
    const initialJackPot = ethers.parseEther(document.querySelector("#initialJackPot").value)
    const contractFactory = new ethers.ContractFactory(lotteryArtifact.abi, lotteryByteCode)
    const contractFactoryWifSigner = contractFactory.connect(signer);
    const deployedLottery = await contractFactoryWifSigner.deploy(merkleTreeDepth, verifier, ticketPrice, initialJackPot,
        {
            value: initialJackPot,
            libraries: {
                PoseidonT3: PoseidonT3Address,
            }
        });
    await deployedLottery.waitForDeployment()

    const newUrl = new URL(window.location)
    newUrl.pathName = window.location.pathname + "hi/"
    newUrl.searchParams.delete("lottery")
    newUrl.searchParams.append("lottery", deployedLottery.target)
    const deploymentUrl = newUrl.toString()
    document.querySelector("#deploymentUrl").innerHTML = deploymentUrl
}
document.querySelector("#deploy").addEventListener("click", async () => await deployBtnHandler())


async function buyTicketHandler() {
    const pickId = ethers.toBeHex(BigInt(document.querySelector("#setPickId").value))
    const secret = ethers.toBeHex(getSafeRandomNumber())
    const nullifierPreimage =  ethers.toBeHex(getSafeRandomNumber())

    const lotteryContractAddr = getLotteryContractAddr()

    console.log({lotteryContractAddr})
    const lottery = new ethers.Contract(lotteryContractAddr, lotteryAbi, signer)
    const commitmentPreimage = { secret: secret, pickId: pickId, nullifierPreimage: nullifierPreimage }
    const commitmentHash = hashCommitment(commitmentPreimage)
    const ticketPriceFromChain = await lottery.ticketPrice()
    console.log({commitmentPreimage})
    const buyTicketTx = await lottery.buyTicket(commitmentHash, { value: ticketPriceFromChain })
    
    //TODO this is unsafe. user might leave the page but still sign the tx after our page is closed
    localStorage.setItem(commitmentHash, JSON.stringify({ticketLotteryAddr: lotteryContractAddr, commitmentPreimage}))
    await buyTicketTx.wait(1)
    await listPurchasedTickets()

}
document.querySelector("#buyTicket").addEventListener("click", ()=>buyTicketHandler())

async function claimWinner(commitmentPreimage) {
    const lotteryContractAddr = getLotteryContractAddr()
    const recipientsWallet = signer.address
    const lottery = new ethers.Contract(lotteryContractAddr, lotteryAbi, signer)
    console.log({ ...commitmentPreimage, recipient: recipientsWallet, lotteryContract: lottery })
    const calldata = await getRevealWinnerCalldata({ ...commitmentPreimage, recipient: recipientsWallet, lotteryContract: lottery })
    console.log({calldata})
    const tx = await lottery.revealWinningCommitment(calldata.root, calldata.nullifier, calldata.pickId, calldata.recipient, calldata.snarkProof)
    console.log(await tx.wait(1))
    await listPurchasedTickets()
    await listWinnners()
}


async function setWinningPickIdBtnHandler() {
    const pickId = BigInt(document.querySelector("#setWinningPickId").value)
    const lotteryContractAddr = getLotteryContractAddr()
    const lottery = new ethers.Contract(lotteryContractAddr, lotteryAbi, signer)
    const tx = await lottery.draw(pickId)
    await tx.wait(1)
    await listPurchasedTickets()
}

document.querySelector("#setWinningPickIdBtn").addEventListener("click", async ()=> await setWinningPickIdBtnHandler())

async function listPurchasedTickets() {
    document.querySelector("#tickets").innerHTML = ""
    const lotteryContractAddr = getLotteryContractAddr()
    const lottery = new ethers.Contract(lotteryContractAddr, lotteryAbi, signer)
    const gameState = await lottery.gameState()
    const winningPickId = await lottery.winningPickId()
    for (let i = 0; i < localStorage.length; i++) {
        const commitment = localStorage.key(i)
        const {ticketLotteryAddr, commitmentPreimage} = JSON.parse(localStorage.getItem(commitment))
        console.log( JSON.parse(localStorage.getItem(commitment)))
        
        console.log(commitment, commitmentPreimage)

        if (ticketLotteryAddr === lotteryContractAddr) {
            const newTicket = document.createElement("li")
            newTicket.innerText = ` ticket ${BigInt(commitmentPreimage.pickId)} `
            console.log({gameState,  winningPickId, pickId:commitmentPreimage.pickId})
            if (gameState === 1n && winningPickId === BigInt(commitmentPreimage.pickId)) {
                const nullifier = ethers.toBeHex(poseidon1([commitmentPreimage.nullifierPreimage]))
                const isAlreadyClaimed = await lottery.nullifiers(nullifier)
                console.log({isAlreadyClaimed, nullifier})
                if(!isAlreadyClaimed) {
                    const claimButton = document.createElement("button")
                    claimButton.id = `claimButton-${BigInt(commitmentPreimage.pickId)}`
                    claimButton.addEventListener("click", async () => await claimWinner(commitmentPreimage))
                    claimButton.textContent = "you won! claim now!!"
                    newTicket.prepend(claimButton)

                } else {
                    newTicket.prepend("already revealed")

                }

            }
            document.querySelector("#tickets").append(newTicket)
        }

        
    }
}

async function payoutWinnersHandler() {
    const lotteryContractAddr = getLotteryContractAddr()
    const lottery = new ethers.Contract(lotteryContractAddr, lotteryAbi, signer)
    const tx = await lottery.payOutWinners()
    await tx.wait(1)
    document.querySelector("#itsSoOver").hidden = false
}
document.querySelector("#payoutWinners").addEventListener("click", async ()=>await payoutWinnersHandler())

async function listWinnners() {
    const lotteryContractAddr = getLotteryContractAddr()
    const lottery = new ethers.Contract(lotteryContractAddr, lotteryAbi, signer)
    let noError = true
    let i = 0
    const winners = [];
    while (noError) {

        try {
            const winner = await lottery.winners(BigInt(i))
            console.log(i, winner)
            winners.push(winner)
            i++
        } catch (error) {
            noError = false; //:(
            
        }
    }
    document.querySelector("#listWinners").innerText = `winners: ${winners.toString()}`
}