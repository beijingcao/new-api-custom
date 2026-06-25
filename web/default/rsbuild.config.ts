import path from 'path'
import { fileURLToPath } from 'url'
import { createRequire } from 'module'
import { defineConfig, loadEnv } from '@rsbuild/core'
import { pluginReact } from '@rsbuild/plugin-react'
import { tanstackRouter } from '@tanstack/router-plugin/rspack'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// Resolve @lobehub/icons from wherever the package manager actually installs it
// (web/default/node_modules, or the hoisted workspace-root web/node_modules).
// A hardcoded node_modules path breaks when bun hoists the package to the root —
// which is what happened when rc.15's lockfile update shifted the hoisting layout.
const nodeRequire = createRequire(import.meta.url)
const lobeIconsEsDir = path.join(
  path.dirname(nodeRequire.resolve('@lobehub/icons/package.json')),
  'es',
)

export default defineConfig(({ envMode }) => {
  const env = loadEnv({ mode: envMode, prefixes: ['VITE_'] })
  const serverUrl =
    process.env.VITE_REACT_APP_SERVER_URL ||
    env.rawPublicVars.VITE_REACT_APP_SERVER_URL ||
    'http://localhost:3000'

  const isProd = envMode === 'production'
  const devProxy = Object.fromEntries(
    (['/api', '/mj', '/pg'] as const).map((key) => [
      key,
      { target: serverUrl, changeOrigin: true },
    ]),
  ) as Record<string, { target: string; changeOrigin: boolean }>

  return {
    plugins: [pluginReact()],
    // Rsbuild 2: replaces deprecated `performance.chunkSplit` (RSPack 2 aligned)
    splitChunks: {
      preset: 'default',
      cacheGroups: {
        'vendor-react': {
          test: /node_modules[\\/](react|react-dom)[\\/]/,
          name: 'vendor-react',
          chunks: 'all',
          priority: 0,
          enforce: true,
        },
        'vendor-ui-primitives': {
          test: /node_modules[\\/](@base-ui|@radix-ui)[\\/]/,
          name: 'vendor-ui-primitives',
          chunks: 'all',
          priority: 0,
          enforce: true,
        },
        'vendor-tanstack': {
          test: /node_modules[\\/]@tanstack[\\/]/,
          name: 'vendor-tanstack',
          chunks: 'all',
          priority: 0,
          enforce: true,
        },
        'vendor-charts': {
          test: /node_modules[\\/](@visactor|recharts|d3-)[\\/]/,
          name: 'vendor-charts',
          chunks: 'all',
          priority: 0,
          enforce: true,
        },
        'vendor-icons': {
          test: /node_modules[\\/](lucide-react|@hugeicons)[\\/]/,
          name: 'vendor-icons',
          chunks: 'all',
          priority: 0,
          enforce: true,
        },
        // NOTE: no `vendor-lobe-icons` cacheGroup. @lobehub/icons is imported
        // per-provider on demand (see src/lib/lobe-icon.tsx); forcing all of
        // them into a single enforced chunk would defeat that splitting and
        // reload the entire ~900 kB icon set up front.
      },
    },
    source: {
      entry: {
        index: './src/main.tsx',
      },
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
        '@lobe-icons': lobeIconsEsDir,
      },
    },
    html: {
      template: './index.html',
    },
    server: {
      host: '0.0.0.0',
      strictPort: false,
      proxy: devProxy,
    },
    output: {
      // Production optimizations
      minify: isProd,
      target: 'web',
      distPath: {
        root: 'dist',
      },
      // Rely on Rsbuild default legalComments ("linked" → per-chunk *.LICENSE.txt) in all modes.
      // Do not set "none" in production: that strips minifier-preserved third-party notices and
      // extracted license files, which some distributions require for open-source compliance.
    },
    performance: {
      // Remove console in production
      removeConsole: isProd ? ['log'] : false,
      // Speed up repeated `rsbuild build` (local + CI when node_modules/.cache is preserved).
      // @see https://v2.rsbuild.dev/config/performance/build-cache
      buildCache: {
        cacheDigest: [process.env.VITE_REACT_APP_VERSION],
      },
    },
    tools: {
      rspack: {
        plugins: [
          tanstackRouter({
            target: 'react',
            // Dev: avoid per-route async chunks (reduces white flash on navigation + faster HMR feedback).
            // Prod: keep route-based code splitting.
            autoCodeSplitting: isProd,
          }),
        ],
      },
    },
  }
})
