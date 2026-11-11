import { useEffect, useMemo, useState } from "react";
import { supabase, configMissing } from "../../lib/supabase";
import { useAuth } from "../../lib/auth";
import { presetRange, type Preset } from "../../lib/reports";
import { RangePicker, Chips } from "../../components/ReportControls";

// Red Comet → Messages (phase 44, President 2026-11-10). Claude reads the Red Comet (Buzz)
// teachers' messages and comments with the President signed in and saves them here. Here the
// President filters and reads them, asks Claude for a reply (with a note), edits and approves the
// draft; Claude posts approved replies in Buzz in the next session and marks them Replied.
// Kept for the whole school year (nothing is deleted automatically).
interface Msg {
  id: number; buzz_ref: string | null; student_id: string | null; subject: string; activity: string | null; from_name: string | null;
  kind: string; title: string | null; body: string; sent_at: string; status: Status; request_note: string | null;
  reply_draft: string | null; reply_text: string | null; approved_at: string | null; replied_at: string | null; replied_by: string | null;
  students: { first_name: string; last_name: string; enrollments: { grade_name: string; status: string }[] } | null;
}
type Status = "new" | "draft_requested" | "draft_ready" | "approved" | "replied" | "no_reply";
const STATUS: { key: Status; label: string; cls: string; badge: string }[] = [
  { key: "new", label: "New", cls: "bg-red-600 text-white", badge: "bg-red-100 text-red-700" },
  { key: "draft_requested", label: "Asked Claude", cls: "bg-purple-600 text-white", badge: "bg-purple-100 text-purple-800" },
  { key: "draft_ready", label: "Draft ready", cls: "bg-amber-500 text-white", badge: "bg-amber-100 text-amber-800" },
  { key: "approved", label: "Approved — to post", cls: "bg-blue-600 text-white", badge: "bg-blue-100 text-blue-700" },
  { key: "replied", label: "Replied", cls: "bg-emerald-brand text-white", badge: "bg-emerald-50 text-emerald-deep" },
  { key: "no_reply", label: "No reply needed", cls: "bg-gray-600 text-white", badge: "bg-gray-200 text-gray-600" },
];
const SUBJECTS = ["Language Arts", "Math", "Science", "Other"].map((s) => ({ key: s, label: s }));
const NEEDS = ["new", "draft_ready"];
const PRESETS: [Preset, string][] = [["week", "This week"], ["month", "This month"], ["3months", "Last 3 months"], ["year", "School year"], ["custom", "Custom"]];

export default function RedCometMessages() {
  const { can, profile } = useAuth();
  const canEdit = profile?.role === "admin" || can("redcomet", "edit");
  const [range, setRange] = useState<{ preset: Preset; from: string; to: string }>({ preset: "year", ...presetRange("year") });
  const [rows, setRows] = useState<Msg[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [subjects, setSubjects] = useState<string[]>([]);
  const [statuses, setStatuses] = useState<Status[]>([]);
  const [grades, setGrades] = useState<string[]>([]);
  const [student, setStudent] = useState("");
  const [teacher, setTeacher] = useState("");
  const [q, setQ] = useState("");
  const [needsOnly, setNeedsOnly] = useState(false);
  const [openId, setOpenId] = useState<number | null>(null);

  async function load() {
    if (configMissing) return;
    const to = new Date(range.to + "T00:00:00"); to.setDate(to.getDate() + 1);
    const { data, error } = await supabase.from("redcomet_messages")
      .select("*, students ( first_name, last_name, enrollments ( grade_name, status ) )")
      .gte("sent_at", new Date(range.from + "T00:00:00").toISOString()).lt("sent_at", to.toISOString())
      .order("sent_at", { ascending: false }).limit(2000);
    if (error) { setErr("Could not load: " + error.message + (error.message.includes("redcomet_messages") ? " - run platform_schema_phase44.sql" : "")); setRows([]); return; }
    setErr(null); setRows((data as unknown as Msg[]) ?? []);
  }
  useEffect(() => { load(); }, [range.from, range.to]);

  const grade = (m: Msg) => (m.students?.enrollments.find((e) => e.status === "active") ?? m.students?.enrollments[0])?.grade_name ?? "—";
  const name = (m: Msg) => (m.students ? `${m.students.first_name} ${m.students.last_name}` : "School-wide");
  const gradeOpts = useMemo(() => [...new Set((rows ?? []).map(grade))].sort().map((g) => ({ key: g, label: g })), [rows]);
  const studentOpts = useMemo(() => {
    const m = new Map<string, string>(); (rows ?? []).filter((r) => r.student_id && (!grades.length || grades.includes(grade(r)))).forEach((r) => m.set(r.student_id!, name(r)));
    return [...m.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [rows, grades]);
  const teachers = useMemo(() => [...new Set((rows ?? []).map((r) => r.from_name ?? "").filter(Boolean))].sort(), [rows]);
  const shown = useMemo(() => {
    const n = q.trim().toLowerCase();
    return (rows ?? []).filter((r) => (!subjects.length || subjects.includes(r.subject)) && (!statuses.length || statuses.includes(r.status))
      && (!grades.length || grades.includes(grade(r))) && (!student || r.student_id === student) && (!teacher || r.from_name === teacher)
      && (!needsOnly || NEEDS.includes(r.status))
      && (!n || [r.body, r.title, r.activity, r.from_name, name(r), r.reply_draft, r.reply_text].some((x) => (x ?? "").toLowerCase().includes(n))));
  }, [rows, subjects, statuses, grades, student, teacher, needsOnly, q]);
  const count = (s: Status) => (rows ?? []).filter((r) => r.status === s).length;

  async function setStatus(m: Msg, patch: Partial<Msg>) {
    const { error } = await supabase.from("redcomet_messages").update(patch).eq("id", m.id);
    if (error) return setErr("Could not save: " + error.message);
    load();
  }

  return (
    <div className="max-w-5xl">
      <h1 className="font-display text-2xl font-semibold text-navy">Red Comet Messages</h1>
      <p className="mb-4 mt-1 text-sm text-gray-500">
        Messages and comments from the Red Comet teachers, saved by Claude from Buzz. Ask Claude for a reply, edit and approve it; Claude posts approved replies in Buzz
        at the next session (with you signed in) and marks them Replied. Kept for the whole school year.
      </p>

      <div className="mb-3 flex flex-wrap gap-2">
        {STATUS.map((s) => (
          <button key={s.key} onClick={() => setStatuses(statuses.length === 1 && statuses[0] === s.key ? [] : [s.key])}
            className={`rounded-xl border px-3 py-2 text-left ${statuses.length === 1 && statuses[0] === s.key ? "border-navy bg-silver" : "border-gray-200 bg-white hover:border-royal"}`}>
            <div className="font-display text-xl font-semibold text-navy">{count(s.key)}</div>
            <div className="text-[11px] text-gray-500">{s.label}</div>
          </button>
        ))}
      </div>

      <div className="mb-4 space-y-2 rounded-xl border border-gray-200 bg-silver/40 p-3">
        <RangePicker {...range} onChange={setRange} presets={PRESETS} />
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
          <Chips label="Subject" options={SUBJECTS} value={subjects} onChange={setSubjects} />
          <Chips label="Grade" options={gradeOpts} value={grades} onChange={(v) => { setGrades(v); setStudent(""); }} />
        </div>
        <Chips label="Status" options={STATUS} value={statuses} onChange={setStatuses} />
        <div className="flex flex-wrap items-center gap-2">
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search message, activity, reply…" className="w-64 rounded border border-gray-300 bg-white px-2 py-1 text-sm" />
          <select value={student} onChange={(e) => setStudent(e.target.value)} className="rounded border border-gray-300 bg-white px-2 py-1 text-xs">
            <option value="">All students ({studentOpts.length})</option>
            {studentOpts.map(([id, n]) => <option key={id} value={id}>{n}</option>)}
          </select>
          <select value={teacher} onChange={(e) => setTeacher(e.target.value)} className="rounded border border-gray-300 bg-white px-2 py-1 text-xs">
            <option value="">All Red Comet teachers ({teachers.length})</option>
            {teachers.map((t) => <option key={t}>{t}</option>)}
          </select>
          <label className="flex items-center gap-1.5 text-xs text-gray-600"><input type="checkbox" checked={needsOnly} onChange={(e) => setNeedsOnly(e.target.checked)} /> Only what needs me</label>
          <span className="ml-auto text-xs text-gray-500">{shown.length} message{shown.length === 1 ? "" : "s"}</span>
        </div>
      </div>

      {err && <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{err}</div>}
      {rows === null ? <p className="text-sm text-gray-400">Loading…</p> : (
        <div className="space-y-2">
          {shown.map((m) => <MessageCard key={m.id} m={m} name={name(m)} grade={grade(m)} open={openId === m.id} onToggle={() => setOpenId(openId === m.id ? null : m.id)} canEdit={canEdit} onSave={(p) => setStatus(m, p)} />)}
          {!shown.length && <p className="rounded-xl border border-dashed border-gray-300 bg-white p-8 text-center text-sm text-gray-400">No messages for this selection.</p>}
        </div>
      )}
    </div>
  );
}

function MessageCard({ m, name, grade, open, onToggle, canEdit, onSave }: {
  m: Msg; name: string; grade: string; open: boolean; onToggle: () => void; canEdit: boolean; onSave: (p: Partial<Msg>) => void;
}) {
  const st = STATUS.find((s) => s.key === m.status)!;
  const [draft, setDraft] = useState(m.reply_draft ?? "");
  const [note, setNote] = useState(m.request_note ?? "");
  useEffect(() => { setDraft(m.reply_draft ?? ""); setNote(m.request_note ?? ""); }, [m.reply_draft, m.request_note]);
  const when = (iso: string) => new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
  const btn = "rounded-lg px-3 py-1.5 text-xs font-semibold disabled:opacity-40";
  return (
    <div className={`rounded-xl border bg-white shadow-sm ${NEEDS.includes(m.status) ? "border-amber-300" : "border-gray-200"}`}>
      <button onClick={onToggle} className="flex w-full items-start gap-3 p-3 text-left">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold text-navy">{name}</span>
            <span className="text-xs text-gray-400">{grade}</span>
            <span className="rounded-full bg-silver px-2 py-0.5 text-[11px] font-semibold text-navy">{m.subject}</span>
            {m.activity && <span className="text-xs text-gray-500">{m.activity}</span>}
          </div>
          <div className={`mt-1 text-sm text-gray-700 ${open ? "" : "line-clamp-2"}`}>{m.title && <b>{m.title}: </b>}{m.body}</div>
          <div className="mt-1 text-[11px] text-gray-400">{m.from_name ?? "Red Comet"} · {when(m.sent_at)}</div>
        </div>
        <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${st.badge}`}>{st.label}</span>
      </button>
      {open && (
        <div className="space-y-3 border-t border-gray-100 p-3">
          {m.status === "replied" && (
            <div className="rounded-lg bg-emerald-50 p-3 text-sm">
              <div className="mb-1 text-[11px] font-bold uppercase text-emerald-deep">Our reply · {m.replied_at ? when(m.replied_at) : ""}{m.replied_by ? ` · ${m.replied_by}` : ""}</div>
              <div className="whitespace-pre-wrap text-gray-800">{m.reply_text}</div>
            </div>
          )}
          {canEdit && m.status !== "replied" && (
            <>
              {(m.status === "new" || m.status === "no_reply" || m.status === "draft_requested") && (
                <div className="rounded-lg bg-purple-50/60 p-3">
                  <label className="text-xs font-semibold text-purple-900">Note for Claude (what the reply should say — optional)
                    <textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. thank her; we will redo page 12 on Monday"
                      className="mt-1 w-full rounded border border-purple-200 bg-white px-2 py-1.5 text-sm font-normal text-gray-800" />
                  </label>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <button onClick={() => onSave({ status: "draft_requested", request_note: note.trim() || null })} className={`${btn} bg-purple-700 text-white`}>
                      {m.status === "draft_requested" ? "Update note for Claude" : "Ask Claude to draft a reply"}
                    </button>
                    <button onClick={() => onSave({ status: "draft_ready", reply_draft: draft || "" })} className={`${btn} border border-gray-300 bg-white text-gray-700`}>Write it myself</button>
                    {m.status !== "no_reply" && <button onClick={() => onSave({ status: "no_reply" })} className={`${btn} border border-gray-300 bg-white text-gray-500`}>No reply needed</button>}
                    {m.status === "no_reply" && <button onClick={() => onSave({ status: "new" })} className={`${btn} border border-gray-300 bg-white text-gray-500`}>Back to New</button>}
                  </div>
                  {m.status === "draft_requested" && <p className="mt-2 text-[11px] text-purple-800">Claude drafts this at the next Red Comet session; it then shows here as "Draft ready".</p>}
                </div>
              )}
              {(m.status === "draft_ready" || m.status === "approved") && (
                <div className="rounded-lg bg-amber-50/60 p-3">
                  <label className="text-xs font-semibold text-amber-900">Reply {m.status === "approved" ? "(approved — Claude posts it in Buzz at the next session)" : "draft — edit, then approve"}
                    <textarea rows={6} value={draft} onChange={(e) => setDraft(e.target.value)} className="mt-1 w-full rounded border border-amber-200 bg-white px-2 py-1.5 text-sm font-normal text-gray-800" />
                  </label>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {m.status === "draft_ready" && <button onClick={() => onSave({ status: "approved", reply_draft: draft })} disabled={!draft.trim()} className={`${btn} bg-blue-600 text-white`}>Approve reply</button>}
                    {m.status === "approved" && <button onClick={() => onSave({ status: "draft_ready", reply_draft: draft })} className={`${btn} border border-gray-300 bg-white text-gray-700`}>Undo approval / edit</button>}
                    {draft !== (m.reply_draft ?? "") && <button onClick={() => onSave({ reply_draft: draft })} className={`${btn} border border-gray-300 bg-white text-gray-700`}>Save draft</button>}
                    <button onClick={() => onSave({ status: "draft_requested", request_note: note.trim() || "Please redo this draft." })} className={`${btn} border border-purple-300 bg-white text-purple-800`}>Ask Claude to redo</button>
                    <button onClick={() => { if (window.confirm("Mark as replied? Use this if you posted the reply in Buzz yourself.")) onSave({ status: "replied", reply_text: draft, replied_by: "marked by the office" }); }} className={`${btn} border border-emerald-300 bg-white text-emerald-deep`}>I posted it myself</button>
                  </div>
                </div>
              )}
            </>
          )}
          {m.request_note && m.status !== "replied" && <p className="text-[11px] text-gray-500">Note for Claude: {m.request_note}</p>}
        </div>
      )}
    </div>
  );
}
