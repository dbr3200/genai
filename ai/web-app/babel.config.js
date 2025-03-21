const plugins = [
  "@babel/plugin-transform-react-jsx",
  "@babel/transform-runtime"
];

if (process.env.NODE_ENV === 'production') {
  plugins.push('babel-plugin-typescript-to-proptypes');
}

module.exports = {
  presets: [
    "@babel/preset-env",
    "@babel/preset-typescript",
    "@babel/preset-react"
  ],
  plugins,
};