import { nodeResolve } from "@rollup/plugin-node-resolve";
import commonjs from "@rollup/plugin-commonjs";

export default {
  input: "./sdk.js",
  external: (id) => /^https?:\/\//.test(id),
  plugins: [
    nodeResolve({ browser: true }),
    commonjs()
  ],
  output: {
    file: "./dist/sdk.mjs",
    format: "es",
    sourcemap: true
  }
};
