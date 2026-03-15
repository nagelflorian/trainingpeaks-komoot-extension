import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import webExtension from 'vite-plugin-web-extension'

export default defineConfig({
  plugins: [
    tailwindcss(),
    react(),
    webExtension({
      manifest: 'public/manifest.json',
      additionalInputs: [
        'src/content/index.ts',
      ],
    }),
  ],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
})
