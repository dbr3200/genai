const config = require("./webpack.common");
const path = require("path");
const ReactRefreshWebpackPlugin = require("@pmmmwh/react-refresh-webpack-plugin");
const chalk = require("chalk");
const fs = require("fs-extra");
const { choosePort } = require("react-dev-utils/WebpackDevServerUtils");
const openBrowser = require("react-dev-utils/openBrowser");

const host = process.env.HOST || 'localhost';
const appDirectory = fs.realpathSync(process.cwd());
const resolvePath = relativePath => path.resolve(appDirectory, relativePath);
const desiredPort = parseInt(process.env.PORT, 10) || 9000;

const devConfig = async () => {
  const port = await choosePort(host, desiredPort);

  if (!port) {
    process.exit();
  }

  console.log(chalk.yellow('Starting DEV Server'));

  return {
    ...config,
    mode: "development",
    devtool: "inline-cheap-module-source-map",
    devServer: {
      server: "https",
      onListening: () => {
        openBrowser(`https://${host}:${port}`);
      },
      host,
      port,
      hot: true,
      historyApiFallback: true,
      client: {
        logging: "none",
        progress: true,
        overlay: {
          warnings: false,
        }
      },
      static: {
        directory: path.resolve(__dirname, 'public'),
        publicPath: '/',
      },
    },
    module: {
      rules: [
        ...config.module.rules,
        {
          test: /\.(ts|tsx|js|jsx)$/,
          include: resolvePath('src'),
          exclude: /node_modules/,
          use: [
            {
              loader: "swc-loader"
            },
          ],
        },
        {
          test: /\.css$/,
          use: [
            "style-loader",
            {
              loader: "css-loader",
              options: {
                sourceMap: true,
                importLoaders: 1,
              },
            },
            {
              loader: "postcss-loader",
              options: {
                sourceMap: true,
              },
            },
          ],
        },
        {
          test: /\.module\.scss$/,
          use: [
            "style-loader",
            {
              loader: 'css-loader',
              options: {
                modules: {
                  localIdentName: "[local]_[hash:base64:8]",
                },
                sourceMap: true,
                importLoaders: 2
              }
            },
            {
              loader: 'sass-loader',
              options: {
                sourceMap: true
              }
            },
            {
              loader: "postcss-loader",
              options: {
                sourceMap: true,
              },
            },
          ]
        },
        {
          test: /\.(pdf|csv|txt)$/,
          use: [
            {
              loader: "ignore-loader",
            }
          ]
        }
      ],
    },
    plugins: [
      ...config.plugins,
      new ReactRefreshWebpackPlugin({
        overlay: false,
      }),
    ]
  };
};

module.exports = devConfig;
