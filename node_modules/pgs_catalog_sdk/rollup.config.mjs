import resolve from "@rollup/plugin-node-resolve";
import commonjs from "@rollup/plugin-commonjs";

const browserPlugins = [
    resolve({
        browser: true,
        preferBuiltins: false,
    }),
    commonjs(),
];

const nodePlugins = [
    resolve({
        browser: false,
        preferBuiltins: true,
    }),
    commonjs(),
];


export default [
    {
        input: "src/js/getPGS_loadScores.js",
        output: {
            file: "dist/loadScores.bundle.mjs",
            format: "es",
            sourcemap: true,
        },
        plugins: browserPlugins,
    },
    {
        input: "src/js/getPGS_loadTraits.js",
        output: {
            file: "dist/loadTraits.bundle.mjs",
            format: "es",
            sourcemap: true,
        },
        plugins: browserPlugins,
    },
    {
        input: "src/js/getPGS_main.js",
        output: {
            file: "dist/main.mjs",
            format: "es",
            sourcemap: true,
        },
        plugins: browserPlugins,
    },
    {
        input: "sdk.js",
        output: {
            file: "dist/sdk.mjs",
            format: "es",
            sourcemap: true,
        },
        plugins: browserPlugins,
    },
    {
        input: "cloudNodeEntry.js",
        output: {
            file: "dist/cloud_sdk.mjs",
            format: "es",
            sourcemap: true,
            intro: "var self = globalThis;", // Shim for jszip's unguarded self reference
        },
        plugins: nodePlugins,
    },
];