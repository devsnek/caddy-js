import { nodeResolve } from '@rollup/plugin-node-resolve';
import { babel } from '@rollup/plugin-babel';

export default {
  input: 'src/index.mjs',
  output: {
    dir: 'output',
    format: 'iife'
  },
  plugins: [nodeResolve(), babel({ babelHelpers: 'bundled' })]
};
