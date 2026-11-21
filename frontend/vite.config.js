import { cpSync } from 'node:fs'
import { resolve } from 'node:path'
import { defineConfig } from 'vite'

export default defineConfig({
  // JSX automático: los componentes no necesitan importar React.
  esbuild: { jsx: 'automatic' },
  server: { proxy: { '/api': 'http://127.0.0.1:8000' } },
  plugins: [{
    name: 'recursos-de-pdfjs',
    writeBundle({ dir }) {
      for (const carpeta of ['cmaps', 'standard_fonts', 'wasm', 'iccs']) {
        cpSync(resolve('node_modules/pdfjs-dist', carpeta), resolve(dir, 'pdfjs', carpeta), { recursive: true })
      }
    },
  }],
})
