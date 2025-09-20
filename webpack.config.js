const path = require('path');
const { CleanWebpackPlugin } = require('clean-webpack-plugin');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const CopyWebpackPlugin = require('copy-webpack-plugin');
const WebpackShellPluginNext = require('webpack-shell-plugin-next');
const webpack = require('webpack');

// Cargar .env.local primero, luego .env
const dotenvConfig = require('dotenv').config({ path: path.resolve(__dirname, '.env.local') });
if (dotenvConfig.error) {
  console.warn('⚠️ .env.local no encontrado, usando .env');
}
require('dotenv').config({ path: path.resolve(__dirname, '.env'), override: true });

module.exports = (env, argv) => {
  const isProduction = argv.mode === 'production';

  // Debug: Imprimir variables de entorno
  console.log('🔍 Webpack Environment Variables:', {
    'REACT_APP_FIREBASE_API_KEY': process.env.REACT_APP_FIREBASE_API_KEY ? 'PRESENT' : 'MISSING',
    'REACT_APP_FIREBASE_PROJECT_ID': process.env.REACT_APP_FIREBASE_PROJECT_ID || 'MISSING',
    'REACT_APP_USERS_CSV': process.env.REACT_APP_USERS_CSV ? `${process.env.REACT_APP_USERS_CSV.slice(0, 40)}...` : 'MISSING',
    'REACT_APP_ARTICULOS_SCRIPT_URL': process.env.REACT_APP_ARTICULOS_SCRIPT_URL ? `${process.env.REACT_APP_ARTICULOS_SCRIPT_URL.slice(0, 40)}...` : 'MISSING',
    'REACT_APP_GH_TOKEN': process.env.REACT_APP_GH_TOKEN ? 'PRESENT' : 'MISSING',
    'NODE_ENV': process.env.NODE_ENV || 'development',
    'DEBUG': process.env.DEBUG || false,
  });

  // Inyectar variables de entorno en el bundle
  const defineEnvVars = {
    'process.env.NODE_ENV': JSON.stringify(isProduction ? 'production' : 'development'),
    'process.env.REACT_APP_ARTICULOS_SCRIPT_URL': JSON.stringify(process.env.REACT_APP_ARTICULOS_SCRIPT_URL || ''),
    'process.env.REACT_APP_GH_TOKEN': JSON.stringify(process.env.REACT_APP_GH_TOKEN || ''),
    'process.env.REACT_APP_USERS_CSV': JSON.stringify(process.env.REACT_APP_USERS_CSV || ''),
    'process.env.REACT_APP_FIREBASE_API_KEY': JSON.stringify(process.env.REACT_APP_FIREBASE_API_KEY || ''),
    'process.env.REACT_APP_FIREBASE_AUTH_DOMAIN': JSON.stringify(process.env.REACT_APP_FIREBASE_AUTH_DOMAIN || 'usuarios-rnce.firebaseapp.com'),
    'process.env.REACT_APP_FIREBASE_PROJECT_ID': JSON.stringify(process.env.REACT_APP_FIREBASE_PROJECT_ID || 'usuarios-rnce'),
    'process.env.REACT_APP_FIREBASE_STORAGE_BUCKET': JSON.stringify(process.env.REACT_APP_FIREBASE_STORAGE_BUCKET || 'usuarios-rnce.firebasestorage.app'),
    'process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID': JSON.stringify(process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID || '688242139131'),
    'process.env.REACT_APP_FIREBASE_APP_ID': JSON.stringify(process.env.REACT_APP_FIREBASE_APP_ID || '1:688242139131:web:3a98663545e73110c3f55e'),
    'process.env.REACT_APP_FIREBASE_MEASUREMENT_ID': JSON.stringify(process.env.REACT_APP_FIREBASE_MEASUREMENT_ID || 'G-K90MKB7BDP'),
    'process.env.DEBUG': JSON.stringify(process.env.DEBUG === 'true' || process.env.DEBUG === true),
  };

  return {
    entry: './src/index.js', // ← VUELVE A index.js como estaba originalmente
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
      headers: {
        'Access-Control-Allow-Origin': '*',
      },
    },
    module: {
      rules: [
        {
          test: /\.js$/i,
          exclude: /node_modules\/(?!firebase)/,
          use: {
            loader: 'babel-loader',
            options: {
              presets: ['@babel/preset-env', '@babel/preset-react'],
              cacheDirectory: true,
            },
          },
        },
        {
          test: /\.jsx?$/i,
          exclude: /node_modules/,
          use: {
            loader: 'babel-loader',
            options: {
              presets: ['@babel/preset-env', '@babel/preset-react'],
              cacheDirectory: true,
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
          test: /\.(png|jpe?g|gif|svg|ico|webmanifest)$/i,
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
      new CleanWebpackPlugin({
        cleanOnceBeforeBuildPatterns: ['**/*', '!**/firebase.json', '!**/.firebaserc'],
      }),
      new HtmlWebpackPlugin({
        template: './public/index.html',
        inject: 'body',
        minify: isProduction
          ? {
              removeComments: true,
              collapseWhitespace: true,
              removeRedundantAttributes: true,
              useShortDoctype: true,
              removeEmptyAttributes: true,
              removeStyleLinkTypeAttributes: true,
              keepClosingSlash: true,
              minifyJS: true,
              minifyCSS: true,
              minifyURLs: true,
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
          {
            from: 'firebase.json',
            to: 'firebase.json',
            noErrorOnMissing: true,
          },
          {
            from: '.firebaserc',
            to: '.firebaserc',
            noErrorOnMissing: true,
          },
        ],
      }),
      new webpack.DefinePlugin(defineEnvVars),
      ...(isProduction ? [
        new WebpackShellPluginNext({
          onBuildEnd: {
            scripts: ['node generate-all.js'],
            blocking: true,
            parallel: false,
          },
        }),
        new webpack.BannerPlugin({
          banner: `/* Revista 1919 - Built ${new Date().toISOString()} | Firebase Auth Enabled */`,
          raw: true,
          include: 'all',
        })
      ] : [
        new webpack.BannerPlugin({
          banner: `/* Revista 1919 - Development Build ${new Date().toISOString()} | Firebase Auth: ENABLED */`,
          raw: true,
          include: 'all',
        })
      ]),
    ],
    devtool: isProduction ? 'source-map' : 'eval-cheap-module-source-map',
    resolve: {
      extensions: ['.js', '.jsx', '.json'],
      fallback: {
        "fs": false,
        "path": false,
        "crypto": false,
        "process": require.resolve("process/browser"),
        "util": false,
        "stream": false,
        "buffer": require.resolve("buffer/"),
        "url": false,
        "assert": false,
        "string_decoder": false,
        "zlib": false,
      },
    },
    performance: {
      hints: isProduction ? 'warning' : false,
      maxAssetSize: 500000,
      maxEntrypointSize: 1000000,
    },
    optimization: {
      minimize: isProduction,
    },
    cache: {
      type: 'filesystem',
      buildDependencies: {
        config: [__filename],
      },
    },
  };
};