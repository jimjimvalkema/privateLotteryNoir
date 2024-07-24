import { poseidon2 } from 'poseidon-lite'
import {ethers } from 'ethers'
import * as fs from 'node:fs/promises';

export function getEmptyLevels(treeDepth=32) {
    const levels = [ethers.zeroPadValue("0x00", 32)];
    for (let level = 1; level < treeDepth; level++) {
        const prevLevel =  levels[level-1]
        const nextLevel = ethers.toBeHex(poseidon2([prevLevel, prevLevel]))
        levels.push(nextLevel)
    }
    return levels
}

function formatLevelsSol(levels, ) {
    let solidityStr = ""
    for (const [i, level] of levels.entries()) {
        solidityStr += `else if (i == ${i}) return bytes32(${level});\n`
    }
    return solidityStr
}

async function main() {
    const treeDepth = 32
    const levels = getEmptyLevels(treeDepth)
    await fs.writeFile('./scripts/out/poseidonZeros.json', JSON.stringify(levels, null, 2));
    await fs.writeFile(`./scripts/out/levelsSol.txt`, formatLevelsSol(levels))
}

await main()