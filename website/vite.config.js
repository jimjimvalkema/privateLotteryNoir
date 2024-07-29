import { defineConfig } from 'vite'
import { NodeGlobalsPolyfillPlugin } from '@esbuild-plugins/node-globals-polyfill'
import copy from "rollup-plugin-copy";



export default defineConfig({
    build: {
        target: "es2023"
    },
    esbuild: {
        target: "es2023",
    
    },
    optimizeDeps: {
        esbuildOptions: {
            target: "es2023",
            define: {
                global: 'globalThis'
            },
            plugins: [
                // NodeGlobalsPolyfillPlugin({
                //     buffer: true
                // }),
                // copy({
                //     targets: [
                //         { src: "node_modules/**/*.wasm", dest: "node_modules/.vite/dist" },
                //     ],
                //     copySync: true,
                //     hook: "buildStart",
                // }),
            ]
        }
    }
})
