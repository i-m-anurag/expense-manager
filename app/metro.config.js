const path = require('path');
const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');

const packages = path.resolve(__dirname, '../packages');

/**
 * Metro configuration
 * https://reactnative.dev/docs/metro
 *
 * The parser engine lives in ../packages/parser and is linked with a file:
 * dependency, so Metro has to watch that folder too.
 *
 * @type {import('@react-native/metro-config').MetroConfig}
 */
const config = {
  watchFolders: [packages],
  resolver: {
    nodeModulesPaths: [path.resolve(__dirname, 'node_modules')],
    // The parser's own dev tooling (tsx, yaml, ajv) must never be bundled.
    blockList: [/packages\/parser\/node_modules\/.*/],
  },
};

module.exports = mergeConfig(getDefaultConfig(__dirname), config);
