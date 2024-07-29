# privateLotteryNoir


### deploy
```shell
npx hardhat node
```

```shell
npx hardhat run scripts/deploy.js --network localhost
```


### website

run webiste
```shell
cp ignition/deployments/chain-11155111/artifacts/LotteryModule#Lottery.json website/abi/lotteryArtifacts.json #cant use file directly since it has a hashtag in the name so we copy and rename
yarn vite website
```

### build and deploy to ipfs
// TODO noir runs on only one core
```shell
cp ignition/deployments/chain-11155111/artifacts/LotteryModule#Lottery.json website/abi/lotteryArtifacts.json #cant use file directly since it has a hashtag in the name so we copy and rename
yarn vite build website
#TODO ipfs
```
