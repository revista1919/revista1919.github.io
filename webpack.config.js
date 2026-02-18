const path = require('path');
const { CleanWebpackPlugin } = require('clean-webpack-plugin');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const CopyWebpackPlugin = require('copy-webpack-plugin');
const WebpackShellPluginNext = require('webpack-shell-plugin-next');
const webpack = require('webpack');

// Load .env.local first, then .env
const dotenvConfig = require('dotenv').config({ path: path.resolve(__dirname, '.env.local') });
if (dotenvConfig.error) {
  console.warn('⚠️ .env.local not found, using .env');
}
require('dotenv').config({ path: path.resolve(__dirname, '.env'), override: true });

module.exports = (env, argv) => {
  const isProduction = argv.mode === 'production';

// Debug: Print environment variables
console.log('🔍 Webpack Environment Variables:', {
  'REACT_APP_FIREBASE_API_KEY': process.env.REACT_APP_FIREBASE_API_KEY ? 'PRESENT' : 'MISSING',
  'REACT_APP_FIREBASE_PROJECT_ID': process.env.REACT_APP_FIREBASE_PROJECT_ID || 'MISSING',
  'REACT_APP_USERS_CSV': process.env.REACT_APP_USERS_CSV ? `${process.env.REACT_APP_USERS_CSV.slice(0, 40)}...` : 'MISSING',
  'REACT_APP_FORM_CSV': process.env.REACT_APP_FORM_CSV ? `${process.env.REACT_APP_FORM_CSV.slice(0, 40)}...` : 'MISSING',
  'REACT_APP_ARTICULOS_SCRIPT_URL': process.env.REACT_APP_ARTICULOS_SCRIPT_URL ? `${process.env.REACT_APP_ARTICULOS_SCRIPT_URL.slice(0, 40)}...` : 'MISSING',
  'REACT_APP_VOLUMES_SCRIPT_URL': process.env.REACT_APP_VOLUMES_SCRIPT_URL ? `${process.env.REACT_APP_VOLUMES_SCRIPT_URL.slice(0, 40)}...` : 'MISSING',
  'REACT_APP_TEAM_SCRIPT_URL': process.env.REACT_APP_TEAM_SCRIPT_URL ? `${process.env.REACT_APP_TEAM_SCRIPT_URL.slice(0, 40)}...` : 'MISSING',
  'REACT_APP_APPLICATIONS_SCRIPT_URL': process.env.REACT_APP_APPLICATIONS_SCRIPT_URL ? `${process.env.REACT_APP_APPLICATIONS_SCRIPT_URL.slice(0, 40)}...` : 'MISSING',
  'REACT_APP_REBUILD_TOKEN': process.env.REACT_APP_REBUILD_TOKEN ? 'PRESENT' : 'MISSING',
  'REACT_APP_API_GEMINI': process.env.REACT_APP_API_GEMINI ? 'PRESENT' : 'MISSING',
  'NODE_ENV': process.env.NODE_ENV || 'development',
  'DEBUG': process.env.DEBUG || false,
  '.env.local loaded': dotenvConfig.parsed ? Object.keys(dotenvConfig.parsed).length : 0,
});

// Inject environment variables
const defineEnvVars = {
  'process.env.NODE_ENV': JSON.stringify(isProduction ? 'production' : 'development'),

  'process.env.REACT_APP_ARTICULOS_SCRIPT_URL': JSON.stringify(process.env.REACT_APP_ARTICULOS_SCRIPT_URL || ''),
  'process.env.REACT_APP_VOLUMES_SCRIPT_URL': JSON.stringify(process.env.REACT_APP_VOLUMES_SCRIPT_URL || ''),
  'process.env.REACT_APP_TEAM_SCRIPT_URL': JSON.stringify(process.env.REACT_APP_TEAM_SCRIPT_URL || ''),
  'process.env.REACT_APP_APPLICATIONS_SCRIPT_URL': JSON.stringify(process.env.REACT_APP_APPLICATIONS_SCRIPT_URL || ''),
  'process.env.REACT_APP_REBUILD_TOKEN': JSON.stringify(process.env.REACT_APP_REBUILD_TOKEN || ''),

  'process.env.REACT_APP_USERS_CSV': JSON.stringify(process.env.REACT_APP_USERS_CSV || ''),
  'process.env.REACT_APP_FORM_CSV': JSON.stringify(process.env.REACT_APP_FORM_CSV || ''),

  'process.env.REACT_APP_FIREBASE_API_KEY': JSON.stringify(process.env.REACT_APP_FIREBASE_API_KEY || ''),
  'process.env.REACT_APP_FIREBASE_AUTH_DOMAIN': JSON.stringify(process.env.REACT_APP_FIREBASE_AUTH_DOMAIN || 'usuarios-rnce.firebaseapp.com'),
  'process.env.REACT_APP_FIREBASE_PROJECT_ID': JSON.stringify(process.env.REACT_APP_FIREBASE_PROJECT_ID || 'usuarios-rnce'),
  'process.env.REACT_APP_FIREBASE_STORAGE_BUCKET': JSON.stringify(process.env.REACT_APP_FIREBASE_STORAGE_BUCKET || 'usuarios-rnce.firebasestorage.app'),
  'process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID': JSON.stringify(process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID || '688242139131'),
  'process.env.REACT_APP_FIREBASE_APP_ID': JSON.stringify(process.env.REACT_APP_FIREBASE_APP_ID || '1:688242139131:web:3a98663545e73110c3f55e'),
  'process.env.REACT_APP_FIREBASE_MEASUREMENT_ID': JSON.stringify(process.env.REACT_APP_FIREBASE_MEASUREMENT_ID || 'G-K90MKB7BDP'),

  'process.env.REACT_APP_API_GEMINI': JSON.stringify(process.env.REACT_APP_API_GEMINI || ''),

  'process.env.DEBUG': JSON.stringify(process.env.DEBUG === 'true' || process.env.DEBUG === true),
};


  return {
    entry: {
      main: './src/index.js',
    },
    output: {
      path: path.resolve(__dirname, 'dist'),
      filename: isProduction ? '[name].[contenthash].js' : '[name].js',
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
      onListening: (devServer) => {
        const port = devServer.server.address().port;
        console.log(`🚀 Server running at http://localhost:${port}`);
      },
    },
    module: {
      rules: [
        {
          test: /\.jsx?$/i,
          exclude: [/node_modules\/(?!firebase)/, /public\/sw\.js$/],
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
            filename: '[name][ext]', // Los PDFs se guardan en la raíz
          },
        },
        {
          test: /\.html$/i,
          type: 'asset/resource',
          exclude: path.resolve(__dirname, 'public/index.html'), // Excluir index.html porque ya lo maneja HtmlWebpackPlugin
          generator: {
            filename: '[name][ext]', // Los HTMLs se copian directamente a la raíz
          },
        },
      ],
    },
    plugins: [
      new CleanWebpackPlugin({
        cleanOnceBeforeBuildPatterns: ['**/*', '!**/firebase.json', '!**/.firebaserc'],
      }),
      
      // Plugin para el archivo principal index.html
      new HtmlWebpackPlugin({
        template: './public/index.html',
        filename: 'index.html',
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
          // Archivos estáticos existentes
          { from: 'public/logo.png', to: '.' },
          { from: 'public/team.jpg', to: '.' },
          { from: 'public/logoEN.png', to: '.' },
          { from: 'public/site.webmanifest', to: 'manifest.json' },
          { from: 'public/404.html', to: '404.html', noErrorOnMissing: true },
          { from: 'public/CNAME', to: 'CNAME', toType: 'file', noErrorOnMissing: true },
          { from: 'public/sw.js', to: 'sw.js', noErrorOnMissing: true },
          { from: 'public/Articles', to: 'Articles', noErrorOnMissing: true },
          { from: 'public/Volumes', to: 'Volumes', noErrorOnMissing: true },
          { from: 'firebase.json', to: 'firebase.json', noErrorOnMissing: true },
          { from: '.firebaserc', to: '.firebaserc', noErrorOnMissing: true },
          
          // Archivos de políticas existentes
          { from: 'public/policies.html', to: 'policies.html', noErrorOnMissing: true },
          { from: 'public/policiesEN.html', to: 'policiesEN.html', noErrorOnMissing: true },
          { from: 'public/policiesApp.html', to: 'policiesApp.html', noErrorOnMissing: true },
          { from: 'public/policiesAppEN.html', to: 'policiesAppEN.html', noErrorOnMissing: true },
          
          // Archivos PDF de consentimiento
          { from: 'public/consent.pdf', to: 'consent.pdf', noErrorOnMissing: true },
          { from: 'public/consentEN.pdf', to: 'consentEN.pdf', noErrorOnMissing: true },
          
          // NUEVOS ARCHIVOS HTML LEGALES - Español
          { from: 'public/privacy.html', to: 'privacy.html', noErrorOnMissing: true },
          { from: 'public/terms.html', to: 'terms.html', noErrorOnMissing: true },
          { from: 'public/credits.html', to: 'credits.html', noErrorOnMissing: true },
          
          // NUEVOS ARCHIVOS HTML LEGALES - Inglés
          { from: 'public/privacyEN.html', to: 'privacyEN.html', noErrorOnMissing: true },
          { from: 'public/termsEN.html', to: 'termsEN.html', noErrorOnMissing: true },
          { from: 'public/creditsEN.html', to: 'creditsEN.html', noErrorOnMissing: true },
        ],
      }),
      
      new WebpackShellPluginNext({
        onBuildEnd: {
          scripts: ['npm run generate-all'],
          blocking: true,
          parallel: false,
        },
      }),

      new webpack.ProvidePlugin({
        process: 'process/browser.js',
      }),

      ...(isProduction ? [
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
        "process": require.resolve("process/browser.js"),
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
      splitChunks: {
        chunks: 'all',
        cacheGroups: {
          vendor: {
            test: '/[\\/]node_modules[\\/](?!firebase)/',
            name: 'vendors',
            chunks: 'all',
            priority: 10,
            enforce: true,
          },
          firebase: {
            test: '/[\\/]node_modules[\\/]firebase[\\/]/ ',
            name: 'firebase',
            chunks: 'all',
            priority: 20,
            enforce: true,
          },
        },
      },
      runtimeChunk: isProduction ? { name: 'runtime' } : undefined,
    },
    cache: {
      type: 'filesystem',
      buildDependencies: {
        config: [__filename],
      },
    },
  };
};