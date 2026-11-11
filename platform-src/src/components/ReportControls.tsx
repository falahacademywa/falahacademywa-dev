import { type ReactNode } from "react";
import { PRESETS, presetRange, type Preset, type Period } from "../lib/reports";

export function RangePicker({ preset, from, to, onChange, presets = PRESETS, monthOnly = false }: {
  preset: Preset; from: string; to: string;
  onChange: (v: { preset: Preset; from: string; to: string }) => void;
  presets?: [Preset, string][]; monthOnly?: boolean;
}) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {presets.map(([p, label]) => (
        <button key={p} onClick={() => onChange(p === "custom" ? { preset: p, from, to } : { preset: p, ...presetRange(p) })}
          className={`rounded-full px-3 py-1 text-xs font-semibold ${preset === p ? "bg-navy text-white" : "bg-white text-gray-600 ring-1 ring-gray-300 hover:bg-silver"}`}>
          {label}
        </button>
      ))}
      {preset === "custom" && (
        <span className="ml-1 flex items-center gap-1 text-xs text-gray-500">
          {monthOnly ? (
            <>
              <input type="month" value={from.slice(0, 7)} onChange={(e) => onChange({ preset, from: e.target.value + "-01", to })} className="rounded border border-gray-300 px-2 py-1 text-xs" />
              to
              <input type="month" value={to.slice(0, 7)} onChange={(e) => { const [y, m] = e.target.value.split("-").map(Number); onChange({ preset, from, to: `${e.target.value}-${String(new Date(y, m, 0).getDate()).padStart(2, "0")}` }); }} className="rounded border border-gray-300 px-2 py-1 text-xs" />
            </>
          ) : (
            <>
              <input type="date" value={from} onChange={(e) => onChange({ preset, from: e.target.value, to })} className="rounded border border-gray-300 px-2 py-1 text-xs" />
              to
              <input type="date" value={to} onChange={(e) => onChange({ preset, from, to: e.target.value })} className="rounded border border-gray-300 px-2 py-1 text-xs" />
            </>
          )}
        </span>
      )}
    </div>
  );
}

export function Chips<T extends string>({ label, options, value, onChange }: {
  label: string; options: { key: T; label: string; cls?: string }[]; value: T[]; onChange: (v: T[]) => void;
}) {
  const all = value.length === 0;
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="mr-1 text-[11px] font-bold uppercase tracking-wide text-gray-400">{label}</span>
      <button onClick={() => onChange([])} className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${all ? "bg-navy text-white" : "bg-white text-gray-500 ring-1 ring-gray-300 hover:bg-silver"}`}>All</button>
      {options.map((o) => {
        const on = value.includes(o.key);
        return (
          <button key={o.key} onClick={() => onChange(on ? value.filter((v) => v !== o.key) : [...value, o.key])}
            className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${on ? (o.cls ?? "bg-navy text-white") : "bg-white text-gray-600 ring-1 ring-gray-300 hover:bg-silver"}`}>
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

export function PeriodToggle({ value, onChange, options = ["day", "month", "year"] }: { value: Period; onChange: (p: Period) => void; options?: Period[] }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="mr-1 text-[11px] font-bold uppercase tracking-wide text-gray-400">By</span>
      {options.map((p) => (
        <button key={p} onClick={() => onChange(p)}
          className={`rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ${value === p ? "bg-emerald-brand text-white" : "bg-white text-gray-600 ring-1 ring-gray-300 hover:bg-silver"}`}>{p}</button>
      ))}
    </div>
  );
}

export function Tile({ label, value, sub, tone = "navy" }: { label: string; value: ReactNode; sub?: ReactNode; tone?: "navy" | "green" | "amber" | "red" | "gray" }) {
  const c = { navy: "text-navy", green: "text-emerald-deep", amber: "text-amber-700", red: "text-red-700", gray: "text-gray-600" }[tone];
  return (
    <div className="rounded-xl border border-gray-200 bg-white px-4 py-3 shadow-sm">
      <div className="text-[11px] font-bold uppercase tracking-wide text-gray-400">{label}</div>
      <div className={`mt-0.5 font-display text-2xl font-semibold ${c}`}>{value}</div>
      {sub && <div className="text-xs text-gray-500">{sub}</div>}
    </div>
  );
}

/** One expandable row of a drill-down table. */
export function DrillRow({ depth, open, onToggle, cells, canOpen = true }: { depth: number; open?: boolean; onToggle?: () => void; cells: ReactNode[]; canOpen?: boolean }) {
  const bg = depth === 0 ? "bg-white font-semibold text-navy" : depth === 1 ? "bg-gray-50/70 text-gray-800" : "bg-white text-gray-600";
  return (
    <tr className={`border-b border-gray-100 ${bg} ${canOpen && onToggle ? "cursor-pointer hover:bg-silver/60" : ""}`} onClick={canOpen ? onToggle : undefined}>
      <td className="py-1.5 pr-2" style={{ paddingLeft: 8 + depth * 18 }}>
        <span className="inline-flex items-center gap-1.5">
          {canOpen && onToggle ? <span className="w-3 text-gray-400">{open ? "▾" : "▸"}</span> : <span className="w-3" />}
          {cells[0]}
        </span>
      </td>
      {cells.slice(1).map((c, i) => <td key={i} className="py-1.5 pr-3 text-right tabular-nums">{c}</td>)}
    </tr>
  );
}
