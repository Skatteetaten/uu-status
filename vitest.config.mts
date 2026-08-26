import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

/**
 * Egen konfig for vitest, adskilt fra vite.config.mts: byggkonfigen har
 * root: 'app' og egne plugins for datafiler og CSP som testene ikke trenger.
 *
 * environment er node med vilje – testene bruker renderToStaticMarkup, som
 * ikke trenger noen DOM. Det holder jsdom og alt som følger med utenfor
 * avhengighetstreet.
 */
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'node',
    include: ['app/**/*.test.{ts,tsx}'],
    server: {
      deps: {
        // Designsystempakkene importerer .css direkte. Node kan ikke laste
        // css; inlines de i vites pipeline blir importene stubbet i test.
        inline: [/@skatteetaten\//],
      },
    },
  },
});
