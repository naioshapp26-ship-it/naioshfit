import sharp from 'sharp';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const publicDir = join(__dirname, '../client/public');

async function optimizeLogo(inputFile, outputFile, size, quality = 85) {
  try {
    const info = await sharp(join(publicDir, inputFile))
      .resize(size, size, { 
        fit: 'contain',
        background: { r: 255, g: 255, b: 255, alpha: 0 }
      })
      .jpeg({ 
        quality, 
        progressive: true,
        mozjpeg: true 
      })
      .toFile(join(publicDir, outputFile));
    
    const originalSize = fs.statSync(join(publicDir, inputFile)).size;
    console.log(`✅ ${inputFile} (${(originalSize / 1024).toFixed(1)}KB) → ${outputFile} (${(info.size / 1024).toFixed(1)}KB)`);
    console.log(`   Reduction: ${((1 - info.size / originalSize) * 100).toFixed(1)}%`);
  } catch (err) {
    console.error(`❌ Error optimizing ${inputFile}:`, err.message);
  }
}

async function optimizeLogoPNG(inputFile, outputFile, size) {
  try {
    const info = await sharp(join(publicDir, inputFile))
      .resize(size, size, { 
        fit: 'contain',
        background: { r: 255, g: 255, b: 255, alpha: 0 }
      })
      .webp({ 
        quality: 90,
        effort: 6
      })
      .toFile(join(publicDir, outputFile));
    
    const originalSize = fs.statSync(join(publicDir, inputFile)).size;
    console.log(`✅ ${inputFile} (${(originalSize / 1024).toFixed(1)}KB) → ${outputFile} (${(info.size / 1024).toFixed(1)}KB)`);
    console.log(`   Reduction: ${((1 - info.size / originalSize) * 100).toFixed(1)}%`);
  } catch (err) {
    console.error(`❌ Error optimizing ${inputFile}:`, err.message);
  }
}

console.log('🔄 Optimizing logos...\n');

// Optimize the main JPG logo - reduce to 128x128 (good for navigation)
await optimizeLogo('naioshfit-logo.jpg', 'naioshfit-logo-optimized.jpg', 128, 85);

// Optimize the PNG logo - convert to WebP for better compression
await optimizeLogoPNG('naioshfit-logo-new.png', 'naioshfit-logo-new.webp', 256);

console.log('\n✨ Logo optimization complete!');
