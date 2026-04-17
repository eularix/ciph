import { defineConfig } from 'vite'
import react, { reactCompilerPreset } from '@vitejs/plugin-react'
import babel from '@rolldown/plugin-babel'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    babel({ presets: [reactCompilerPreset()] })
  ], 
  define: {
    global: 'globalThis',
  },
  build: {
    rollupOptions: {
      external: [],
    },
  },
  optimizeDeps: {
    esbuildOptions: {
      define: {
        global: 'globalThis',
      },
      plugins: [
        {
          name: 'node-crypto-polyfill',
          setup(build) {
            build.onResolve({ filter: /^(node:)?crypto$/ }, () => ({
              path: 'virtual:crypto-polyfill',
              namespace: 'virtual',
            }))
            build.onLoad({ filter: /.*/, namespace: 'virtual' }, () => ({
              contents: `export const webcrypto = globalThis.crypto; export default { webcrypto: globalThis.crypto }`,
              loader: 'js',
            }))
          },
        },
      ],
    },
  },
})
