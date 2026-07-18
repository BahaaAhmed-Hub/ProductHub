/** ProductHub's brand mark — a hexagon traced by a single continuous
 * zigzag stroke (columns/crown motif). Renders in `currentColor`, so
 * callers set size via `size` and color via a text-* class. */
export function Logo({ size = 24, className }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 90 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden
    >
      <path
        d="M4.5,50 L18,15 L27,30 L36,15 L45,30 L54,15 L63,30 L72,15 L85.5,50 L72,85 L63,70 L54,85 L45,70 L36,85 L27,70 L18,85 Z"
        stroke="currentColor"
        strokeWidth="6"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}
