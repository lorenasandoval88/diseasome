export default {
  input: "./sdk.js",
  external: (id) => id === "localforage" || /^https?:\/\//.test(id),
  output: {
    file: "./dist/sdk.mjs",
    format: "es",
    sourcemap: true
  }
};
