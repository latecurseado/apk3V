import { defineConfig } from 'astro/config';
import preact from '@astrojs/preact';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
    site: 'https://tresvalles.pages.dev',
    // compat: true → alias react/react-dom a preact/compat (necesario para @dnd-kit)
    integrations: [preact({ compat: true })],
    vite: { plugins: [tailwindcss()] },
    build: { inlineStylesheets: 'auto' },
});
