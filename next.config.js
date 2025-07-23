const cspHeader = `
    default-src 'self';
    script-src 'self' 'unsafe-eval' 'unsafe-inline' https://*.solana.com https://*.phantom.app https://*.solflare.com;
    style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;
    img-src 'self' blob: data: https://*.amazonaws.com https://*.ipfs.io https://*.arweave.net https://*.nftstorage.link;
    font-src 'self' https://fonts.gstatic.com;
    connect-src 'self' http://localhost:3001 https://*.solana.com https://*.helius-rpc.com https://*.phantom.app https://*.solflare.com wss://*.solana.com;
    object-src 'none';
    base-uri 'self';
    form-action 'self';
    frame-ancestors 'none';
    frame-src https://*.phantom.app https://*.solflare.com;
`

/** @type {import('next').NextConfig} */
const nextConfig = {
    // Fix Server Actions issues
    experimental: {
        optimizePackageImports: ['@solana/web3.js', '@project-serum/anchor']
    },
    async headers() {
        return [
            {
                source: '/(.*)',
                headers: [
                    {
                        key: 'Content-Security-Policy',
                        value: cspHeader.replace(/\n/g, ''),
                    },
                ],
            },
            {
                source: '/_next/static/:path*',
                headers: [
                    {
                        key: 'Cache-Control',
                        value: 'no-cache, no-store, must-revalidate',
                    },
                ],
            },
        ]
    },
    webpack: (config, { isServer }) => {
        // Better webpack configuration for Solana dependencies
        if (!isServer) {
            config.resolve.fallback = {
                ...config.resolve.fallback,
                crypto: require.resolve('crypto-browserify'),
                stream: require.resolve('stream-browserify'),
                assert: require.resolve('assert'),
                http: require.resolve('stream-http'),
                https: require.resolve('https-browserify'),
                os: require.resolve('os-browserify'),
                url: require.resolve('url'),
                zlib: require.resolve('browserify-zlib'),
                buffer: require.resolve('buffer'),
                process: require.resolve('process/browser'),
                path: require.resolve('path-browserify'),
            };
            
            // Add buffer polyfill for client-side only
            try {
                const webpack = require('webpack');
                config.plugins.push(
                    new webpack.ProvidePlugin({
                        Buffer: ['buffer', 'Buffer'],
                        process: 'process/browser',
                    })
                );
            } catch (err) {
                console.warn('Webpack ProvidePlugin could not be loaded:', err.message);
            }
        }
        
        // Only push externals for server builds
        if (isServer) {
            config.externals.push('pino-pretty', 'lokijs', 'encoding');
        }
        
        // Force cache busting for browser
        config.output.filename = isServer 
            ? '[name].js'
            : `[name].[contenthash]-v${Date.now()}.js`;
        config.output.chunkFilename = isServer 
            ? '[name].js' 
            : `[name].[contenthash]-v${Date.now()}.js`;

        config.module.rules.push({
            test: /\.node$/,
            use: 'raw-loader',
        });

        return config;
    },
    generateBuildId: async () => {
        // Force new build ID to invalidate browser cache
        return `build-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    },
    // Disable source maps in development to avoid URL parameter issues
    productionBrowserSourceMaps: false,
    // Suppress hydration warnings for wallet components
    reactStrictMode: false,
}

module.exports = nextConfig 