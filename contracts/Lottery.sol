// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.24;
import "@openzeppelin/contracts/access/Ownable.sol";
import "./MerkleTreeWithHistory.sol";
// Uncomment this line to use console.log
// import "hardhat/console.sol";


event Purchase(bytes32 indexed commitment, uint32 leafIndex, uint256 timestamp);


contract Lottery is MerkleTreeWithHistory, Ownable  {
    mapping (bytes32 => bool) ticketCommitment;

    constructor(
        uint32 _merkleTreeHeight // defines max amount deposits = 2^_merkleTreeHeight
    ) MerkleTreeWithHistory(_merkleTreeHeight) Ownable(msg.sender) payable {
    }

    function buyTicket(bytes32 _ticketCommitment) public payable {
        require(!ticketCommitment[_ticketCommitment], "A ticket with this commitment was already bought");
        
        uint32 insertedIndex = _insert(_ticketCommitment); // inserts into merkle tree
        ticketCommitment[_ticketCommitment] = true;
        
        // TODO get money
        
        // needed to reconstruct the merkle tree client side 
        // since the tree inst in the contract for its entirety 
        emit Purchase(_ticketCommitment, insertedIndex, block.timestamp); 
    }

    function draw(uint256 winningPickId) public onlyOwner {
    }

    function revealWinningCommitment(bytes32 commitment) public {
    }

    function payOutWinners() public {
    }
}
