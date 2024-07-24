const { buildModule } = require("@nomicfoundation/hardhat-ignition/modules");

module.exports = buildModule("LockModule", (m) => {

  const Lottery = m.contract("Lottery", [], {
    value: 0n,
  });

  return { Lottery };
});
