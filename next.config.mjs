/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: process.env.NEXT_EXPORT === '1' ? 'export' : undefined,
  basePath: process.env.NEXT_PUBLIC_BASE_PATH ?? '',
  webpack: (config, { isServer }) => {
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      path: false,
      crypto: false,
    }

    if (isServer) {
      config.externals = [
        ...(Array.isArray(config.externals) ? config.externals : []),
        ({ request }, callback) => {
          if (request && request.includes('@duckdb/duckdb-wasm')) {
            return callback(null, 'commonjs ' + request)
          }
          callback()
        },
      ]
    }

    config.module.rules.push({
      test: /duckdb-node(|-blocking|-(eh|mvp)\.worker)\.cjs$/,
      use: 'null-loader',
    })

    return config
  },
}

export default nextConfig
