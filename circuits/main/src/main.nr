use dep::std::hash::poseidon;

global TREE_DEPTH = 32;

fn hash_commitment(secret: Field, pickId: Field, nullifier_preimage: Field) -> Field {
    poseidon::bn254::hash_3([secret, pickId, nullifier_preimage])
}

//https://github.com/noir-lang/noir/blob/master/noir_stdlib/src/merkle.nr
pub fn compute_merkle_root<N>(leaf: Field, index: Field, hash_path: [Field; N]) -> Field {
    let n = hash_path.len();
    let index_bits = index.to_le_bits(n as u32);
    let mut current = leaf;
    for i in 0..n {
        let path_bit = index_bits[i] as bool;
        let (hash_left, hash_right) = if path_bit {
            (hash_path[i], current)
        } else {
            (current, hash_path[i])
        };
        current = poseidon::bn254::hash_2([hash_left, hash_right]);
    }
    current
}

fn main(
    root: pub Field,
    nullifier: pub Field,
    pickId: pub Field,
    recipient:pub Field,

    secret: Field,
    nullifier_preimage: Field,
    hash_path: [Field; TREE_DEPTH],
    commitment_index: Field
) {
    assert(recipient != 0x0, "recipient cant be zero");

    let computed_nullifier = poseidon::bn254::hash_1([nullifier_preimage]);
    assert(nullifier == computed_nullifier, "nullifier preimage doesnt match");

    let commitment = poseidon::bn254::hash_3([secret, pickId, nullifier_preimage]);
    let computed_root = compute_merkle_root(commitment, commitment_index, hash_path);
    assert(root == computed_root, "computed commitment root doesn't match provided root");
}

// #[test]
// fn test_main() {
//     main(1, 2);

//     // Uncomment to make test fail
//     // main(1, 1);
// }
