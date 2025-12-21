import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode, command }) => {
    const env = loadEnv(mode, '.', '');
    const isProduction = mode === 'production';
    return {
      base: command === 'serve' ? '/' : '/app/',
      server: {
        port: 3000,
        host: '0.0.0.0',
        proxy: {
          '/api': {
            target: 'http://localhost:3000',
            changeOrigin: true,
          },
        },
      },
      plugins: [
        react(),
        {
          name: 'multi-base-plugin',
          transformIndexHtml: {
            enforce: 'post',
            transform(html, ctx) {
              // Для owner.html используем /owner/ вместо /app/
              if (ctx.filename.includes('owner.html')) {
                return html.replace(/\/app\/assets\//g, '/owner/assets/');
              }
              return html;
            }
          }
        }
      ],
      build: {
        rollupOptions: {
          input: {
            main: path.resolve(__dirname, 'index.html'),
            owner: path.resolve(__dirname, 'owner.html'),
          },
          output: {
            entryFileNames: (chunkInfo) => {
              return chunkInfo.name === 'owner' 
                ? 'assets/[name]-[hash].js'
                : 'assets/[name]-[hash].js';
            },
          },
        },
      },
      define: {
        'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});
