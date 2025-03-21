const config = require("./webpack.common");
const path = require("path");
const CssMinimizerPlugin = require("css-minimizer-webpack-plugin");
const MiniCssExtractPlugin = require("mini-css-extract-plugin");
const ProgressBarPlugin = require("progress-bar-webpack-plugin");
const chalk = require("chalk");

const fs = require('fs-extra');
const appDirectory = fs.realpathSync(process.cwd());
const resolvePath = relativePath => path.resolve(appDirectory, relativePath);

console.log(chalk.yellow('Creating production build'));

module.exports = {
  ...config,
  mode: "production",
  optimization: {
    minimize: true,
    minimizer: [`...`, new CssMinimizerPlugin()]
  },
  module: {
    rules: [
      ...config.module.rules,
      {
        test: /\.(ts|tsx|js|jsx)$/,
        include: resolvePath('src'),
        loader: "swc-loader",
        options: {
          sourceMap: false
        },
        exclude: /node_modules/
      },
      {
        test: /\.css$/i,
        use: [
          MiniCssExtractPlugin.loader,
          {
            loader: "css-loader",
            options: {
              sourceMap: false,
              importLoaders: 1,
            },
          },
          {
            loader: "postcss-loader",
            options: {
              sourceMap: false,
            },
          },
        ],
      },
      {
        test: /\.module\.scss$/,
        use: [
          MiniCssExtractPlugin.loader,
          {
            loader: 'css-loader',
            options: {
              modules: {
                localIdentName: "[hash:base64:5]",
              },
              sourceMap: false,
              importLoaders: 2
            }
          },
          {
            loader: 'sass-loader',
            options: {
              sourceMap: false
            }
          },
          {
            loader: "postcss-loader",
            options: {
              sourceMap: false,
            },
          },
        ]
      }
    ],
  },
  plugins: [
    ...config.plugins,
    new ProgressBarPlugin({
      format: `${chalk.hex('#0676E1').bold(':msg')} - ${chalk.green.bold(':percent')} (:elapsed s)`,
    }),
    new MiniCssExtractPlugin({
      filename: "static/css/[name].min.css",
      chunkFilename: "static/css/[id].min.css",
    })
  ]
};

