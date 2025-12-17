import { defineConfig } from 'tsup'

export default defineConfig({
  entry: [
    // Main entry with all triggers
    'src/index.ts',
    // Middy middleware (auto-detection)
    'src/middy.ts',
    // Auto-detection entry (includes all triggers)
    'src/entries/auto.ts',
    // Power user exports
    'src/entries/extractors.ts',
  ],
  format: ['cjs', 'esm'],
  dts: true,
  clean: true,
  sourcemap: true,
  target: 'node24',
  splitting: false,
  treeshake: true,
})
