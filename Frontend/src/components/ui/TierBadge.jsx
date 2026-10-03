/**
 * TierBadge — minimal pill, single dot.
 */
import { getTierConfig } from '../../utils/tiers';

export default function TierBadge({ tier }) {
  const config = getTierConfig(tier);

  return (
    <span
      className="inline-flex items-center gap-1.5 pl-2 pr-2.5 py-1 rounded-full text-[11.5px] font-medium border"
      style={{
        backgroundColor: config.bg,
        color: config.text,
        borderColor: `${config.color}26`,
      }}
    >
      <span
        className="w-1.5 h-1.5 rounded-full"
        style={{ backgroundColor: config.color }}
      />
      {config.label}
    </span>
  );
}
