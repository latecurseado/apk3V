/* Genera los assets fuente para @capacitor/assets (icono + splash) con sharp.
   Marca Tres Valles: terracota cálido + monograma "T" serif (igual que el logo).
   Reemplaza assets/icon-only.png por tu logo 1024x1024 y re-corre si quieres. */
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const ASSETS = path.join(__dirname, '..', 'assets');
fs.mkdirSync(ASSETS, { recursive: true });

const AMBER = '#e8893f';
const TERRA = '#b8331f';

// Monograma blanco (para foreground adaptativo + icono pleno)
const monogramSvg = (size, withBg) => `
<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${AMBER}"/><stop offset="1" stop-color="${TERRA}"/>
    </linearGradient>
  </defs>
  ${withBg ? `<rect width="${size}" height="${size}" rx="${size * 0.22}" fill="url(#g)"/>` : ''}
  <text x="50%" y="54%" font-family="Georgia, 'Times New Roman', serif" font-size="${size * 0.62}"
        font-weight="700" fill="#fff8ef" text-anchor="middle" dominant-baseline="middle">T</text>
</svg>`;

const splashSvg = (w, h, dark) => `
<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${w}" height="${h}" fill="${dark ? '#17150f' : '#f7f3ec'}"/>
  <g transform="translate(${w / 2}, ${h / 2})">
    <rect x="-220" y="-220" width="440" height="440" rx="120"
          fill="${dark ? '#221f19' : '#fff'}"/>
    <text x="0" y="20" font-family="Georgia, serif" font-size="300" font-weight="700"
          fill="${dark ? '#e8893f' : '#c2410c'}" text-anchor="middle" dominant-baseline="middle">T</text>
    <text x="0" y="330" font-family="Georgia, serif" font-size="74" font-weight="600"
          fill="${dark ? '#f3eee6' : '#1c1916'}" text-anchor="middle">Tres Valles</text>
  </g>
</svg>`;

async function run() {
    await sharp(Buffer.from(monogramSvg(1024, true))).png().toFile(path.join(ASSETS, 'icon-only.png'));
    await sharp(Buffer.from(monogramSvg(1024, false))).png().toFile(path.join(ASSETS, 'icon-foreground.png'));
    await sharp({ create: { width: 1024, height: 1024, channels: 4, background: TERRA } })
        .png().toFile(path.join(ASSETS, 'icon-background.png'));
    await sharp(Buffer.from(splashSvg(2732, 2732, false))).png().toFile(path.join(ASSETS, 'splash.png'));
    await sharp(Buffer.from(splashSvg(2732, 2732, true))).png().toFile(path.join(ASSETS, 'splash-dark.png'));
    console.log('Assets fuente generados en astro-poc/assets/');
}
run().catch(e => { console.error(e); process.exit(1); });
