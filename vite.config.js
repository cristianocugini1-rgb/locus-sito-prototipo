import { resolve } from 'path';
import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  server: { port: 5180, host: true },
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        chiSiamo: resolve(__dirname, 'chi-siamo.html'),
        testAudio: resolve(__dirname, 'test-audio.html'),
        articolo: resolve(__dirname, 'articolo.html'),
        diario: resolve(__dirname, 'diario.html'),
        gestione: resolve(__dirname, 'gestione.html'),
      },
    },
  },
});
