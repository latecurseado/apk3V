import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
    appId: 'mx.tresvalles.app',
    appName: 'Tres Valles',
    // Empaquetamos el build estático de Astro (no es un webview del sitio remoto,
    // así pasa revisión de tiendas y funciona offline el shell). La app sigue
    // hablando con Supabase por red.
    webDir: 'dist',
    server: {
        androidScheme: 'https',
        iosScheme: 'https',
    },
    ios: {
        contentInset: 'always',
    },
    android: {
        // permite el plugin de teclado/cámara, etc. sin sorpresas
        allowMixedContent: false,
    },
};

export default config;
