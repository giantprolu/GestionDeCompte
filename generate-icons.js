const sharp = require('sharp');
const path = require('path');

const svgContent = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="64" fill="#0f172a"/>
  <circle cx="256" cy="220" r="120" fill="none" stroke="#10b981" stroke-width="16"/>
  <path d="M256 120 L256 220 L336 220" fill="none" stroke="#10b981" stroke-width="16" stroke-linecap="round"/>
  <circle cx="256" cy="220" r="16" fill="#10b981"/>
  <text x="256" y="420" text-anchor="middle" fill="#10b981" font-size="80" font-weight="bold" font-family="Arial, sans-serif">€</text>
</svg>`;

async function generateIcons() {
  const publicDir = path.join(__dirname, 'public');
  
  // Generate 192x192
  await sharp(Buffer.from(svgContent))
    .resize(192, 192)
    .png()
    .toFile(path.join(publicDir, 'icon-192x192.png'));
  
  
  // Generate 512x512
  await sharp(Buffer.from(svgContent))
    .resize(512, 512)
    .png()
    .toFile(path.join(publicDir, 'icon-512x512.png'));
  
  
  // Generate favicon
  await sharp(Buffer.from(svgContent))
    .resize(32, 32)
    .png()
    .toFile(path.join(publicDir, 'favicon.png'));
  
}

generateIcons().catch(console.error);
