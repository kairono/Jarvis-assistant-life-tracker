import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { viteSingleFile } from 'vite-plugin-singlefile'
import { fileURLToPath } from 'node:url'

// https://vite.dev/config/
// `vite build --mode artifact` emits ONE self-contained HTML file
// (dist-artifact/index.html) that is published as a claude.ai artifact.
export default defineConfig(({ mode }) => {
  const artifact = mode === 'artifact'
  return {
    plugins: artifact
      ? [
          react(),
          viteSingleFile(),
          {
            // The artifact gets its tab icon from claude.ai; drop the file link.
            name: 'jarvis-artifact-html',
            transformIndexHtml: (html: string) =>
              html
                .replace(/\s*<link rel="icon"[^>]*>/, '')
                .replace(/<title>.*<\/title>/, '<title>Jarvis</title>'),
          },
        ]
      : [react()],
    resolve: artifact
      ? {
          alias: [
            {
              find: /^\.\/IndexedDbStore$/,
              replacement: fileURLToPath(new URL('./src/lib/db/IndexedDbStore.artifact.ts', import.meta.url)),
            },
          ],
        }
      : undefined,
    build: artifact
      ? { outDir: 'dist-artifact', assetsInlineLimit: 100_000_000, cssCodeSplit: false, minify: true }
      : undefined,
  }
})
