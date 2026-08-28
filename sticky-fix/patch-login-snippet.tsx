/** Replace login QR block — true circle mask, not rounded-corner square img */
<div className="flex flex-col items-center gap-2 pt-2">
  <div className="relative w-36 h-36 rounded-full overflow-hidden border border-[#00FF9D]/30 shadow-[0_0_24px_rgba(0,255,157,0.15)]">
    {/* eslint-disable-next-line @next/next/no-img-element */}
    <img
      src="/api/qr"
      alt="STICKY round QR"
      className="w-full h-full object-cover scale-105"
    />
  </div>
  <a href="/qr" className="text-[10px] font-bold tracking-[0.14em] uppercase text-[#00FF9D]/80">
    Round QR · print page
  </a>
</div>
