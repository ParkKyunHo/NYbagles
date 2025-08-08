#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Simple SVG icon
const svgIcon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" fill="#3B82F6"/>
  <circle cx="256" cy="256" r="200" fill="white"/>
  <text x="256" y="320" font-family="Arial" font-size="200" font-weight="bold" text-anchor="middle" fill="#3B82F6">B</text>
</svg>`;

// Save base SVG
const iconsDir = path.join(__dirname, '..', 'public', 'icons');
fs.writeFileSync(path.join(iconsDir, 'icon.svg'), svgIcon);

// Generate PNG placeholders (actual PNGs would need a library like sharp or canvas)
const sizes = [72, 96, 128, 144, 192, 384, 512];

sizes.forEach(size => {
  // Create a simple placeholder PNG (1x1 pixel, blue)
  // This is a minimal valid PNG file
  const png = Buffer.from([
    0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, // PNG signature
    0x00, 0x00, 0x00, 0x0D, // IHDR chunk size
    0x49, 0x48, 0x44, 0x52, // IHDR
    0x00, 0x00, 0x00, 0x01, // width: 1
    0x00, 0x00, 0x00, 0x01, // height: 1
    0x08, 0x02, // bit depth: 8, color type: 2 (RGB)
    0x00, 0x00, 0x00, // compression, filter, interlace
    0x90, 0x77, 0x53, 0xDE, // CRC
    0x00, 0x00, 0x00, 0x0C, // IDAT chunk size
    0x49, 0x44, 0x41, 0x54, // IDAT
    0x08, 0x99, 0x01, 0x01, 0x00, 0x00, 0xFE, 0xFF, 0x00, 0x00, 0x00, 0x02, // compressed data
    0x00, 0x01, // more compressed data
    0x8F, 0xC4, 0x23, 0x0C, // CRC
    0x00, 0x00, 0x00, 0x00, // IEND chunk size
    0x49, 0x45, 0x4E, 0x44, // IEND
    0xAE, 0x42, 0x60, 0x82  // CRC
  ]);
  
  fs.writeFileSync(path.join(iconsDir, `icon-${size}x${size}.png`), png);
});

console.log('Icons generated successfully!');