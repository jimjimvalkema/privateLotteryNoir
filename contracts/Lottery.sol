// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;
import "@openzeppelin/contracts/access/Ownable.sol";
import "./MerkleTreeWithHistory.sol";
// Uncomment this line to use console.log
// import "hardhat/console.sol";
import "hardhat/console.sol";


event Purchase(bytes32 indexed commitment, uint32 leafIndex, uint256 timestamp);

interface IVerifier {
    function verify(
        bytes calldata _proof,
        bytes32[] calldata _publicInputs
    ) external view returns (bool);
}


/// @notice Current state of the lootery
enum GameState {
    Purchase,
    /// @notice period for winners to proof they won
    RevealWinners,
    /// @notice
    GameOver
}


//TODO future version should: handle refund if noone wins
contract Lottery is MerkleTreeWithHistory, Ownable  {
    mapping (bytes32 => bool) ticketCommitments; 
    mapping (bytes32 => bool) nullifiers; // should maybe be public?
    address public verifier;

    uint256 public winningPickId;
    uint256 public ticketPrice;
    uint256 public jackPot;
    GameState public gameState = GameState.Purchase;

    address[] public winners;


    
    constructor(
        uint32 _merkleTreeHeight, // defines max amount deposits = 2^_merkleTreeHeight
        address _verifier,
        uint256 _ticketPrice,
        uint256 _initialJackPot // can prob do without this param 
    ) MerkleTreeWithHistory(_merkleTreeHeight) Ownable(msg.sender) payable {
        require(_initialJackPot == msg.value, "amount of eth send doesnt match the initial jack pot send");
        verifier = _verifier;
        jackPot = _initialJackPot;
        ticketPrice = _ticketPrice;

    }

    function buyTicket(bytes32 _ticketCommitment) public payable {
        require(gameState == GameState.Purchase, "lottery is no longer allowing purchases");
        require(!ticketCommitments[_ticketCommitment], "A ticket with this commitment was already bought");
        require(msg.value == ticketPrice, "amount of eth send doesnt match the ticket price");
        
        uint32 insertedIndex = _insert(_ticketCommitment); // inserts into merkle tree
        ticketCommitments[_ticketCommitment] = true;
        jackPot += ticketPrice;
        
        // @notice needed to reconstruct the merkle tree client side 
        // since the tree inst in the contract in its entirety 
        emit Purchase(_ticketCommitment, insertedIndex, block.timestamp); 
    }

    function draw(uint256 _winningPickId) public onlyOwner {
        // TODO future version should: force admin to commit to waiting period before changing game state
        require(gameState == GameState.Purchase, "winning Pick can only be set during the purchase phase");
        winningPickId = _winningPickId;
        gameState = GameState.RevealWinners;
    }

    function _formatPublicInputs(bytes32 _root, bytes32 _nullifier, uint256 _pickId, address _recipient) private pure returns(bytes32[] memory) {
        bytes32[] memory publicInputs = new bytes32[](4);
        
        publicInputs[0] = _root;
        publicInputs[1] = _nullifier;
        publicInputs[2] = bytes32(_pickId);
        publicInputs[3] = bytes32(uint256(uint160(bytes20(_recipient)))); // whacky solidity way to left pad zeros

        return publicInputs;
    }
    // TODO future version should: allow the user to reveal before GameState.RevealWinners so they know for sure that they get the payout if they win
    // there should be a ofchain 'mempool' with the reveal proofs of user or perhaps onchain as calldata.
    // relayers can get a small cut of the prize. calc with block.basefee TODO figure out how to calc payout or do via prepaid
    function revealWinningCommitment(bytes32 _root, bytes32 _nullifier, uint256 _pickId, address _recipient, bytes calldata _snarkProof) public {
        require(gameState == GameState.RevealWinners , "The lottery isnt in the reveal winners state");
        require(_pickId == winningPickId, "ur not a winner silly!");

        require(isKnownRoot(_root), "root is invallid or too old");
        require(nullifiers[_nullifier] == false, "this ticket is already revealed and is awaiting payout");
        bytes32[] memory publicInputs = _formatPublicInputs(_root,  _nullifier,  _pickId,  _recipient);

        require(IVerifier(verifier).verify(_snarkProof, publicInputs), "snarkproof invalid");
        winners.push(_recipient);

    }

    // TODO future version should: split into endRevealWinnersPeriod, payOutWinners(bytes32 winners), endGame()
    // so payOutWinners doesnt loop over a array that could be too large.
    function payOutWinners() public  onlyOwner{
        // TODO future version should: force admin to commit to waiting period before changing game state
        require(gameState == GameState.RevealWinners, "payout can only happen to end the reveal winner phase");
        gameState = GameState.GameOver;

        uint256 amountWinners = winners.length;
        uint256 prizeSharePerWinner = jackPot / amountWinners;
        for (uint256 i = 0; i < amountWinners; i++) {
            payable(winners[i]).transfer(prizeSharePerWinner);
        }

    }
}
