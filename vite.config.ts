import { defineConfig } from 'vite';

// Static-deployable build (GitHub Pages / Netlify / itch.io).
// `base: './'` keeps asset URLs relative so the build works from any subpath.
export default defineConfig({
  base: './',
  build: {
    target: 'es2020',
    assetsInlineLimit: 0,
  },
  server: {
    host: true,
    port: 5173,
  },
});
