const path = require('path');
const { CleanWebpackPlugin } = require('clean-webpack-plugin');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const CopyWebpackPlugin = require('copy-webpack-plugin');
const webpack = require('webpack');

// Cargar variables de entorno de forma segura
require('dotenv').config({ path: path.resolve(__dirname, '.env.local'), override: true });
require('dotenv').config({ path: path.resolve(__dirname, '.env'), override: true });

const isProduction = process.env.NODE_ENV === 'production';
const isDebug = process.env.DEBUG === 'true';

if (isDebug) {
  console.log('🔍 Variables de entorno:', {
    'REACT_APP_FIREBASE_API_KEY': process.env.REACT_APP_FIREBASE_API_KEY ? '✓ PRESENTE' : '✗ FALTANTE',
    'REACT_APP_USERS_CSV': process.env.REACT_APP_USERS_CSV ? '✓ PRESENTE' : '✗ FALTANTE',
    'NODE_ENV': process.env.NODE_ENV || 'development',
  });
}

// Variables de entorno para el bundle
const defineEnvVars = {
  'process.env.NODE_ENV': JSON.stringify(isProduction ? 'production' : 'development'),
  'process.env.PUBLIC_URL': JSON.stringify(process.env.PUBLIC_URL || '/revista1919/'),
  'process.env.REACT_APP_ARTICULOS_SCRIPT_URL': JSON.stringify(process.env.REACT_APP_ARTICULOS_SCRIPT_URL || ''),
  'process.env.REACT_APP_USERS_CSV': JSON.stringify(process.env.REACT_APP_USERS_CSV || ''),
  'process.env.REACT_APP_GH_TOKEN': JSON.stringify(process.env.REACT_APP_GH_TOKEN || ''),
  'process.env.REACT_APP_FIREBASE_API_KEY': JSON.stringify(process.env.REACT_APP_FIREBASE_API_KEY || ''),
  'process.env.REACT_APP_FIREBASE_AUTH_DOMAIN': JSON.stringify(process.env.REACT_APP_FIREBASE_AUTH_DOMAIN || 'usuarios-rnce.firebaseapp.com'),
  'process.env.REACT_APP_FIREBASE_PROJECT_ID': JSON.stringify(process.env.REACT_APP_FIREBASE_PROJECT_ID || 'usuarios-rnce'),
  'process.env.REACT_APP_FIREBASE_STORAGE_BUCKET': JSON.stringify(process.env.REACT_APP_FIREBASE_STORAGE_BUCKET || 'usuarios-rnce.firebasestorage.app'),
  'process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID': JSON.stringify(process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID || '688242139131'),
  'process.env.REACT_APP_FIREBASE_APP_ID': JSON.stringify(process.env.REACT_APP_FIREBASE_APP_ID || '1:688242139131:web:3a98663545e73110c3f55e'),
  'process.env.REACT_APP_FIREBASE_MEASUREMENT_ID': JSON.stringify(process.env.REACT_APP_FIREBASE_MEASUREMENT_ID || 'G-K90MKB7BDP'),
  'process.env.DEBUG': JSON.stringify(isDebug),
};

module.exports = {
  mode: isProduction ? 'production' : 'development',
  
  entry: './src/main.js',
  
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: isProduction ? '[name].[contenthash].js' : 'bundle.js',
    publicPath: process.env.PUBLIC_URL || '/revista1919/',
    clean: true,
  },
  
  devServer: {
    static: {
      directory: path.join(__dirname, 'public'),
    },
    compress: true,
    port: 3000,
    open: true,
    hot: !isProduction,
    historyApiFallback: true,
  },
  
  module: {
    rules: [
      // JavaScript y JSX
      {
        test: /\.(js|jsx)$/,
        exclude: /node_modules/,
        use: {
          loader: 'babel-loader',
          options: {
            presets: [
              ['@babel/preset-env', { targets: 'defaults' }],
              ['@babel/preset-react', { runtime: 'automatic' }],
            ],
          },
        },
      },
      
      // CSS
      {
        test: /\.css$/,
        use: ['style-loader', 'css-loader', 'postcss-loader'],
      },
      
      // Archivos
      {
        test: /\.(png|jpe?g|gif|svg|ico)$/i,
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
    // HTML
    new HtmlWebpackPlugin({
      template: './public/index.html',
      inject: 'body',
      minify: isProduction ? {
        collapseWhitespace: true,
        removeComments: true,
      } : false,
    }),
    
    // Copiar archivos
    new CopyWebpackPlugin({
      patterns: [
        { from: 'public', to: '.', globOptions: { ignore: ['**/index.html'] } },
        { from: 'public/Articles', to: 'Articles', noErrorOnMissing: true },
      ],
    }),
    
    // Variables de entorno
    new webpack.DefinePlugin(defineEnvVars),
    
    // Limpiar
    new CleanWebpackPlugin(),
  ],
  
  resolve: {
    extensions: ['.js', '.jsx', '.json'],
    fallback: {
      "fs": false,
      "path": false,
      "crypto": false,
      "stream": false,
      "buffer": require.resolve("buffer/"),
      "process": require.resolve("process/browser"),
      "util": false,
      "url": false,
      "assert": false,
      "string_decoder": false,
      "zlib": false,
    },
  },
  
  devtool: isProduction ? 'source-map' : 'eval-source-map',
  
  optimization: {
    minimize: isProduction,
  },
  
  cache: {
    type: 'filesystem',
  },
};