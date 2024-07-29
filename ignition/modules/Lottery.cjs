// cjs because harhat keeps complaining
const { buildModule } = require("@nomicfoundation/hardhat-ignition/modules")



module.exports = buildModule("LotteryModule", (m) => {
  const merkleTreeDepth =  m.getParameter("merkleTreeDepth");
  const ticketPrice = m.getParameter("ticketPrice");
  const initialJackPot = m.getParameter("initialJackPot");
  const PoseidonT3Address = m.getParameter("PoseidonT3Address");

  const UltraVerifier = m.contract("UltraVerifier", 
    [], 
    {value: 0n,}
  );

  const _poseidonT3 = m.contractAt("PoseidonT3",PoseidonT3Address)
  const Lottery = m.contract("Lottery", 
    //[merkleTreeDepth, verifierAddr, ticketPrice, initial jackpot]
    [merkleTreeDepth,UltraVerifier,ticketPrice,initialJackPot], 
    {
      value: initialJackPot,
      libraries: {
        PoseidonT3: _poseidonT3,
      }
    }
  );

  return { Lottery };
});

// const LotteryModule = require("../ignition/modules/Lottery.cjs");
// const Lottery = await hre.ignition.deploy(LotteryModule,{
//   parameters: { LockModule: {merkleTreeDepth, ticketPrice, initialJackPot}  },
// });
