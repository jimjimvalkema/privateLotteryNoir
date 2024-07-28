import { BarretenbergBackend, BarretenbergVerifier as Verifier } from '@noir-lang/backend_barretenberg';
import { Noir } from '@noir-lang/noir_js';
import circuit from "../circuits/main/target/main.json"  assert { type: 'json' };
import { poseidon1, poseidon2, poseidon3 } from 'poseidon-lite';
import { ethers } from 'ethers';
import { MerkleTree } from 'fixed-merkle-tree';


export function hashCommitment({ secret, pickId, nullifierPreimage }) {
    return ethers.zeroPadValue(ethers.toBeHex(poseidon3([secret, pickId, nullifierPreimage])),32)
}

export function hashNullifier(nullifierPreimage) {
    return ethers.zeroPadValue(ethers.toBeHex(ethers.toBeHex(poseidon1([nullifierPreimage]))),32)
}

export async function getRevealWinnerCalldata({pickId, recipient, secret, nullifierPreimage, lotteryContract}) {
    const nullifier = hashNullifier(nullifierPreimage)
    const {proof, root} = await getSnarkProof({nullifier, pickId, recipient, secret, nullifierPreimage, lotteryContract})
    return { root, nullifier, pickId: ethers.zeroPadValue(pickId, 32), recipient, snarkProof: proof }
}

async function getSnarkProof({nullifier, pickId, recipient, secret, nullifierPreimage, lotteryContract}) {
    const backend = new BarretenbergBackend(circuit);
    const noir = new Noir(circuit, backend);

    const commitment = hashCommitment({ secret, pickId, nullifierPreimage })
    const { hashPath, commitmentIndex, root } = await getMerklePoof({ commitment, lotteryContract })
    console.log({commitmentIndex})

    const proofInputs = {
        // private inputs
        secret: secret,
        nullifier_preimage: nullifierPreimage,
        hash_path: hashPath,
        commitment_index: commitmentIndex,

        //public inputs
        root: root,
        nullifier: nullifier,
        pick_id: pickId,
        recipient: recipient,
    }

    const proof = await noir.generateProof(proofInputs)

    //TODO remove this is debug
    // const isVerified = await noir.verifyProof(proof)
    // console.log({
    //     inputs: proofInputs,
    //     proof,
    //     isVerified
    // })

    return {proof: ethers.hexlify(proof.proof), root}
}

async function getMerklePoof({ commitment, lotteryContract }) {
    // get chain data
    const purchaseEventFilter = lotteryContract.filters.Purchase()
    const events = await lotteryContract.queryFilter(purchaseEventFilter, 0, "latest")
    const onchainLeaves = events.map((event) => event.topics[1])
    const merkleTreeDepth = await lotteryContract.levels()

    // reproduce tree
    const hashFunction = (left, right) => poseidon2([left, right])
    const tree = new MerkleTree(Number(merkleTreeDepth), onchainLeaves, { hashFunction, zeroElement: 0n })

    // get merkple proof data
    const commitmentIndex = onchainLeaves.findIndex((leaf)=>leaf===commitment)
    const unFormattedhashPath = tree.path(commitmentIndex).pathElements 
    const hashPath = unFormattedhashPath.map((hash)=>ethers.zeroPadValue(ethers.toBeHex(hash), 32)) // tree.path() returns a BigInt so we convert to ethers.BytesLike string
    const root = ethers.zeroPadValue(ethers.toBeHex(tree.root), 32)

    return { hashPath, commitmentIndex, root }

}
