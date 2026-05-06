import { nodeResolve } from "@rollup/plugin-node-resolve";
import commonjs from "@rollup/plugin-commonjs";

const basePlugins = [
  nodeResolve({ browser: true }),
  commonjs()
];

const baseExternal = (id) => /^https?:\/\//.test(id);

export default [
  {
    input: "./sdk.js",
    external: baseExternal,
    plugins: basePlugins,
    output: {
      file: "./dist/sdk.mjs",
      format: "es",
      sourcemap: true
    }
  },
  {
    input: "./src/app/index.js",
    external: baseExternal,
    plugins: basePlugins,
    output: {
      dir: "./dist",
      entryFileNames: "app.mjs",
      chunkFileNames: "chunks/[name]-[hash].mjs",
      format: "es",
      sourcemap: true
    }
  },
  // Node-safe SDK build for Cloud Run
  {
    input: "./src/sdk/cloudNodeEntry.js",
    external: baseExternal,
    plugins: basePlugins,
    output: {
      file: "./dist/cloud_sdk.mjs",
      format: "es",
      sourcemap: true
    }
  }
];
