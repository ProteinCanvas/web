import { fileURLToPath } from 'url'
import path from 'path'

const __dirname = fileURLToPath(new URL('.', import.meta.url))

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
      perf_hooks: false,
    }

    config.resolve.alias = {
      ...config.resolve.alias,
      'onnxruntime-node': false,
    }

    config.module.rules.push({
      test: /\.node$/,
      use: 'null-loader',
    })

    config.module.rules.push({
      test: /duckdb-node(|-blocking|-(eh|mvp)\.worker)\.cjs$/,
      use: 'null-loader',
    })

    if (isServer) {
      config.module.rules.push({
        test: /node_modules[\\/]@huggingface[\\/]transformers/,
        use: 'null-loader',
      })

      config.externals = [
        ...(Array.isArray(config.externals) ? config.externals : []),
        ({ request }, callback) => {
          if (request && request.includes('@duckdb/duckdb-wasm')) {
            return callback(null, 'commonjs ' + request)
          }
          callback()
        },
      ]
    } else {
      config.resolve.alias = {
        ...config.resolve.alias,
        '@huggingface/transformers': path.resolve(
          __dirname,
          'node_modules/@huggingface/transformers/dist/transformers.web.js'
        ),
      }

      config.module.rules.unshift({
        test: /ort[^/\\]*\.m?js$/,
        include: /node_modules[\\/]onnxruntime-web/,
        type: 'javascript/esm',
      })
    }

    return config
  },
}

export default nextConfig
