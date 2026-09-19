// Writes the images that need a stable, unhashed address, into public/.
//
// Astro fingerprints everything it optimizes (/_astro/logo-modern.<hash>.png),
// which is right for the page but wrong for anything the outside world keeps a
// copy of: the JSON-LD logo, the Open Graph card, and the /images/... paths the
// old static site published. Those live in public/ instead, generated once from
// the same sources in src/assets/images/ and committed.
//
// Run it again after replacing a source image:  node scripts/make-static-images.mjs
import sharp from 'sharp';
import { mkdirSync, rmSync, statSync } from 'node:fs';
import { resolve } from 'node:path';

const SRC = resolve('src/assets/images');
const OUT = resolve('public/images');
mkdirSync(OUT, { recursive: true });

/** Nothing committed here is allowed past this. */
const BUDGET = 300 * 1024;

const report = (label, path) => {
  const bytes = statSync(path).size;
  const over = bytes > BUDGET ? '  OVER BUDGET' : '';
  console.log(`${label.padEnd(28)} ${(bytes / 1024).toFixed(1)} KB${over}`);
  return bytes;
};

// 1. The logo, at the size the JSON-LD and any outside consumer needs.
const logoOut = resolve(OUT, 'logo-modern.png');
await sharp(resolve(SRC, 'logo-modern.png'))
  .resize({ width: 600 })
  .png({ compressionLevel: 9, palette: true, quality: 90 })
  .toFile(logoOut);
report('images/logo-modern.png', logoOut);

// 2. The hero, kept only if it fits the budget as a PNG. It does not: at 1024px
//    wide the best palette PNG is around 380 KB, and a JPEG renamed .png is not
//    an option, so the file is dropped again. Nothing outside the site links to
//    it; the page uses the optimized Astro version, and the social card below is
//    what gets shared.
const heroOut = resolve(OUT, 'hero-modern.png');
await sharp(resolve(SRC, 'hero-modern.png'))
  .resize({ width: 1024, withoutEnlargement: true })
  .png({ compressionLevel: 9, palette: true, quality: 80, effort: 10 })
  .toFile(heroOut);
if (report('images/hero-modern.png', heroOut) > BUDGET) {
  rmSync(heroOut);
  console.log('  -> dropped: over the budget as a PNG, and it must stay a PNG.');
}

// 3. The social card: the brand lockup on white over the Med-to-Tech gradient
//    rule. The wordmark is the logo file itself, so nothing here depends on a
//    font being installed on the machine that runs this script.
const CARD_W = 1200;
const CARD_H = 630;
const LOGO_W = 760;
const LOGO_H = Math.round((LOGO_W * 600) / 1830);

const background = Buffer.from(
  `<svg xmlns="http://www.w3.org/2000/svg" width="${CARD_W}" height="${CARD_H}">
     <defs>
       <linearGradient id="lockup" x1="0" y1="0" x2="1" y2="1">
         <stop offset="0%" stop-color="#00A69C"/>
         <stop offset="100%" stop-color="#3B5BDB"/>
       </linearGradient>
     </defs>
     <rect width="${CARD_W}" height="${CARD_H}" fill="#FFFFFF"/>
     <rect x="0" y="${CARD_H - 22}" width="${CARD_W}" height="22" fill="url(#lockup)"/>
   </svg>`
);

const logoLayer = await sharp(resolve(SRC, 'logo-modern.png'))
  .resize({ width: LOGO_W })
  .png()
  .toBuffer();

const cardOut = resolve('public/og-image.png');
await sharp(background)
  .composite([
    {
      input: logoLayer,
      left: Math.round((CARD_W - LOGO_W) / 2),
      top: Math.round((CARD_H - 22 - LOGO_H) / 2),
    },
  ])
  .png({ compressionLevel: 9, palette: true, quality: 90 })
  .toFile(cardOut);
report('og-image.png', cardOut);
