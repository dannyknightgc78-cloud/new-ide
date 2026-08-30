type Props = {
  size?: 'sm' | 'md' | 'lg' | 'hero';
  showWordmark?: boolean;
  tagline?: boolean;
  className?: string;
  onMarkClick?: () => void;
};

const SIZES = {
  sm: 'w-8 h-8',
  md: 'w-12 h-12',
  lg: 'w-16 h-16',
  hero: 'w-20 h-20',
} as const;

const TITLE = {
  sm: 'text-sm',
  md: 'text-xl',
  lg: 'text-3xl',
  hero: 'text-4xl',
} as const;

export default function BrandMark({
  size = 'md',
  showWordmark = true,
  tagline = false,
  className = '',
  onMarkClick,
}: Props) {
  const mark = (
    <img
      src="/icon.svg"
      alt=""
      className={`${SIZES[size]} rounded-2xl shadow-[0_0_28px_rgba(201,168,76,0.28)] object-cover`}
      draggable={false}
    />
  );

  return (
    <div className={`flex flex-col items-center ${className}`}>
      {onMarkClick ? (
        <button type="button" onClick={onMarkClick} className="focus:outline-none" aria-label="Queendar">
          {mark}
        </button>
      ) : (
        mark
      )}
      {showWordmark && (
        <h1 className={`font-display font-bold tracking-[0.04em] text-[#f3e6b5] mt-3 ${TITLE[size]}`}>
          Queendar
        </h1>
      )}
      {tagline && (
        <p className="font-sans text-sm text-[#c9a84c] mt-1.5 tracking-wide text-center">
          You have radar. We have Queendar.
        </p>
      )}
    </div>
  );
}
