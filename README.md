# privateLotteryNoir


## deploy
### deploy local
```shell
npx hardhat node
```

```shell
npx hardhat run scripts/deploy.js --network localhost;
```


### deploy sepolia
```shell
npx hardhat run scripts/deploy.js --network sepolia;
```


## website

<!-- run webiste
```shell
cp ignition/deployments/chain-11155111/artifacts/LotteryModule#Lottery.json website/abi/lotteryArtifacts.json #cant use file directly since it has a hashtag in the name so we copy and rename
yarn vite website
``` -->

### build ui
// TODO noir runs on only one core
```shell
cp ignition/deployments/chain-11155111/artifacts/LotteryModule#Lottery.json website/abi/lotteryArtifacts.json #cant use file directly since it has a hashtag in the name so we copy and rename;
yarn vite build website;
```

### run ui local
```shell
python3 -m http.server -d website/dist/
```

<!-- TODO install ipfs -->
### add to ipfs
```shell
ipfs add -r website/dist;
```

### ui:
https://bafybeifgqkhu6guc54nl36j2rvjrmlt5fle7fldoxq7ts7rlu7chuxz47u.ipfs.dweb.link/