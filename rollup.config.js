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
      file: "./dist/app.mjs",
      format: "es",
      sourcemap: true
    }
  }
];
