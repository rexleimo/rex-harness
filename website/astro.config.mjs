import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';
import sitemap from '@astrojs/sitemap';

// GitHub Pages project site with custom domain (Pages serves custom domains at root):
// https://harness.rexai.top/  (github.io/rex-harness 301-redirects here)
export default defineConfig({
  site: 'https://harness.rexai.top',
  trailingSlash: 'ignore',
  output: 'static',
  i18n: {
    defaultLocale: 'en',
    locales: ['en', 'zh'],
    routing: { prefixDefaultLocale: false },
  },
  integrations: [
    sitemap({
      i18n: {
        defaultLocale: 'en',
        locales: { en: 'en', zh: 'zh-CN' },
      },
    }),
  ],
  vite: {
    plugins: [tailwindcss()],
  },
});
