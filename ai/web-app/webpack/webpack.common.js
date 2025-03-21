const path = require("path");
const HTMLWebpackPlugin = require("html-webpack-plugin");
const NodePolyfillPlugin = require("node-polyfill-webpack-plugin");
const CopyPlugin = require("copy-webpack-plugin");
const fs = require('fs-extra');
const appDirectory = fs.realpathSync(process.cwd());
const resolvePath = relativePath => path.resolve(appDirectory, relativePath);

console.clear();

module.exports = {
  entry: resolvePath("src/index.tsx"),
  output: {
    path: resolvePath("public"),
    filename: "static/js/[name].[contenthash:16].js",
    chunkFilename: "static/js/[name].[contenthash:16].js",
    assetModuleFilename: 'static/media/[hash][ext]',
    publicPath: "/",
    globalObject: 'this',
    clean: {
      keep: /customization\//,
    }
  },
  resolve: {
    modules: ['node_modules', resolvePath('node_modules')],
    extensions: [".tsx", ".ts", ".js",".jsx", ".mjs", ".wasm", ".json", ".scss"]
  },
  module: {
    strictExportPresence: true,
    rules: [
      {
        test: /\.(woff|woff2|eot|ttf|otf)$/i,
        type: "asset/resource",
      },
      {
        test: /\.svg$/i,
        type: "asset/inline",
      },
      {
        test: /\.(png|svg|jpe?g|gif|jp2|webp)$/i,
        type: 'asset/resource',
      },
      {
        test: /\.m?js/,
        resolve: {
          fullySpecified: false
        }
      }
    ],
  },
  plugins: [
    new NodePolyfillPlugin(),
    new HTMLWebpackPlugin(
      {
        inject: true,
        title: 'Amorphic AI',
        template: path.resolve("./src/template.html"),
        filename: './index.html',
        favicon: "./src/assets/images/favicon.ico"
      }
    ),
    new CopyPlugin({
      patterns: [
        { from: resolvePath("src/manifest.json"), to: resolvePath("public") },
        { from: resolvePath("src/assets/images/logo192.png"), to: resolvePath("public") }
      ],
    })
  ]
};