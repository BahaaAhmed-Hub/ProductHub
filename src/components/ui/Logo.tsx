import logoUrl from '@/assets/logo.png';

/** ProductHub's brand mark, pulled from the FlowDesk design project
 * (assets/producthub-icon-tight.png) rather than redrawn — callers set
 * size via `size`; `className` is accepted for layout only (a raster image
 * ignores text-color utility classes, unlike the vector version this
 * replaced). */
export function Logo({ size = 24, className }: { size?: number; className?: string }) {
  return (
    <img
      src={logoUrl}
      width={size}
      height={size}
      alt="ProductHub"
      className={className}
      style={{ objectFit: 'contain' }}
    />
  );
}
