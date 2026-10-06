import react from '@vitejs/plugin-react';
import * as path from 'path';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

import pkg from './package.json' with { type: 'json' };

// 内核地址。Clash Verge Rev 开启外部控制后，内核默认就在这个地址上
const CLASH_API_TARGET = process.env.CLASH_API_TARGET ?? 'http://127.0.0.1:9097';

// 内核 REST/WS 接口全部是顶层路径。把它们在 dev/preview server 上按同源转发到内核，
// 浏览器只和面板端口通信，既不需要内核 CORS 白名单，也不用暴露 9097。
const CLASH_API_PATHS = [
  '/version',
  '/configs',
  '/proxies',
  '/group',
  '/providers',
  '/rules',
  '/connections',
  '/traffic',
  '/logs',
  '/memory',
  '/restart',
  '/upgrade',
  '/cache',
];

const clashAPIProxy = Object.fromEntries(
  CLASH_API_PATHS.map((p) => [
    p,
    { target: CLASH_API_TARGET, changeOrigin: true, ws: true },
  ]),
);

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  define: {
    __VERSION__: JSON.stringify(pkg.version),
  },
  base: './',
  server: {
    host: '127.0.0.1',
    port: 3000,
    proxy: clashAPIProxy,
  },
  preview: {
    host: '127.0.0.1',
    port: 3000,
    proxy: clashAPIProxy,
  },
  resolve: {
    alias: {
      '~': path.resolve(import.meta.dirname, './src'),
    },
  },
  publicDir: 'assets',
  build: {
    // sourcemap: true,
    // the default value is 'dist'
    // which make more sense
    // but change this may break other people's tools
    outDir: 'public',
  },
  plugins: [
    react(),
    VitePWA({
      srcDir: 'src',
      outDir: 'public',
      filename: 'sw.ts',
      strategies: 'injectManifest',
      base: './',
      manifest: {
        icons: [
          {
            src: 'apple-touch-icon-precomposed.png',
            sizes: '512x512',
            type: 'image/png',
          },
        ],
      },
    }),
  ],
}));
