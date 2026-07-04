/**
 * Spinner component — Stitch-consistent loading indicator.
 */
export default function Spinner({ size = 'md', className = '' }) {
  const sizes = {
    sm: 'w-4 h-4 border-2',
    md: 'w-8 h-8 border-[3px]',
    lg: 'w-12 h-12 border-[3px]',
  };

  return (
    <div
      className={`${sizes[size]} border-outline-variant border-t-navy rounded-full animate-spin ${className}`}
      role="status"
      aria-label="Loading"
    />
  );
}
