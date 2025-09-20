const path = require('path');
const { CleanWebpackPlugin } = require('clean-webpack-plugin');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const CopyWebpackPlugin = require('copy-webpack-plugin');
const WebpackShellPluginNext = require('webpack-shell-plugin-next');
const webpack = require('webpack');

// ✅ Cargar variables de entorno
let dotenvConfig;
try {
  dotenvConfig = require('dotenv').config({ path: path.resolve(__dirname, '.env.local') });
  if (dotenvConfig.error) {
    console.warn('⚠️ .env.local no encontrado, usando .env');
  }
} catch (error) {
  console.warn('⚠️ Error cargando .env.local:', error.message);
}

require('dotenv').config({ path: path.resolve(__dirname, '.env'), override: true });

module.exports = (env, argv) => {
  const isProduction = argv.mode === 'production';
  const isDebug = process.env.DEBUG === 'true';

  // ✅ Debug: Mostrar variables de entorno cargadas
  if (isDebug) {
    console.log('🔍 Variables de entorno cargadas:', {
      'REACT_APP_FIREBASE_API_KEY': process.env.REACT_APP_FIREBASE_API_KEY ? '✓ PRESENTE' : '✗ FALTANTE',
      'REACT_APP_FIREBASE_PROJECT_ID': process.env.REACT_APP_FIREBASE_PROJECT_ID || '✗ FALTANTE',
      'REACT_APP_USERS_CSV': process.env.REACT_APP_USERS_CSV ? `${process.env.REACT_APP_USERS_CSV.slice(0, 50)}...` : '✗ FALTANTE',
      'REACT_APP_ARTICULOS_SCRIPT_URL': process.env.REACT_APP_ARTICULOS_SCRIPT_URL ? `${process.env.REACT_APP_ARTICULOS_SCRIPT_URL.slice(0, 50)}...` : '✗ FALTANTE',
      'NODE_ENV': process.env.NODE_ENV || 'development',
      'PUBLIC_URL': process.env.PUBLIC_URL || '/',
    });
  }

  // ✅ Definir variables de entorno para el bundle
  const defineEnvVars = {
    'process.env.NODE_ENV': JSON.stringify(isProduction ? 'production' : 'development'),
    'process.env.PUBLIC_URL': JSON.stringify(process.env.PUBLIC_URL || '/'),
    'process.env.REACT_APP_ARTICULOS_SCRIPT_URL': JSON.stringify(process.env.REACT_APP_ARTICULOS_SCRIPT_URL || ''),
    'process.env.REACT_APP_USERS_CSV': JSON.stringify(process.env.REACT_APP_USERS_CSV || ''),
    'process.env.REACT_APP_GH_TOKEN': JSON.stringify(process.env.REACT_APP_GH_TOKEN || ''),
    
    // Firebase
    'process.env.REACT_APP_FIREBASE_API_KEY': JSON.stringify(process.env.REACT_APP_FIREBASE_API_KEY || ''),
    'process.env.REACT_APP_FIREBASE_AUTH_DOMAIN': JSON.stringify(process.env.REACT_APP_FIREBASE_AUTH_DOMAIN || 'usuarios-rnce.firebaseapp.com'),
    'process.env.REACT_APP_FIREBASE_PROJECT_ID': JSON.stringify(process.env.REACT_APP_FIREBASE_PROJECT_ID || 'usuarios-rnce'),
    'process.env.REACT_APP_FIREBASE_STORAGE_BUCKET': JSON.stringify(process.env.REACT_APP_FIREBASE_STORAGE_BUCKET || 'usuarios-rnce.firebasestorage.app'),
    'process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID': JSON.stringify(process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID || '688242139131'),
    'process.env.REACT_APP_FIREBASE_APP_ID': JSON.stringify(process.env.REACT_APP_FIREBASE_APP_ID || '1:688242139131:web:3a98663545e73110c3f55e'),
    'process.env.REACT_APP_FIREBASE_MEASUREMENT_ID': JSON.stringify(process.env.REACT_APP_FIREBASE_MEASUREMENT_ID || 'G-K90MKB7BDP'),
    
    // Debug
    'process.env.DEBUG': JSON.stringify(isDebug),
  };

  // ✅ Polyfills - Solo los que están garantizados
  const fallbackConfig = {
    "fs": false,
    "path": false,
    "crypto": require.resolve('crypto-browserify'),
    "stream": require.resolve('stream-browserify'),
    "buffer": require.resolve("buffer/"),
    "process": require.resolve("process/browser"),
    "util": require.resolve("util/"),
    "url": require.resolve("url/"),
    "assert": require.resolve("assert/"),
    "string_decoder": require.resolve("string_decoder"),
    "zlib": require.resolve("browserify-zlib"),
    "http": false,
    "https": false,
    "os": require.resolve("os-browserify/browser"),
    "vm": require.resolve("vm-browserify"),
  };

  return {
    // ✅ Entrada principal
    entry: './src/main.js',
    
    output: {
      path: path.resolve(__dirname, 'dist'),
      filename: isProduction ? '[name].[contenthash:8].js' : 'bundle.js',
      chunkFilename: isProduction ? '[name].[contenthash:8].chunk.js' : '[name].chunk.js',
      publicPath: process.env.PUBLIC_URL || '/',
      clean: true,
      assetModuleFilename: isProduction ? 'assets/[name].[hash:8][ext][query]' : 'assets/[name][ext][query]',
    },
    
    mode: isProduction ? 'production' : 'development',
    
    devServer: {
      static: {
        directory: path.join(__dirname, 'public'),
      },
      compress: true,
      port: process.env.PORT || 3000,
      open: true,
      hot: true,
      historyApiFallback: true,
      headers: {
        'Access-Control-Allow-Origin': '*',
      },
      client: {
        overlay: {
          errors: true,
          warnings: false,
        },
        logging: isDebug ? 'verbose' : 'info',
      },
      onListening: (devServer) => {
        const port = devServer.server.address().port;
        const url = `http://localhost:${port}`;
        console.log(`🚀 Server corriendo en: ${url}`);
        if (isDebug) {
          console.log(`📱 En tu red: http://${require('os').hostname()}:${port}`);
        }
      },
    },
    
    module: {
      rules: [
        // JavaScript y JSX - SIMPLIFICADO
        {
          test: /\.(js|jsx)$/i,
          exclude: /node_modules\/(?!(@react-oauth\/google|firebase))/,
          use: {
            loader: 'babel-loader',
            options: {
              presets: [
                ['@babel/preset-env', { 
                  targets: '> 0.25%, not dead' 
                }],
                ['@babel/preset-react', { 
                  runtime: 'automatic' 
                }]
              ],
              // ✅ ELIMINADOS: Plugins problemáticos
              cacheDirectory: true,
              cacheCompression: isProduction,
            },
          },
        },
        
        // CSS con Tailwind
        {
          test: /\.css$/i,
          use: [
            'style-loader',
            {
              loader: 'css-loader',
              options: {
                importLoaders: 1,
                sourceMap: !isProduction,
                modules: false,
              },
            },
            {
              loader: 'postcss-loader',
              options: {
                postcssOptions: {
                  plugins: [
                    require('tailwindcss'),
                    require('autoprefixer'),
                  ],
                },
              },
            },
          ],
        },
        
        // Archivos estáticos
        {
          test: /\.(png|jpe?g|gif|svg|ico|webp)$/i,
          type: 'asset/resource',
          generator: {
            filename: 'assets/[name][ext]',
          },
        },
        
        // PDFs
        {
          test: /\.pdf$/i,
          type: 'asset/resource',
          generator: {
            filename: 'Articles/[name][ext]',
          },
        },
        
        // Fonts
        {
          test: /\.(woff|woff2|eot|ttf|otf)$/i,
          type: 'asset/resource',
          generator: {
            filename: 'fonts/[name][ext]',
          },
        },
      ],
    },
    
    plugins: [
      // Limpiar directorio de salida
      new CleanWebpackPlugin({
        cleanOnceBeforeBuildPatterns: ['**/*', '!**/firebase.json', '!**/.firebaserc'],
        verbose: isDebug,
        dry: false,
      }),
      
      // Generar HTML
      new HtmlWebpackPlugin({
        template: './public/index.html',
        filename: 'index.html',
        inject: 'body',
        publicPath: process.env.PUBLIC_URL || '/',
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
        meta: {
          charset: 'UTF-8',
          viewport: 'width=device-width, initial-scale=1.0',
          'theme-color': '#f4ece7',
        },
      }),
      
      // Copiar archivos estáticos
      new CopyWebpackPlugin({
        patterns: [
          { from: 'public', to: '.', globOptions: { ignore: ['**/index.html'] } },
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
      
      // Inyectar variables de entorno
      new webpack.DefinePlugin(defineEnvVars),
      
      // Script post-build solo en producción
      ...(isProduction ? [
        new WebpackShellPluginNext({
          onBuildEnd: {
            scripts: ['node generate-all.js'],
            blocking: true,
            parallel: false,
          },
        }),
      ] : []),
      
      // Banner de build
      new webpack.BannerPlugin({
        banner: `/* 
Revista Nacional de las Ciencias para Estudiantes
Built: ${new Date().toISOString()}
Environment: ${isProduction ? 'Production' : 'Development'}
Firebase: ${process.env.REACT_APP_FIREBASE_PROJECT_ID ? 'Enabled' : 'Disabled'}
*/`,
        raw: true,
        include: 'all',
      }),
      
      // Hot Module Replacement (desarrollo)
      ...(isProduction ? [] : [
        new webpack.HotModuleReplacementPlugin(),
      ]),
    ],
    
    devtool: isProduction ? 'source-map' : 'eval-cheap-module-source-map',
    
    resolve: {
      extensions: ['.js', '.jsx', '.json'],
      alias: {
        '@': path.resolve(__dirname, 'src/'),
      },
      fallback: fallbackConfig,
    },
    
    performance: {
      hints: isProduction ? 'warning' : false,
      maxAssetSize: 500000,
      maxEntrypointSize: 1000000,
    },
    
    optimization: {
      minimize: isProduction,
      
      ...(isProduction && {
        splitChunks: {
          chunks: 'all',
          cacheGroups: {
            vendor: {
              test: /[\\/]node_modules[\\/](react|react-dom)/,
              name: 'vendors',
              chunks: 'all',
              priority: 20,
              enforce: true,
            },
            firebase: {
              test: /[\\/]node_modules[\\/]firebase[\\/]/,
              name: 'firebase',
              chunks: 'all',
              priority: 10,
              enforce: true,
            },
          },
        },
        runtimeChunk: {
          name: 'runtime',
        },
      }),
    },
    
    cache: {
      type: 'filesystem',
      buildDependencies: {
        config: [__filename],
      },
    },
    
    stats: isDebug ? 'verbose' : isProduction ? 'minimal' : 'normal',
  };
};