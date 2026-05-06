import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import json from '@rollup/plugin-json';

const browserPlugins = [
      resolve({ browser: true , preferBuiltins: false      }),
      commonjs(),
      json()
    ];

const nodePlugins = [
      resolve({ browser: false, preferBuiltins: true }),
      commonjs(),
      json()
    ];

export default [
  // App bootstrap bundle (ESM)
  {
    input: 'src/js/get23_main.js',
    output: {
      file: 'dist/main.mjs',
      format: 'es',
      sourcemap: true
    },
    plugins: browserPlugins
  },
  // All users data module (ESM bundle)
  {
    input: 'src/js/get23_allUsers.js',
    output: {
      file: 'dist/allUsers.bundle.mjs',
      format: 'es',
      sourcemap: true
    },
    plugins: browserPlugins
  },
  // Stats module (ESM bundle)
  {
    input: 'src/js/get23_loadStats.js',
    output: {
      file: 'dist/loadStats.bundle.mjs',
      format: 'es',
      sourcemap: true
    },
    plugins: browserPlugins
  },
  // ESM module
  {
    input: 'sdk.js',
    output: {
      file: 'dist/sdk.mjs',
      format: 'es',
      sourcemap: true
    },
    plugins: browserPlugins
  },
  // Node-safe SDK module
  {
    input: 'cloudNodeEntry.js',
    output: {
      file: 'dist/cloud_sdk.mjs',
      format: 'es',
      intro: 'var self = globalThis;',
      sourcemap: true
    },
    plugins: nodePlugins
  }
];
