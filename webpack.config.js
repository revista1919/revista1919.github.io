const path = require('path');
const { CleanWebpackPlugin } = require('clean-webpack-plugin');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const CopyWebpackPlugin = require('copy-webpack-plugin');
const WebpackShellPluginNext = require('webpack-shell-plugin-next');
const webpack = require('webpack');

// ✅ Cargar .env explícitamente
require('dotenv').config({ path: path.resolve(__dirname, '.env.local') || path.resolve(__dirname, '.env') });

module.exports = (env, argv) => {
  const isProduction = argv.mode === 'production';

  // ✅ Debug: Imprimir variables de entorno (sin exponer sensibles)
  console.log('🔍 Webpack Environment Variables:', {
    REACT_APP_ARTICULOS_SCRIPT_URL: process.env.REACT_APP_ARTICULOS_SCRIPT_URL ? `${process.env.REACT_APP_ARTICULOS_SCRIPT_URL.slice(0, 40)}...` : 'MISSING',
    REACT_APP_GH_TOKEN: process.env.REACT_APP_GH_TOKEN ? 'PRESENT' : 'MISSING',
    REACT_APP_USERS_CSV: process.env.REACT_APP_USERS_CSV ? `${process.env.REACT_APP_USERS_CSV.slice(0, 40)}...` : 'MISSING',
    REACT_APP_FIREBASE_API_KEY: process.env.REACT_APP_FIREBASE_API_KEY ? 'PRESENT' : 'MISSING', // ← NUEVO: Firebase
    NODE_ENV: process.env.NODE_ENV || 'development',
    DEBUG: process.env.DEBUG || false,
  });

  // ✅ Inyectar variables de entorno en el bundle
  const defineEnvVars = {
    'process.env.NODE_ENV': JSON.stringify(isProduction ? 'production' : 'development'),
    'process.env.REACT_APP_ARTICULOS_SCRIPT_URL': JSON.stringify(process.env.REACT_APP_ARTICULOS_SCRIPT_URL || ''),
    'process.env.REACT_APP_GH_TOKEN': JSON.stringify(process.env.REACT_APP_GH_TOKEN || ''),
    'process.env.REACT_APP_USERS_CSV': JSON.stringify(process.env.REACT_APP_USERS_CSV || ''),
    // ← NUEVO: Variables de Firebase (solo las necesarias)
    'process.env.REACT_APP_FIREBASE_API_KEY': JSON.stringify(process.env.REACT_APP_FIREBASE_API_KEY || ''),
    'process.env.REACT_APP_FIREBASE_AUTH_DOMAIN': JSON.stringify(process.env.REACT_APP_FIREBASE_AUTH_DOMAIN || ''),
    'process.env.REACT_APP_FIREBASE_PROJECT_ID': JSON.stringify(process.env.REACT_APP_FIREBASE_PROJECT_ID || ''),
    'process.env.REACT_APP_FIREBASE_STORAGE_BUCKET': JSON.stringify(process.env.REACT_APP_FIREBASE_STORAGE_BUCKET || ''),
    'process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID': JSON.stringify(process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID || ''),
    'process.env.REACT_APP_FIREBASE_APP_ID': JSON.stringify(process.env.REACT_APP_FIREBASE_APP_ID || ''),
    'process.env.DEBUG': JSON.stringify(!isProduction),
  };

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
      headers: {
        'Access-Control-Allow-Origin': '*', // ← ÚTIL para desarrollo con Firebase
      },
      onListening: (devServer) => {
        const port = devServer.server.address().port;
        console.log(`🚀 Server corriendo en http://localhost:${port}`);
        console.log(`📱 Acceso desde móvil: http://${require('os').networkInterfaces().en0?.[0]?.address || 'localhost'}:${port}`);
      },
    },
    module: {
      rules: [
        {
          test: /\.js$/i,
          exclude: /node_modules\/(?!firebase)/, // ← MEJORADO: Excluir Firebase de Babel
          use: {
            loader: 'babel-loader',
            options: {
              presets: ['@babel/preset-env', '@babel/preset-react'],
              // ← NUEVO: Cache para builds más rápidos
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
        // ← NUEVO: Manejo de archivos JSON (para firebase config si lo necesitas)
        {
          test: /\.json$/i,
          type: 'json',
          parser: {
            json5: true,
          },
        },
      ],
    },
    plugins: [
      new CleanWebpackPlugin({
        // ← MEJORADO: Limpiar solo archivos específicos
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
        // ← NUEVO: Agregar meta tags para Firebase
        meta: isProduction ? {
          'firebase-config': JSON.stringify({
            projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID,
            apiKey: process.env.REACT_APP_FIREBASE_API_KEY ? 'CONFIGURED' : 'MISSING'
          })
        } : {},
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
          // ← NUEVO: Copiar firebase config si existe
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
      new WebpackShellPluginNext({
        onBuildEnd: {
          scripts: ['node generate-all.js'],
          blocking: true,
          parallel: false,
        },
      }),
      // ← NUEVO: Plugin para Firebase (opcional)
      ...(isProduction ? [
        new webpack.BannerPlugin({
          banner: `/* Revista 1919 - Built ${new Date().toISOString()} | Firebase Auth Enabled */`,
          raw: true,
          include: 'all',
        })
      ] : [
        new webpack.BannerPlugin({
          banner: `/* Revista 1919 - Development Build ${new Date().toISOString()} | Firebase Auth: ${process.env.REACT_APP_FIREBASE_API_KEY ? 'ENABLED' : 'DISABLED'} */`,
          raw: true,
          include: 'all',
        })
      ]),
    ],
    devtool: isProduction ? 'source-map' : 'eval-cheap-module-source-map', // ← MEJORADO: Source maps
    resolve: {
      extensions: ['.js', '.jsx', '.json'], // ← AGREGADO: .json
      fallback: {
        // ← NUEVO: Fallback para Node.js modules (para Firebase)
        "fs": false,
        "path": false,
        "crypto": false,
      },
    },
    performance: {
      hints: isProduction ? 'warning' : false,
      maxAssetSize: 500000, // 500KB
      maxEntrypointSize: 1000000, // 1MB
    },
    optimization: {
      minimize: isProduction,
      splitChunks: {
        chunks: 'all',
        cacheGroups: {
          vendor: {
            test: /[\\/]node_modules[\\/](?!firebase)/, // ← MEJORADO: Excluir Firebase del vendor bundle
            name: 'vendors',
            chunks: 'all',
            priority: 10,
            enforce: true,
          },
          firebase: { // ← NUEVO: Bundle separado para Firebase
            test: /[\\/]node_modules[\\/]firebase[\\/]/,
            name: 'firebase',
            chunks: 'all',
            priority: 20,
            enforce: true,
          },
        },
      },
      // ← NUEVO: Cache para desarrollo
      runtimeChunk: isProduction ? {
        name: 'runtime'
      } : undefined,
    },
    // ← NUEVO: Cache para builds más rápidos
    cache: {
      type: 'filesystem',
      buildDependencies: {
        config: [__filename],
      },
    },
  };
};