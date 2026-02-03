const { defineConfig } = require('eslint/config')
const globals = require('globals')

module.exports = defineConfig([
  ...require('@jcoreio/toolchain/eslintConfig.cjs'),
  {
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.es6,
      },
    },
  },
  {
    files: ['test/**'],
    languageOptions: {
      globals: {
        ...globals.mocha,
      },
    },
  },
])
