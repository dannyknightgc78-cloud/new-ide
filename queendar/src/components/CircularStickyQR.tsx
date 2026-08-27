import { useEffect, useMemo, useRef, useState, type ReactElement } from 'react';
import QRCode from 'qrcode';
import { Crown, Download, X } from 'lucide-react';

const DEFAULT_URL = 'https://queendar.com';
const MODULE_GAP = 0.18;

type Props = {
  url?: string;
  className?: string;
};

type RenderModel = {
  view: number;
  pad: number;
  cx: number;
  cy: number;
  outerR: number;
  logoX: number;
  logoY: number;
  logoSize: number;
  dots: ReactElement[];
};

function buildDots(matrix: boolean[][]): RenderModel {
  const n = matrix.length;
  const cx = (n - 1) / 2;
  const cy = (n - 1) / 2;
  const outerR = n / 2 - 0.2;
  const logoClearR = n * 0.18;
  const view = n + 2;
  const pad = 1;
  const dots: ReactElement[] = [];

  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      const dx = c + 0.5 - (cx + 0.5);
      const dy = r + 0.5 - (cy + 0.5);
      if (dx * dx + dy * dy > outerR * outerR) continue;
      if (dx * dx + dy * dy < logoClearR * logoClearR) continue;
      if (!matrix[r][c]) continue;
      const s = 1 - MODULE_GAP;
      dots.push(
        <rect
          key={`${r}-${c}`}
          x={c + pad + MODULE_GAP / 2}
          y={r + pad + MODULE_GAP / 2}
          width={s}
          height={s}
          rx={s * 0.45}
          ry={s * 0.45}
          fill="#0a0a0a"
        />,
      );
    }
  }

  const logoSize = logoClearR * 1.55;
  const logoX = cx + pad + 0.5 - logoSize / 2;
  const logoY = cy + pad + 0.5 - logoSize / 2;

  return { view, pad, cx, cy, outerR, logoX, logoY, logoSize, dots };
}

function CrownMark({ render }: { render: RenderModel }) {
  return (
    <g
      transform={`translate(${render.logoX + render.logoSize * 0.18}, ${
        render.logoY + render.logoSize * 0.22
      }) scale(${render.logoSize / 14})`}
    >
      <path d="M2 14h12l-1-7-3 3-2-5-2 5-3-3-1 7z" fill="#c9a84c" />
      <circle cx="2" cy="6" r="1.1" fill="#c9a84c" />
      <circle cx="8" cy="3.5" r="1.1" fill="#c9a84c" />
      <circle cx="14" cy="6" r="1.1" fill="#c9a84c" />
    </g>
  );
}

function QrFace({
  render,
  svgRef,
}: {
  render: RenderModel;
  svgRef?: React.RefObject<SVGSVGElement>;
}) {
  return (
    <svg
      ref={svgRef as React.Ref<SVGSVGElement>}
      viewBox={`0 0 ${render.view} ${render.view}`}
      className="absolute inset-0 w-full h-full p-[6%]"
      xmlns="http://www.w3.org/2000/svg"
    >
      <circle cx={render.view / 2} cy={render.view / 2} r={render.outerR + 0.35} fill="#ffffff" />
      {render.dots}
      <circle
        cx={render.cx + render.pad + 0.5}
        cy={render.cy + render.pad + 0.5}
        r={render.logoSize / 2}
        fill="#ffffff"
        stroke="#c9a84c"
        strokeWidth={0.35}
      />
      <CrownMark render={render} />
    </svg>
  );
}

export default function CircularStickyQR({ url = DEFAULT_URL, className = '' }: Props) {
  const [matrix, setMatrix] = useState<boolean[][] | null>(null);
  const [open, setOpen] = useState(false);
  const downloadRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    const qr = QRCode.create(url, { errorCorrectionLevel: 'H' });
    const size = qr.modules.size;
    const data: boolean[][] = [];
    for (let y = 0; y < size; y++) {
      const row: boolean[] = [];
      for (let x = 0; x < size; x++) row.push(qr.modules.get(y, x) === 1);
      data.push(row);
    }
    setMatrix(data);
  }, [url]);

  const render = useMemo(() => (matrix ? buildDots(matrix) : null), [matrix]);

  const downloadPng = () => {
    const svg = downloadRef.current;
    if (!svg || !render) return;
    const clone = svg.cloneNode(true) as SVGSVGElement;
    clone.setAttribute('width', '1024');
    clone.setAttribute('height', '1024');
    clone.removeAttribute('class');
    const xml = new XMLSerializer().serializeToString(clone);
    const href = URL.createObjectURL(new Blob([xml], { type: 'image/svg+xml;charset=utf-8' }));
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = 1024;
      canvas.height = 1024;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, 1024, 1024);
      ctx.drawImage(img, 0, 0, 1024, 1024);
      canvas.toBlob((png) => {
        if (!png) return;
        const a = document.createElement('a');
        a.href = URL.createObjectURL(png);
        a.download = 'queendar-sticker-qr.png';
        a.click();
        URL.revokeObjectURL(a.href);
      });
      URL.revokeObjectURL(href);
    };
    img.src = href;
  };

  const StickerShell = ({
    sizeClass,
    interactive,
    withRef,
  }: {
    sizeClass: string;
    interactive?: boolean;
    withRef?: boolean;
  }) => (
    <div
      className={`relative ${sizeClass} rounded-full bg-white shadow-[0_8px_32px_rgba(0,0,0,0.45)] ring-2 ring-[#c9a84c]/70 ${
        interactive ? 'cursor-pointer transition-transform hover:scale-105 active:scale-95' : ''
      }`}
      onClick={interactive ? () => setOpen(true) : undefined}
      role={interactive ? 'button' : undefined}
      aria-label={interactive ? 'Open Queendar QR sticker' : undefined}
    >
      {render ? (
        <QrFace render={render} svgRef={withRef ? downloadRef : undefined} />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center">
          <Crown className="w-6 h-6 text-[#c9a84c] animate-pulse" />
        </div>
      )}
    </div>
  );

  return (
    <>
      <div className={`fixed z-40 bottom-[5.5rem] right-4 sm:bottom-8 sm:right-6 ${className}`}>
        <StickerShell sizeClass="w-[72px] h-[72px] sm:w-20 sm:h-20" interactive />
        <p className="mt-1.5 text-center text-[9px] font-semibold tracking-wide text-[#c9a84c]/90">
          Scan me
        </p>
      </div>

      {open && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-6"
          onClick={() => setOpen(false)}
        >
          <div
            className="relative w-full max-w-sm bg-[#0e0e0e] border border-[#222] rounded-3xl p-6 shadow-2xl animate-fade-in"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="absolute top-4 right-4 text-[#666] hover:text-white transition-colors"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex flex-col items-center text-center">
              <p className="text-[#c9a84c] text-xs font-bold tracking-[0.2em] uppercase mb-1">
                Queendar sticker
              </p>
              <h2 className="text-white text-xl font-black mb-5">Circular QR</h2>
              <div className="mb-5">
                <StickerShell sizeClass="w-56 h-56" withRef />
              </div>
              <p className="text-[#666] text-xs mb-5 max-w-[260px] leading-relaxed">
                Round sticker QR with the Queendar crown — download a PNG to print or share.
              </p>
              <button
                type="button"
                onClick={downloadPng}
                className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl bg-gradient-to-r from-[#c9a84c] to-[#e8c96a] text-[#080808] font-bold text-sm shadow-[0_0_24px_rgba(201,168,76,0.35)] hover:brightness-105 transition"
              >
                <Download className="w-4 h-4" />
                Download sticker PNG
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
