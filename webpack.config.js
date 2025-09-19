const path = require('path');
const { CleanWebpackPlugin } = require('clean-webpack-plugin');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const CopyWebpackPlugin = require('copy-webpack-plugin');
const WebpackShellPluginNext = require('webpack-shell-plugin-next');
const webpack = require('webpack');

// ✅ Cargar .env explícitamente
require('dotenv').config({ path: path.resolve(__dirname, '.env') });

module.exports = (env, argv) => {
  const isProduction = argv.mode === 'production';

  // ✅ Debug: Imprimir variables de entorno
  console.log('🔍 Webpack Environment Variables:', {
    REACT_APP_ARTICULOS_SCRIPT_URL: process.env.REACT_APP_ARTICULOS_SCRIPT_URL ? `${process.env.REACT_APP_ARTICULOS_SCRIPT_URL.slice(0, 40)}...` : 'MISSING',
    REACT_APP_GH_TOKEN: process.env.REACT_APP_GH_TOKEN ? 'PRESENT' : 'MISSING'
  });

  // ✅ Inyectar variables de entorno en el bundle
  const defineEnvVars = {
    'process.env.NODE_ENV': JSON.stringify(isProduction ? 'production' : 'development'),
    'process.env.REACT_APP_ARTICULOS_SCRIPT_URL': JSON.stringify(process.env.REACT_APP_ARTICULOS_SCRIPT_URL || ''),
    'process.env.REACT_APP_GH_TOKEN': JSON.stringify(process.env.REACT_APP_GH_TOKEN || ''),
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
      ...(isProduction ? [] : [
        new webpack.BannerPlugin({
          banner: `/* Built on ${new Date().toISOString()} - Environment: ${process.env.NODE_ENV} */`,
          raw: true,
          include: 'all',
        })
      ]),
    ],
    devtool: isProduction ? 'source-map' : 'eval-source-map',
    resolve: {
      extensions: ['.js', '.jsx'],
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
            test: /[\\/]node_modules[\\/]/,
            name: 'vendors',
            chunks: 'all',
            priority: 10,
          },
        },
      },
    },
  };
};