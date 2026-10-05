// Admin → Activity (phase 22). One month at a glance: which grades had a class
// update posted each day (one color per grade) and whether attendance was
// taken (teal). Pick a student to see that child's own attendance (green /
// amber / red) and only the updates that reach them. Click a day for detail.
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase, configMissing } from "../../lib/supabase";
import { todayStr } from "../../lib/dates";
import { usDate } from "../../lib/format";

interface Grade { id: number; name: string; level_order: number }
interface Enr { id: string; grade_id: number; grade_name: string | null; students: { first_name: string; last_name: string; student_no: number } }
interface Upd {
  id: string; subject: string; note: string; update_date: string; homework_due: string | null; teacher_email: string | null;
  grade_id: number | null; enrollment_id: string | null; attachment_url: string | null;
  enrollments: { grade_id: number; students: { first_name: string; last_name: string } } | null;
}
interface Att { date: string; status: "present" | "late" | "absent"; enrollment_id: string;
  enrollments: { grade_id: number; students: { first_name: string; last_name: string } } }

// one color per grade: chip classes + swatch; fixed by name, fallback by position
const PALETTE: { chip: string; dot: string }[] = [
  { chip: "bg-rose-100 text-rose-800 border-rose-200", dot: "bg-rose-400" },
  { chip: "bg-violet-100 text-violet-800 border-violet-200", dot: "bg-violet-400" },
  { chip: "bg-sky-100 text-sky-800 border-sky-200", dot: "bg-sky-400" },
  { chip: "bg-orange-100 text-orange-800 border-orange-200", dot: "bg-orange-400" },
  { chip: "bg-lime-100 text-lime-800 border-lime-200", dot: "bg-lime-500" },
  { chip: "bg-fuchsia-100 text-fuchsia-800 border-fuchsia-200", dot: "bg-fuchsia-400" },
  { chip: "bg-cyan-100 text-cyan-800 border-cyan-200", dot: "bg-cyan-400" },
  { chip: "bg-yellow-100 text-yellow-800 border-yellow-200", dot: "bg-yellow-400" },
];
const BY_NAME: Record<string, number> = { "Pre-K": 0, KG: 1, "Grade 1": 2, "Grade 2": 6, "Grade 3": 3, "Grade 4": 4, "Grade 5": 5 };
const ATT = { chip: "bg-teal-100 text-teal-800 border-teal-200", dot: "bg-teal-500" };
const STATUS = {
  present: { chip: "bg-green-100 text-green-700 border-green-200", dot: "bg-green-500", label: "Present" },
  late: { chip: "bg-amber-100 text-amber-800 border-amber-200", dot: "bg-amber-500", label: "Late" },
  absent: { chip: "bg-red-100 text-red-700 border-red-200", dot: "bg-red-500", label: "Absent" },
};

export default function ActivityCalendar() {
  const [month, setMonth] = useState(todayStr().slice(0, 7));
  const [grades, setGrades] = useState<Grade[]>([]);
  const [enrs, setEnrs] = useState<Enr[]>([]);
  const [gradeF, setGradeF] = useState<number | "">("");
  const [enrF, setEnrF] = useState<string>("");
  const [upds, setUpds] = useState<Upd[]>([]);
  const [att, setAtt] = useState<Att[]>([]);
  const [day, setDay] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (configMissing) return;
    Promise.all([
      supabase.from("grades").select("id, name, level_order").eq("is_active", true).order("level_order"),
      supabase.from("enrollments").select("id, grade_id, grade_name, students ( first_name, last_name, student_no )").eq("status", "active"),
    ]).then(([{ data: g }, { data: e }]) => {
      setGrades((g as Grade[]) ?? []);
      setEnrs(((e as unknown as Enr[]) ?? []).sort((a, b) => a.students.first_name.localeCompare(b.students.first_name)));
    });
  }, []);

  const [from, to] = useMemo(() => {
    const [y, m] = month.split("-").map(Number);
    return [`${month}-01`, `${month}-${String(new Date(y, m, 0).getDate()).padStart(2, "0")}`];
  }, [month]);

  useEffect(() => {
    if (configMissing) return;
    setLoading(true); setDay(null);
    Promise.all([
      supabase.from("class_updates")
        .select("id, subject, note, update_date, homework_due, teacher_email, grade_id, enrollment_id, attachment_url, enrollments ( grade_id, students ( first_name, last_name ) )")
        .gte("update_date", from).lte("update_date", to).order("update_date"),
      supabase.from("attendance")
        .select("date, status, enrollment_id, enrollments!inner ( grade_id, students ( first_name, last_name ) )")
        .gte("date", from).lte("date", to).limit(5000),
    ]).then(([{ data: u }, { data: a }]) => {
      setUpds((u as unknown as Upd[]) ?? []);
      setAtt((a as unknown as Att[]) ?? []);
      setLoading(false);
    });
  }, [from, to]);

  const colorOf = (gid: number) => {
    const g = grades.find((x) => x.id === gid);
    const idx = g && BY_NAME[g.name] != null ? BY_NAME[g.name] : (grades.findIndex((x) => x.id === gid) + 8) % PALETTE.length;
    return PALETTE[idx % PALETTE.length];
  };
  const gradeName = (gid: number | null) => grades.find((x) => x.id === gid)?.name ?? "—";
  const updGrade = (u: Upd) => u.grade_id ?? u.enrollments?.grade_id ?? null;

  const selEnr = enrs.find((e) => e.id === enrF) ?? null;
  const studentOptions = enrs.filter((e) => gradeF === "" || e.grade_id === gradeF);

  // apply the filters once
  const visUpds = useMemo(() => upds.filter((u) => {
    if (selEnr) return u.enrollment_id ? u.enrollment_id === selEnr.id : u.grade_id === selEnr.grade_id;
    return gradeF === "" || updGrade(u) === gradeF;
  }), [upds, gradeF, selEnr]);
  const visAtt = useMemo(() => att.filter((a) => selEnr ? a.enrollment_id === selEnr.id : gradeF === "" || a.enrollments.grade_id === gradeF), [att, gradeF, selEnr]);

  // per-day summaries
  const byDay = useMemo(() => {
    const m: Record<string, { upd: Record<number, { n: number; quran: boolean }>; att: Record<string, number>; mine?: Att["status"] }> = {};
    const get = (d: string) => (m[d] ??= { upd: {}, att: {} });
    visUpds.forEach((u) => { const g = updGrade(u); if (g == null) return; const cell = get(u.update_date).upd; const c = (cell[g] ??= { n: 0, quran: false }); c.n++; if (/qur/i.test(u.subject)) c.quran = true; });
    visAtt.forEach((a) => { const cell = get(a.date); cell.att[a.status] = (cell.att[a.status] ?? 0) + 1; if (selEnr) cell.mine = a.status; });
    return m;
  }, [visUpds, visAtt, selEnr]);

  const cells = useMemo(() => {
    const [y, m] = month.split("-").map(Number);
    const first = new Date(y, m - 1, 1).getDay();
    const days = new Date(y, m, 0).getDate();
    const out: (string | null)[] = [];
    for (let i = 0; i < first; i++) out.push(null);
    for (let d = 1; d <= days; d++) out.push(`${month}-${String(d).padStart(2, "0")}`);
    while (out.length % 7) out.push(null);
    return out;
  }, [month]);

  const monthOptions = useMemo(() => {
    const now = new Date();
    const startYear = now.getMonth() + 1 >= 8 ? now.getFullYear() : now.getFullYear() - 1;
    const opts: string[] = []; const d = new Date(startYear, 7, 1);
    while (d <= now) { opts.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`); d.setMonth(d.getMonth() + 1); }
    return opts.reverse();
  }, []);

  const today = todayStr();
  const totals = useMemo(() => ({
    updates: visUpds.length,
    days: Object.values(byDay).filter((c) => Object.keys(c.upd).length).length,
    attDays: Object.values(byDay).filter((c) => Object.keys(c.att).length).length,
  }), [visUpds, byDay]);

  const dayUpds = day ? visUpds.filter((u) => u.update_date === day) : [];
  const dayAtt = day ? visAtt.filter((a) => a.date === day) : [];
  const attByGrade = useMemo(() => {
    const m: Record<number, { present: number; late: number; absent: number; names: string[] }> = {};
    dayAtt.forEach((a) => { const g = (m[a.enrollments.grade_id] ??= { present: 0, late: 0, absent: 0, names: [] }); g[a.status]++;
      if (a.status !== "present") g.names.push(`${a.enrollments.students.first_name} ${a.enrollments.students.last_name[0]}. (${a.status})`); });
    return m;
  }, [dayAtt]);

  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-2xl font-semibold text-navy">Activity Calendar</h1>
        <div className="flex flex-wrap items-center gap-2">
          <select value={month} onChange={(e) => setMonth(e.target.value)} className="rounded border border-gray-300 bg-white px-2 py-1 text-sm">
            {monthOptions.map((m) => <option key={m} value={m}>{new Date(m + "-15").toLocaleDateString("en-US", { month: "long", year: "numeric" })}</option>)}
          </select>
          <select value={gradeF} onChange={(e) => { setGradeF(e.target.value === "" ? "" : Number(e.target.value)); setEnrF(""); }} className="rounded border border-gray-300 bg-white px-2 py-1 text-sm">
            <option value="">All grades</option>
            {grades.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
          </select>
          <select value={enrF} onChange={(e) => setEnrF(e.target.value)} className="rounded border border-gray-300 bg-white px-2 py-1 text-sm">
            <option value="">Whole class</option>
            {studentOptions.map((e) => <option key={e.id} value={e.id}>{e.students.first_name} {e.students.last_name} · {e.grade_name ?? gradeName(e.grade_id)}</option>)}
          </select>
        </div>
      </div>
      <p className="mb-4 text-sm text-gray-500">
        Each day shows which classes had a teacher update (one color per grade, <b>Q</b> = a Qur'an update) and whether attendance was taken.
        Pick a student to see their own attendance and the updates that reach them. Click a day for the detail.
      </p>

      {/* legend */}
      <div className="mb-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-600">
        {grades.map((g) => <span key={g.id} className="flex items-center gap-1.5"><span className={`h-3 w-3 rounded-full ${colorOf(g.id).dot}`} /> {g.name} update</span>)}
        {selEnr ? (
          <>
            {(Object.keys(STATUS) as (keyof typeof STATUS)[]).map((k) => <span key={k} className="flex items-center gap-1.5"><span className={`h-3 w-3 rounded-full ${STATUS[k].dot}`} /> {STATUS[k].label}</span>)}
          </>
        ) : (
          <span className="flex items-center gap-1.5"><span className={`h-3 w-3 rounded-full ${ATT.dot}`} /> Attendance taken (present+late / recorded)</span>
        )}
        <span className="ml-auto text-gray-400">{loading ? "Loading…" : `${totals.updates} updates on ${totals.days} days · attendance on ${totals.attDays} days`}</span>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_20rem]">
        <div className="rounded-xl border border-gray-200 bg-white p-3 shadow-sm">
          <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-bold text-gray-400">
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => <div key={d} className="py-1">{d}</div>)}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {cells.map((d, i) => {
              if (!d) return <div key={i} className="min-h-[5.5rem] rounded-lg bg-silver/60" />;
              const c = byDay[d];
              const weekend = [0, 5, 6].includes(new Date(d + "T00:00:00").getDay());
              const recorded = c ? Object.values(c.att).reduce((s, n) => s + n, 0) : 0;
              const there = c ? (c.att.present ?? 0) + (c.att.late ?? 0) : 0;
              return (
                <button key={d} onClick={() => setDay(day === d ? null : d)}
                  className={`min-h-[5.5rem] rounded-lg border p-1 text-left align-top transition hover:border-royal ${
                    day === d ? "border-royal ring-2 ring-royal/30" : "border-gray-100"} ${weekend ? "bg-silver/40" : "bg-white"} ${d > today ? "opacity-50" : ""}`}>
                  <div className={`mb-1 text-xs font-semibold ${d === today ? "rounded-full bg-navy px-1.5 text-white inline-block" : "text-gray-500"}`}>{Number(d.slice(-2))}</div>
                  <div className="flex flex-wrap gap-0.5">
                    {c && Object.entries(c.upd).sort(([a], [b]) => Number(a) - Number(b)).map(([gid, v]) => (
                      <span key={gid} className={`rounded border px-1 text-[10px] font-semibold leading-4 ${colorOf(Number(gid)).chip}`} title={`${gradeName(Number(gid))}: ${v.n} update${v.n > 1 ? "s" : ""}`}>
                        {gradeName(Number(gid)).replace("Grade ", "G")}{v.n > 1 ? ` ×${v.n}` : ""}{v.quran ? " Q" : ""}
                      </span>
                    ))}
                    {c && selEnr && c.mine && (
                      <span className={`rounded border px-1 text-[10px] font-semibold leading-4 ${STATUS[c.mine].chip}`}>{STATUS[c.mine].label}</span>
                    )}
                    {c && !selEnr && recorded > 0 && (
                      <span className={`rounded border px-1 text-[10px] font-semibold leading-4 ${ATT.chip}`} title="present + late / recorded">✓ {there}/{recorded}</span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* day detail */}
        <aside className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          {!day ? (
            <p className="text-sm text-gray-400">Click a day to see its updates and attendance.</p>
          ) : (
            <>
              <h2 className="font-display text-lg font-semibold text-navy">{usDate(day)}</h2>
              <h3 className="mb-1 mt-3 text-[11px] font-bold uppercase tracking-wide text-gray-400">Class updates ({dayUpds.length})</h3>
              {!dayUpds.length && <p className="text-sm text-gray-400">None posted.</p>}
              <div className="space-y-2">
                {dayUpds.map((u) => { const g = updGrade(u); return (
                  <div key={u.id} className="rounded-lg border border-gray-100 p-2 text-sm">
                    <div className="flex flex-wrap items-center gap-1">
                      {g != null && <span className={`rounded border px-1.5 text-[10px] font-semibold ${colorOf(g).chip}`}>{gradeName(g)}</span>}
                      <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-deep">{u.subject}</span>
                      {u.enrollment_id && u.enrollments && <span className="text-[10px] text-gray-500">{u.enrollments.students.first_name} only</span>}
                      {u.homework_due && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-800">due {usDate(u.homework_due)}</span>}
                    </div>
                    <p className="mt-1 line-clamp-4 whitespace-pre-wrap text-gray-700">{u.note}</p>
                    <div className="mt-1 text-[10px] text-gray-400">{u.teacher_email ?? "unknown teacher"}{u.attachment_url && <> · <a href={u.attachment_url} target="_blank" rel="noreferrer" className="text-royal hover:underline">attachment</a></>}</div>
                  </div>
                ); })}
              </div>
              <h3 className="mb-1 mt-4 text-[11px] font-bold uppercase tracking-wide text-gray-400">Attendance</h3>
              {!dayAtt.length && <p className="text-sm text-gray-400">Not taken{selEnr ? " for this student" : ""}.</p>}
              {selEnr && dayAtt[0] && (
                <div className={`inline-block rounded border px-2 py-0.5 text-sm font-semibold ${STATUS[dayAtt[0].status].chip}`}>{selEnr.students.first_name}: {STATUS[dayAtt[0].status].label}</div>
              )}
              {!selEnr && Object.entries(attByGrade).sort(([a], [b]) => Number(a) - Number(b)).map(([gid, v]) => (
                <div key={gid} className="mb-1.5 text-sm">
                  <div className="flex items-center gap-2">
                    <span className={`rounded border px-1.5 text-[10px] font-semibold ${colorOf(Number(gid)).chip}`}>{gradeName(Number(gid))}</span>
                    <span className="text-green-700">{v.present} present</span>
                    {v.late > 0 && <span className="text-amber-800">{v.late} late</span>}
                    {v.absent > 0 && <span className="text-red-700">{v.absent} absent</span>}
                  </div>
                  {v.names.length > 0 && <div className="ml-1 text-[11px] text-gray-500">{v.names.join(", ")}</div>}
                </div>
              ))}
              <div className="mt-3 flex gap-3 text-xs">
                <Link to="/admin/updates" className="text-royal hover:underline">All class updates</Link>
                {selEnr && <Link to={`/admin/students`} className="text-royal hover:underline">Student profile</Link>}
              </div>
            </>
          )}
        </aside>
      </div>
    </div>
  );
}
