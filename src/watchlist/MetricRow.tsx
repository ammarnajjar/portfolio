// src/watchlist/MetricRow.tsx
import React from "react";
import type { MetricResult, MetricVerdict } from "./watchlist-types";

const BADGE: Record<MetricVerdict, { label: string; className: string }> = {
  good: {
    label: "Good",
    className:
      "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40",
  },
  caution: {
    label: "Caution",
    className: "bg-amber-500/20 text-amber-300 border border-amber-500/40",
  },
  red: {
    label: "Red Flag",
    className: "bg-rose-500/20 text-rose-300 border border-rose-500/40",
  },
  na: {
    label: "N/A",
    className: "bg-slate-600/20 text-slate-400 border border-slate-600/40",
  },
};

interface Props {
  metric: MetricResult;
}

export const MetricRow: React.FC<Props> = ({ metric }) => {
  const badge = BADGE[metric.verdict];
  return (
    <tr className="border-b border-slate-700/30 last:border-0">
      <td className="py-2 pr-4 text-sm text-slate-300 font-medium w-44">
        {metric.label}
      </td>
      <td className="py-2 pr-4 text-sm text-white font-mono">
        {metric.verdict !== 'na' ? metric.displayValue : null}
      </td>
      <td className="py-2 pr-4">
        <span
          className={`text-xs font-semibold px-2 py-0.5 rounded-full ${badge.className}`}
        >
          {badge.label}
        </span>
      </td>
      <td className="py-2 text-xs text-slate-400 italic">{metric.note}</td>
    </tr>
  );
};
