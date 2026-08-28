import QRCode from 'qrcode';

const MINT = '#00FF9D';
const CYAN = '#00F0FF';
const INK = '#08090C';

type QrMatrix = { modules: { get: (x: number, y: number) => unknown; size: number } };

function moduleAt(qr: QrMatrix, x: number, y: number) {
  return Boolean(qr.modules.get(x, y));
}

function inFinder(x: number, y: number, n: number) {
  const box = (ox: number, oy: number) => x >= ox && x < ox + 7 && y >= oy && y < oy + 7;
  return box(0, 0) || box(n - 7, 0) || box(0, n - 7);
}

function polar(cx: number, cy: number, r: number, angle: number) {
  return { x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle) };
}

function arcPath(cx: number, cy: number, r: number, a0: number, a1: number) {
  const s = polar(cx, cy, r, a0);
  const e = polar(cx, cy, r, a1);
  const large = a1 - a0 > Math.PI ? 1 : 0;
  return `M ${s.x.toFixed(2)} ${s.y.toFixed(2)} A ${r.toFixed(2)} ${r.toFixed(2)} 0 ${large} 1 ${e.x.toFixed(2)} ${e.y.toFixed(2)}`;
}

/** True circular QR: concentric rings + arc segments (not a square grid with rounded corners). */
export function generateStickyCircularQr(text: string, opts?: { size?: number; badge?: string }) {
  const qr = QRCode.create(String(text || 'https://getsticky.men/onboarding'), {
    errorCorrectionLevel: 'H',
  });
  const n = qr.modules.size;
  const size = opts?.size || 720;
  const badge = opts?.badge || 'S';
  const cx = size / 2;
  const cy = size / 2;
  const outerR = size / 2 - 28;
  const badgeR = outerR * 0.17;
  const innerR = badgeR + 18;
  const ringCount = Math.max(18, Math.floor(n * 0.85));
  const ringStep = (outerR - innerR) / ringCount;
  const strokeW = Math.max(5.5, ringStep * 0.72);
  const dotR = Math.max(3, ringStep * 0.34);

  type Slot = { ring: number; angle: number };
  const slots: Slot[] = [];

  for (let y = 0; y < n; y += 1) {
    for (let x = 0; x < n; x += 1) {
      if (!moduleAt(qr, x, y) || inFinder(x, y, n)) continue;
      const px = ((x + 0.5) / n) * size;
      const py = ((y + 0.5) / n) * size;
      const dx = px - cx;
      const dy = py - cy;
      const dist = Math.hypot(dx, dy);
      if (dist >= outerR - 2 || dist <= innerR) continue;
      const ring = Math.min(ringCount - 1, Math.max(0, Math.round((dist - innerR) / ringStep)));
      slots.push({ ring, angle: Math.atan2(dy, dx) });
    }
  }

  const byRing = new Map<number, number[]>();
  for (const s of slots) {
    const list = byRing.get(s.ring) || [];
    list.push(s.angle);
    byRing.set(s.ring, list);
  }

  const parts: string[] = [];
  parts.push(`<defs><clipPath id="sticky-disc"><circle cx="${cx}" cy="${cy}" r="${outerR + 2}"/></clipPath></defs>`);
  parts.push(`<circle cx="${cx}" cy="${cy}" r="${outerR + 2}" fill="${INK}"/>`);
  parts.push(`<circle cx="${cx}" cy="${cy}" r="${outerR + 10}" fill="none" stroke="${MINT}" stroke-width="2.5" opacity="0.7"/>`);
  parts.push(`<circle cx="${cx}" cy="${cy}" r="${outerR + 18}" fill="none" stroke="${CYAN}" stroke-width="1" opacity="0.35"/>`);
  parts.push(`<g clip-path="url(#sticky-disc)">`);

  // Concentric data rings — arc segments where neighbours share a ring
  for (const ring of [...byRing.keys()].sort((a, b) => a - b)) {
    const angles = (byRing.get(ring) || []).sort((a, b) => a - b);
    if (!angles.length) continue;
    const r = innerR + ring * ringStep;
    let runStart = angles[0];
    let prev = angles[0];
    const gap = Math.max(0.08, (2 * Math.PI) / (angles.length * 3));

    const flush = (start: number, end: number) => {
      if (end - start < 0.02) {
        const p = polar(cx, cy, r, (start + end) / 2);
        parts.push(`<circle cx="${p.x.toFixed(2)}" cy="${p.y.toFixed(2)}" r="${dotR.toFixed(2)}" fill="${MINT}"/>`);
        return;
      }
      parts.push(
        `<path d="${arcPath(cx, cy, r, start - 0.02, end + 0.02)}" fill="none" stroke="${MINT}" stroke-width="${strokeW.toFixed(2)}" stroke-linecap="round"/>`,
      );
    };

    for (let i = 1; i < angles.length; i += 1) {
      const a = angles[i];
      if (a - prev <= gap) {
        prev = a;
        continue;
      }
      flush(runStart, prev);
      runStart = a;
      prev = a;
    }
    flush(runStart, prev);
  }

  // Circular finder eyes (3 corners on the disc, not square blocks)
  const finderAngles = [(-3 * Math.PI) / 4, -Math.PI / 4, Math.PI / 2];
  for (const base of finderAngles) {
    const fr = outerR - ringStep * 1.5;
    for (let k = 0; k < 3; k += 1) {
      const r = fr - k * ringStep * 1.15;
      const span = Math.PI / 4.8;
      parts.push(
        `<path d="${arcPath(cx, cy, r, base - span, base + span)}" fill="none" stroke="${MINT}" stroke-width="${(strokeW * 1.05).toFixed(2)}" stroke-linecap="round"/>`,
      );
      if (k === 2) {
        const c = polar(cx, cy, r, base);
        parts.push(`<circle cx="${c.x.toFixed(2)}" cy="${c.y.toFixed(2)}" r="${dotR * 1.35}" fill="${MINT}"/>`);
      }
    }
  }

  parts.push(`<circle cx="${cx}" cy="${cy}" r="${badgeR}" fill="${INK}" stroke="${MINT}" stroke-width="3"/>`);
  parts.push(`<circle cx="${cx}" cy="${cy}" r="${badgeR * 0.78}" fill="rgba(0,255,157,0.12)"/>`);
  const glyph = badgeR * 0.95;
  parts.push(
    `<text x="${cx}" y="${cy + glyph * 0.34}" text-anchor="middle" font-size="${glyph}" fill="${CYAN}" font-family="ui-sans-serif, system-ui, sans-serif" font-weight="900">${badge}</text>`,
  );
  parts.push('</g>');

  return `<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">${parts.join('')}</svg>\n`;
}
