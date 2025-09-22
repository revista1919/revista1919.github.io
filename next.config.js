const withNextIntl = require('next-intl/plugin')(
  // Path a tu config (request.ts)
  './i18n/request.ts'
);

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  basePath: '/revista1919',
  assetPrefix: '/revista1919/',
  images: {
    unoptimized: true,
  },
  trailingSlash: true,
  env: {
    // Tus env vars...
  },
};

module.exports = withNextIntl(nextConfig);