// webpack.config.js actualizado (agregar copy para team si hay assets locales, pero como son links, no es necesario; solo asegurar dist/team)
const path = require('path');
const { CleanWebpackPlugin } = require('clean-webpack-plugin');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const CopyWebpackPlugin = require('copy-webpack-plugin');
const WebpackShellPluginNext = require('webpack-shell-plugin-next');

module.exports = (env, argv) => {
  const isProduction = argv.mode === 'production';

  return {
    entry: './src/index.js',
    output: {
      path: path.resolve(__dirname, 'dist'),
      filename: isProduction ? '[name].[contenthash].js' : 'bundle.js',
      publicPath: '/',
      clean: true,
    },
    mode: isProduction ? 'production' : 'development',
    devServer: {
      static: {
        directory: path.join(__dirname, 'public'),
        publicPath: '/',
      },
      compress: true,
      port: process.env.PORT || 3000,
      open: true,
      hot: true,
      host: '0.0.0.0',
      historyApiFallback: true,
      onListening: (devServer) => {
        const port = devServer.server.address().port;
        console.log(`Server corriendo en puerto ${port}`);
      },
    },
    module: {
      rules: [
        {
          test: /\.js$/i,
          exclude: /node_modules/,
          use: {
            loader: 'babel-loader',
            options: {
              presets: ['@babel/preset-env', '@babel/preset-react'],
            },
          },
        },
        {
          test: /\.css$/i,
          use: [
            'style-loader',
            'css-loader',
            {
              loader: 'postcss-loader',
              options: {
                postcssOptions: {
                  plugins: [require('tailwindcss'), require('autoprefixer')],
                },
              },
            },
          ],
        },
        {
          test: /\.(png|jpe?g|gif|svg)$/i,
          type: 'asset/resource',
          generator: {
            filename: 'assets/[name][ext]',
          },
        },
        {
          test: /\.pdf$/i,
          type: 'asset/resource',
          generator: {
            filename: 'Articles/[name][ext]',
          },
        },
      ],
    },
    plugins: [
      new CleanWebpackPlugin(),
      new HtmlWebpackPlugin({
        template: './public/index.html',
        inject: 'body',
        minify: isProduction
          ? {
              removeComments: true,
              collapseWhitespace: true,
            }
          : false,
      }),
      new CopyWebpackPlugin({
        patterns: [
          { from: 'public/logo.png', to: '.' },
          { from: 'public/site.webmanifest', to: 'manifest.json' },
          { 
            from: 'public/Articles', 
            to: 'Articles',
            noErrorOnMissing: true,
          },
          // Si hay imágenes locales para team, agregar aquí; e.g., { from: 'public/team-images', to: 'team/images' }
        ],
      }),
      new WebpackShellPluginNext({
        onBuildEnd: {
          scripts: ['node generate-all.js'],
          blocking: true,
          parallel: false,
        },
      }),
    ],
    devtool: isProduction ? 'source-map' : 'eval-source-map',
    resolve: {
      extensions: ['.js'],
    },
    performance: {
      hints: isProduction ? 'warning' : false,
    },
  };
};