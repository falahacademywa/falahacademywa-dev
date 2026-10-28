// Admin → Red Comet. Every workbook photo the teachers send from the teacher
// app (Red Comet tab → `work_uploads` + private `student-work` bucket), for the
// current calendar month and the month before. One card per student + subject
// + day with the photos as thumbnails; filters for month, grade, student,
// subject, teacher and status. Status follows scripts/redcomet-pull.py:
// new = sent by the teacher, drafted = copied to the OneDrive inbox,
// confirmed = entered in Red Comet, rejected = not used. (President 2026-10-28)
import { useEffect, useMemo, useState } from "react";
import { supabase, configMissing } from "../../lib/supabase";
import { todayStr } from "../../lib/dates";
import { usDate } from "../../lib/format";
import { type GradeLite, gradeColor, shiftMonth, monthLabel, monthRange } from "../../lib/calendar";

interface Row {
  id: number; enrollment_id: string; path: string; taken_at: string; subject: string | null; note: string | null;
  status: string; created_at: string; uploaded_by: string | null;
  enrollments: { grade_id: number; students: { first_name: string; last_name: string } } | null;
  profiles: { full_name: string | null } | null;
}
interface Card { key: string; day: string; enrollment_id: string; subject: string; status: string; teacher: string; rows: Row[] }

const STATUS: Record<string, { label: string; cls: string }> = {
  new:       { label: "sent by teacher",      cls: "bg-blue-50 text-blue-800" },
  drafted:   { label: "in OneDrive inbox",    cls: "bg-amber-100 text-amber-800" },
  confirmed: { label: "entered in Red Comet", cls: "bg-emerald-50 text-emerald-deep" },
  rejected:  { label: "not used",             cls: "bg-gray-100 text-gray-500" },
};
const statusOf = (s: string) => STATUS[s] ?? { label: s, cls: "bg-gray-100 text-gray-600" };

export default function RedComet() {
  const today = todayStr();
  const thisMonth = today.slice(0, 7);
  const lastMonth = shiftMonth(thisMonth, -1);
  const [grades, setGrades] = useState<GradeLite[]>([]);
  const [rows, setRows] = useState<Row[]>([]);
  const [thumbs, setThumbs] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [monthF, setMonthF] = useState<"both" | string>("both");
  const [gradeF, setGradeF] = useState<number | "">("");
  const [studentF, setStudentF] = useState("");
  const [subjectF, setSubjectF] = useState("");
  const [teacherF, setTeacherF] = useState("");
  const [statusF, setStatusF] = useState("");
  const [big, setBig] = useState<string | null>(null);

  useEffect(() => {
    if (configMissing) return;
    supabase.from("grades").select("id, name, level_order").eq("is_active", true).order("level_order")
      .then(({ data }) => setGrades((data as GradeLite[]) ?? []));
  }, []);

  async function load() {
    if (configMissing) return;
    setLoading(true);
    const from = monthRange(lastMonth)[0];
    const to = monthRange(thisMonth)[1];
    const { data, error } = await supabase.from("work_uploads")
      .select("id, enrollment_id, path, taken_at, subject, note, status, created_at, uploaded_by, enrollments ( grade_id, students ( first_name, last_name ) ), profiles:uploaded_by ( full_name )")
      .gte("taken_at", from).lte("taken_at", to)
      .order("taken_at", { ascending: false }).order("created_at", { ascending: false }).limit(2000);
    if (error) setMsg("Could not load: " + error.message);
    const list = (data as unknown as Row[]) ?? [];
    setRows(list);
    setLoading(false);
    // signed thumbnails (private bucket), 100 paths per call, valid 10 minutes
    const paths = list.map((r) => r.path);
    const add: Record<string, string> = {};
    for (let i = 0; i < paths.length; i += 100) {
      const chunk = paths.slice(i, i + 100);
      const { data: signed } = await supabase.storage.from("student-work").createSignedUrls(chunk, 600);
      (signed ?? []).forEach((s, j) => { if (s.signedUrl) add[chunk[j]] = s.signedUrl; });
    }
    setThumbs(add);
  }
  useEffect(() => { load(); }, []);

  const gradeName = (gid: number | null | undefined) => grades.find((g) => g.id === gid)?.name ?? "—";
  const studentName = (r: Row) => r.enrollments ? `${r.enrollments.students.first_name} ${r.enrollments.students.last_name}` : "—";
  const teacherName = (r: Row) => r.profiles?.full_name ?? "unknown";

  // option lists come from the loaded rows, so they only offer what exists
  const students = useMemo(() => {
    const m = new Map<string, { name: string; grade: number | null }>();
    rows.forEach((r) => { if (!m.has(r.enrollment_id)) m.set(r.enrollment_id, { name: studentName(r), grade: r.enrollments?.grade_id ?? null }); });
    return [...m.entries()].filter(([, v]) => gradeF === "" || v.grade === gradeF).sort((a, b) => a[1].name.localeCompare(b[1].name));
  }, [rows, gradeF, grades]);
  const subjects = useMemo(() => [...new Set(rows.map((r) => r.subject ?? "No subject"))].sort(), [rows]);
  const teachers = useMemo(() => [...new Set(rows.map(teacherName))].sort(), [rows]);

  const visible = useMemo(() => rows.filter((r) =>
    (monthF === "both" || r.taken_at.slice(0, 7) === monthF) &&
    (gradeF === "" || r.enrollments?.grade_id === gradeF) &&
    (!studentF || r.enrollment_id === studentF) &&
    (!subjectF || (r.subject ?? "No subject") === subjectF) &&
    (!teacherF || teacherName(r) === teacherF) &&
    (!statusF || r.status === statusF)), [rows, monthF, gradeF, studentF, subjectF, teacherF, statusF]);

  // one card per day + student + subject (a teacher's one "Send" for that subject)
  const cards = useMemo(() => {
    const m = new Map<string, Card>();
    visible.forEach((r) => {
      const subject = r.subject ?? "No subject";
      const key = `${r.taken_at}|${r.enrollment_id}|${subject}`;
      const c = m.get(key) ?? { key, day: r.taken_at, enrollment_id: r.enrollment_id, subject, status: r.status, teacher: teacherName(r), rows: [] };
      c.rows.push(r);
      if (r.status === "new") c.status = "new";                       // anything still unsent-to-office shows the card as new
      m.set(key, c);
    });
    return [...m.values()];
  }, [visible]);
  const days = useMemo(() => {
    const m: Record<string, Card[]> = {};
    cards.forEach((c) => (m[c.day] ??= []).push(c));
    Object.values(m).forEach((l) => l.sort((a, b) => (a.rows[0].enrollments?.grade_id ?? 0) - (b.rows[0].enrollments?.grade_id ?? 0) || studentName(a.rows[0]).localeCompare(studentName(b.rows[0])) || a.subject.localeCompare(b.subject)));
    return Object.keys(m).sort((a, b) => (a < b ? 1 : -1)).map((d) => [d, m[d]] as const);
  }, [cards]);

  const counts = useMemo(() => {
    const bySubject: Record<string, number> = {};
    visible.forEach((r) => { const s = r.subject ?? "No subject"; bySubject[s] = (bySubject[s] ?? 0) + 1; });
    return { photos: visible.length, students: new Set(visible.map((r) => r.enrollment_id)).size, waiting: visible.filter((r) => r.status === "new").length, bySubject };
  }, [visible]);

  const sel = "rounded border border-gray-300 bg-white px-2 py-1 text-sm";
  const anyFilter = monthF !== "both" || gradeF !== "" || studentF || subjectF || teacherF || statusF;

  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-2xl font-semibold text-navy">Red Comet</h1>
        <button onClick={load} className="rounded border border-gray-300 bg-white px-3 py-1 text-sm text-gray-600 hover:bg-silver">Refresh</button>
      </div>
      <p className="mb-4 text-sm text-gray-500">
        Workbook photos sent by the teachers from the teacher app (Red Comet tab), {monthLabel(lastMonth)} and {monthLabel(thisMonth)}.
        Each card is one student, one subject, one day; tap a photo to see it full size. Status moves on its own as the photos are
        copied to the OneDrive inbox and entered in Red Comet.
        {loading ? " Loading…" : ""}
      </p>
      {msg && <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{msg}</div>}
      {configMissing && <p className="text-sm text-gray-500">Connect the database first.</p>}

      {/* filters */}
      <div className="mb-4 flex flex-wrap items-center gap-2 rounded-xl border border-gray-200 bg-white p-3 shadow-sm">
        <select value={monthF} onChange={(e) => setMonthF(e.target.value)} className={sel}>
          <option value="both">Both months</option>
          <option value={thisMonth}>{monthLabel(thisMonth)}</option>
          <option value={lastMonth}>{monthLabel(lastMonth)}</option>
        </select>
        <select value={gradeF} onChange={(e) => { setGradeF(e.target.value === "" ? "" : Number(e.target.value)); setStudentF(""); }} className={sel}>
          <option value="">All grades</option>
          {grades.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
        </select>
        <select value={studentF} onChange={(e) => setStudentF(e.target.value)} className={sel}>
          <option value="">All students</option>
          {students.map(([id, s]) => <option key={id} value={id}>{s.name}</option>)}
        </select>
        <select value={subjectF} onChange={(e) => setSubjectF(e.target.value)} className={sel}>
          <option value="">All subjects</option>
          {subjects.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <select value={teacherF} onChange={(e) => setTeacherF(e.target.value)} className={sel}>
          <option value="">All teachers</option>
          {teachers.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        <select value={statusF} onChange={(e) => setStatusF(e.target.value)} className={sel}>
          <option value="">Any status</option>
          {Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
        {anyFilter && (
          <button onClick={() => { setMonthF("both"); setGradeF(""); setStudentF(""); setSubjectF(""); setTeacherF(""); setStatusF(""); }}
            className="text-xs font-semibold text-royal hover:underline">Clear filters</button>
        )}
      </div>

      {/* summary */}
      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Photos" value={counts.photos} />
        <Stat label="Students" value={counts.students} />
        <Stat label="Sends (cards)" value={cards.length} />
        <Stat label="Waiting for the office" value={counts.waiting} hint="status: sent by teacher" />
      </div>
      {!!Object.keys(counts.bySubject).length && (
        <div className="mb-4 flex flex-wrap gap-2 text-xs text-gray-600">
          {Object.entries(counts.bySubject).sort().map(([s, n]) => (
            <span key={s} className="rounded-full bg-emerald-50 px-2.5 py-0.5 font-semibold text-emerald-deep">{s}: {n}</span>
          ))}
        </div>
      )}

      {/* cards grouped by day, newest first */}
      <div className="space-y-5">
        {days.map(([d, list]) => (
          <section key={d}>
            <h2 className="mb-2 text-xs font-bold uppercase tracking-wide text-gray-400">{usDate(d)}{d === today ? " · today" : ""}</h2>
            <div className="space-y-3">
              {list.map((c) => { const g = c.rows[0].enrollments?.grade_id ?? null; const col = gradeColor(grades, g); const st = statusOf(c.status); return (
                <div key={c.key} className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
                  <div className="flex flex-wrap items-center gap-2 text-sm">
                    <span className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold ${col.chip}`}>{gradeName(g)}</span>
                    <span className="font-semibold text-navy">{studentName(c.rows[0])}</span>
                    <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-deep">{c.subject}</span>
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${st.cls}`}>{st.label}</span>
                    <span className="text-xs text-gray-400">{c.rows.length} photo{c.rows.length === 1 ? "" : "s"}</span>
                    <span className="ml-auto text-xs text-gray-400">{c.teacher}</span>
                  </div>
                  {c.rows.some((r) => r.note) && (
                    <p className="mt-1.5 whitespace-pre-wrap text-sm text-gray-700">{[...new Set(c.rows.map((r) => r.note).filter(Boolean))].join(" · ")}</p>
                  )}
                  <div className="mt-3 flex flex-wrap gap-2">
                    {c.rows.map((r) => thumbs[r.path]
                      ? <button key={r.id} onClick={() => setBig(thumbs[r.path])} title={`#${r.id} · ${statusOf(r.status).label}`}
                          className="h-24 w-24 overflow-hidden rounded-lg border border-gray-200 bg-silver hover:ring-2 hover:ring-royal">
                          <img src={thumbs[r.path]} alt="" loading="lazy" className="h-full w-full object-cover" />
                        </button>
                      : <div key={r.id} className="flex h-24 w-24 items-center justify-center rounded-lg border border-dashed border-gray-300 text-[10px] text-gray-400">loading…</div>)}
                  </div>
                </div>
              ); })}
            </div>
          </section>
        ))}
        {!configMissing && !loading && !cards.length && (
          <p className="rounded-xl border border-dashed border-gray-300 bg-white p-8 text-center text-sm text-gray-400">
            No Red Comet photos{anyFilter ? " match these filters" : ` in ${monthLabel(lastMonth)} or ${monthLabel(thisMonth)}`}.
          </p>
        )}
      </div>

      {/* full-size viewer */}
      {big && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/80 p-4" onClick={() => setBig(null)}>
          <img src={big} alt="" className="max-h-full max-w-full rounded-lg shadow-2xl" />
          <button onClick={() => setBig(null)} className="absolute right-4 top-4 text-2xl text-white/80 hover:text-white" aria-label="Close">✕</button>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, hint }: { label: string; value: number; hint?: string }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white px-4 py-3 shadow-sm" title={hint}>
      <div className="text-[11px] font-bold uppercase tracking-wide text-gray-400">{label}</div>
      <div className="font-display text-2xl font-semibold text-navy">{value}</div>
    </div>
  );
}
