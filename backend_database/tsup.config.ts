import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/**/*.ts'],  // Transpile all TS files
  format: ['esm'],
  clean: true,
  minify: false,  
  // Keep directory structure, don't bundle into single file
  bundle: false,
  outDir: 'dist',
  platform: 'node',
  target: 'node18',
  splitting: false,
  sourcemap: false,
  skipNodeModulesBundle: true,  // Never bundle node_modules
});
