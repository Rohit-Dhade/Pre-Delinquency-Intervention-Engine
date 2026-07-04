/**
 * TierBadge — consistent risk tier badge across all pages.
 * Uses the tier color scale defined once in tiers.js.
 */
import { getTierConfig } from '../../utils/tiers';

export default function TierBadge({ tier, showLabel = false }) {
  const config = getTierConfig(tier);

  return (
    <span
      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold uppercase tracking-wide"
      style={{ backgroundColor: config.bg, color: config.text }}
    >
      <span
        className="w-1.5 h-1.5 rounded-full"
        style={{ backgroundColor: config.color }}
      />
      {config.label}
      {showLabel && <span className="font-normal normal-case tracking-normal ml-1">— {config.fullLabel}</span>}
    </span>
  );
}
