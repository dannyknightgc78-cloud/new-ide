#!/usr/bin/env npx tsx
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { generateStickyCircularQr } from './circularQr';

const __dirname = dirname(fileURLToPath(import.meta.url));

const url = process.argv[2] || 'https://getsticky.men/onboarding';
const out = process.argv[3] || resolve(__dirname, 'out/sticky-circle-qr.svg');
const size = Number(process.env.QR_SIZE || 720);
const badge = process.env.QR_BADGE || 'S';

const svg = generateStickyCircularQr(url, { size, badge });

mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, svg, 'utf8');

const rings = (svg.match(/stroke-linecap="round"/g) || []).length;
const hasDisc = svg.includes('id="sticky-disc"');
const hasSquareGrid = svg.includes('<rect width="720" height="720" fill="#08090C"/>');

console.log(`✓ ${out}`);
console.log(`  url: ${url}`);
console.log(`  ${size}×${size} SVG · ${(svg.length / 1024).toFixed(1)} KB`);
console.log(`  concentric disc: ${hasDisc ? 'yes' : 'NO'}`);
console.log(`  arc segments: ${rings}`);
console.log(`  square grid: ${hasSquareGrid ? 'YES (old style)' : 'no'}`);
