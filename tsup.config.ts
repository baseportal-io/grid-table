import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'],
  outDir: 'dist',
  outExtension: ({ format }) => ({
    js: format === 'esm' ? '.esm.js' : '.cjs.js'
  }),
  dts: true,
  sourcemap: true,
  clean: true,
  target: 'es2020',
  platform: 'browser',
  // Everything below is provided by the consuming app (Next client) or by
  // glide's own peer deps that get hoisted alongside it.
  external: [
    'react',
    'react-dom',
    'react/jsx-runtime',
    '@glideapps/glide-data-grid',
    '@glideapps/glide-data-grid-cells',
    'lodash',
    'marked',
    'react-responsive-carousel'
  ],
  // The whole package renders on the client; mark it so Next's app router
  // doesn't try to run it in a server component.
  banner: { js: "'use client';" },
  esbuildOptions(options) {
    options.jsx = 'automatic'
  }
})
