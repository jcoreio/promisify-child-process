module.exports = function(api) {
  const plugins = ['@babel/plugin-proposal-object-rest-spread']
  const presets = [
    '@babel/preset-flow',
    ['@babel/preset-env', { targets: { node: 8 } }],
  ]

  if (api.env('coverage')) {
    plugins.push('babel-plugin-istanbul')
  }

  return { plugins, presets }
}
