import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import pkg from './package.json' with { type: 'json' }

// GitHub Pages serves this repo at https://<domain>/<repo-name>/, so every
// asset URL has to start with the repo name. package.json "name" is the repo name.
export default defineConfig({
  base: `/${pkg.name}/`,
  plugins: [react()],
  server: process.env.PORT ? { port: Number(process.env.PORT), strictPort: true } : {},
  test: { environment: 'node', include: ['src/**/*.test.{ts,tsx,js,jsx}'] },
  // each position's ledger in its own chunk: the QB file loads with the page, the rest on demand
  build: {
    rolldownOptions: {
      output: { codeSplitting: { groups: [{ name: 'ledger-qb', test: /src[\\/]data[\\/]QB\.json/ }] } },
    },
  },
})
