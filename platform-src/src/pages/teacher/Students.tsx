// Teacher app — Students: my roster, grouped by grade, with the limited profile card.
import { useState } from "react";
import { Link } from "react-router-dom";
import { useRoster, consentBadge, medicalFlag } from "../../lib/teacher";

export default function Students() {
  const { roster, grades, loading, error } = useRoster();
  const [q, setQ] = useState("");
  const shown = roster.filter((r) => `${r.first_name} ${r.last_name}`.toLowerCase().includes(q.toLowerCase()));
  return (
    <div>
      <h1 className="mb-3 font-display text-xl font-semibold text-navy">My students</h1>
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by name" className="mb-3 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm" />
      {error && <div className="mb-3 rounded-lg bg-red-50 p-2 text-sm text-red-700">{error}</div>}
      {grades.map((g) => {
        const list = shown.filter((r) => r.grade_id === g.id);
        if (!list.length) return null;
        return (
          <section key={g.id} className="mb-4">
            <h2 className="mb-1.5 text-xs font-bold uppercase tracking-wide text-gray-400">{g.name} · {list.length}</h2>
            <div className="space-y-2">
              {list.map((r) => { const b = consentBadge(r.consent_status); return (
                <Link key={r.student_id} to={`/teacher/students/${r.student_id}`} className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white p-3 shadow-sm active:bg-silver">
                  {r.profile_photo_url ? <img src={r.profile_photo_url} alt="" className="h-11 w-11 rounded-full object-cover" />
                    : <div className="flex h-11 w-11 items-center justify-center rounded-full bg-navy/10 text-sm font-bold text-navy">{r.first_name[0]}{r.last_name[0]}</div>}
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-semibold text-navy">{r.first_name} {r.last_name}</div>
                    <div className="mt-0.5 flex flex-wrap gap-1">
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${b.cls}`}>📷 {b.label}</span>
                      {medicalFlag(r) && <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-semibold text-red-700">⚕ medical</span>}
                    </div>
                  </div>
                  <span className="text-gray-300">›</span>
                </Link>
              ); })}
            </div>
          </section>
        );
      })}
      {!loading && !roster.length && !error && <p className="rounded-xl border border-dashed border-gray-300 bg-white p-6 text-center text-sm text-gray-400">No students assigned to you yet.</p>}
    </div>
  );
}
