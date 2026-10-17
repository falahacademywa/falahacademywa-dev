// Teacher app — student progress: a Qur'an entry or an academic entry for one
// child (the same records the office keys in on Admin → Academics), plus a
// photo of the child's work that goes to the review queue for the AI step.
import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../lib/auth";
import { useRoster, SUBJECTS, compressImage, todayISO } from "../../lib/teacher";
import { usDate } from "../../lib/format";

const QCATS = [["quran", "Qur'an"], ["qaida", "Qaida"], ["dua", "Du'a"], ["tajweed", "Tajweed"]];
const LEVELS = ["introduced", "practicing", "memorized", "mastered"];

export default function Progress() {
  const { roster } = useRoster();
  const { session } = useAuth();
  const [sp] = useSearchParams();
  const [enr, setEnr] = useState(sp.get("student") ?? "");
  const [tab, setTab] = useState<"quran" | "academic" | "photo">("quran");
  const [q, setQ] = useState({ category: "quran", surah_topic: "", ayah_from: "", ayah_to: "", memorization_level: "practicing", teacher_comment: "", revision: "" });
  const [a, setA] = useState({ subject: "English", assessment_type: "progress", score: "", max_score: "", notes: "" });
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoNote, setPhotoNote] = useState({ subject: "General", note: "" });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [recent, setRecent] = useState<{ kind: string; date: string; text: string }[]>([]);

  useEffect(() => { if (!enr && roster.length) setEnr(roster[0].enrollment_id); }, [roster]);
  async function loadRecent(e = enr) {
    if (!e) return;
    const [{ data: qp }, { data: ap }, { data: wu }] = await Promise.all([
      supabase.from("quran_progress").select("assessment_date, category, surah_topic, memorization_level").eq("enrollment_id", e).order("assessment_date", { ascending: false }).limit(5),
      supabase.from("academic_progress").select("assessment_date, subject, assessment_type, score, max_score").eq("enrollment_id", e).order("assessment_date", { ascending: false }).limit(5),
      supabase.from("work_uploads").select("taken_at, subject, status").eq("enrollment_id", e).order("created_at", { ascending: false }).limit(5),
    ]);
    const items = [
      ...((qp as { assessment_date: string; category: string; surah_topic: string | null; memorization_level: string | null }[]) ?? []).map((x) => ({ kind: "Qur'an", date: x.assessment_date, text: `${x.category} · ${x.surah_topic ?? ""} · ${x.memorization_level ?? ""}` })),
      ...((ap as { assessment_date: string; subject: string; assessment_type: string; score: number | null; max_score: number | null }[]) ?? []).map((x) => ({ kind: x.subject, date: x.assessment_date, text: `${x.assessment_type}${x.score != null ? ` · ${x.score}${x.max_score ? "/" + x.max_score : ""}` : ""}` })),
      ...((wu as { taken_at: string; subject: string | null; status: string }[]) ?? []).map((x) => ({ kind: "Photo", date: x.taken_at, text: `${x.subject ?? ""} · ${x.status}` })),
    ].sort((x, y) => (x.date < y.date ? 1 : -1)).slice(0, 8);
    setRecent(items);
  }
  useEffect(() => { loadRecent(); }, [enr]);

  async function saveQuran(e: React.FormEvent) {
    e.preventDefault();
    if (!q.surah_topic.trim()) return setMsg("Enter the surah or topic first.");
    setBusy(true); setMsg(null);
    const { error } = await supabase.from("quran_progress").insert({ enrollment_id: enr, assessment_date: todayISO(), category: q.category, surah_topic: q.surah_topic.trim(),
      ayah_from: q.ayah_from ? Number(q.ayah_from) : null, ayah_to: q.ayah_to ? Number(q.ayah_to) : null, memorization_level: q.memorization_level,
      teacher_comment: q.teacher_comment || null, revision: q.revision || null, recorded_by: session?.user.id ?? null });
    setBusy(false);
    if (error) return setMsg("Could not save: " + error.message);
    setQ({ ...q, surah_topic: "", ayah_from: "", ayah_to: "", teacher_comment: "", revision: "" }); setMsg("Saved. Parents are told when you leave a comment."); loadRecent();
  }
  async function saveAcademic(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setMsg(null);
    const { error } = await supabase.from("academic_progress").insert({ enrollment_id: enr, assessment_date: todayISO(), subject: a.subject, assessment_type: a.assessment_type,
      score: a.score ? Number(a.score) : null, max_score: a.max_score ? Number(a.max_score) : null, notes: a.notes || null, recorded_by: session?.user.id ?? null });
    setBusy(false);
    if (error) return setMsg("Could not save: " + error.message);
    setA({ ...a, score: "", max_score: "", notes: "" }); setMsg("Saved."); loadRecent();
  }
  async function savePhoto(e: React.FormEvent) {
    e.preventDefault();
    if (!photo) return setMsg("Take or choose a photo first.");
    setBusy(true); setMsg(null);
    const blob = await compressImage(photo);
    const path = `${enr}/${todayISO()}/${crypto.randomUUID()}.jpg`;
    const up = await supabase.storage.from("student-work").upload(path, blob, { contentType: "image/jpeg" });
    if (up.error) { setBusy(false); return setMsg("Upload failed: " + up.error.message); }
    const { error } = await supabase.from("work_uploads").insert({ enrollment_id: enr, path, subject: photoNote.subject, note: photoNote.note || null, uploaded_by: session?.user.id ?? null });
    setBusy(false);
    if (error) return setMsg("Saved the photo but not the note: " + error.message);
    setPhoto(null); setPhotoNote({ ...photoNote, note: "" }); setMsg("Photo queued. It will be turned into a progress entry for you to confirm."); loadRecent();
  }

  const student = roster.find((r) => r.enrollment_id === enr);
  const inp = "mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm";
  return (
    <div>
      <h1 className="mb-3 font-display text-xl font-semibold text-navy">Progress</h1>
      <select value={enr} onChange={(e) => setEnr(e.target.value)} className="mb-3 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm">
        {roster.map((r) => <option key={r.enrollment_id} value={r.enrollment_id}>{r.first_name} {r.last_name} · {r.grade_name}</option>)}
      </select>
      <div className="mb-3 grid grid-cols-3 gap-1 rounded-lg bg-white p-1">
        {([["quran", "Qur'an"], ["academic", "Academic"], ["photo", "Photo of work"]] as const).map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)} className={`rounded-md py-1.5 text-xs font-semibold ${tab === k ? "bg-navy text-white" : "text-gray-600"}`}>{l}</button>
        ))}
      </div>
      {msg && <div className={`mb-3 rounded-lg p-2 text-sm ${/^(Saved|Photo)/.test(msg) ? "bg-green-50 text-green-800" : "bg-red-50 text-red-700"}`}>{msg}</div>}

      {tab === "quran" && (
        <form onSubmit={saveQuran} className="space-y-2 rounded-xl border border-gray-200 bg-white p-3 shadow-sm">
          <div className="flex flex-wrap gap-1.5">{QCATS.map(([v, l]) => <button type="button" key={v} onClick={() => setQ({ ...q, category: v })} className={`rounded-full px-3 py-1 text-xs font-semibold ${q.category === v ? "bg-emerald-brand text-white" : "border border-gray-300 text-gray-600"}`}>{l}</button>)}</div>
          <label className="block text-xs font-semibold text-gray-500">Surah / topic<input value={q.surah_topic} onChange={(e) => setQ({ ...q, surah_topic: e.target.value })} className={inp} placeholder="e.g. Al-Fatiha" /></label>
          <div className="grid grid-cols-2 gap-2">
            <label className="block text-xs font-semibold text-gray-500">Ayah from<input type="number" value={q.ayah_from} onChange={(e) => setQ({ ...q, ayah_from: e.target.value })} className={inp} /></label>
            <label className="block text-xs font-semibold text-gray-500">Ayah to<input type="number" value={q.ayah_to} onChange={(e) => setQ({ ...q, ayah_to: e.target.value })} className={inp} /></label>
          </div>
          <label className="block text-xs font-semibold text-gray-500">Level
            <select value={q.memorization_level} onChange={(e) => setQ({ ...q, memorization_level: e.target.value })} className={inp}>{LEVELS.map((l) => <option key={l} value={l}>{l}</option>)}</select>
          </label>
          <label className="block text-xs font-semibold text-gray-500">Comment for parents (optional)<textarea value={q.teacher_comment} onChange={(e) => setQ({ ...q, teacher_comment: e.target.value })} rows={2} className={inp} /></label>
          <label className="block text-xs font-semibold text-gray-500">Revision at home (optional)<input value={q.revision} onChange={(e) => setQ({ ...q, revision: e.target.value })} className={inp} placeholder="e.g. revise ayah 1–5" /></label>
          <button type="submit" disabled={busy || !enr} className="w-full rounded-lg bg-emerald-brand py-2.5 text-sm font-semibold text-white disabled:opacity-50">Save Qur'an entry</button>
        </form>
      )}
      {tab === "academic" && (
        <form onSubmit={saveAcademic} className="space-y-2 rounded-xl border border-gray-200 bg-white p-3 shadow-sm">
          <div className="flex flex-wrap gap-1.5">{SUBJECTS.filter((s) => s !== "Qur'an").map((s) => <button type="button" key={s} onClick={() => setA({ ...a, subject: s })} className={`rounded-full px-3 py-1 text-xs font-semibold ${a.subject === s ? "bg-navy text-white" : "border border-gray-300 text-gray-600"}`}>{s}</button>)}</div>
          <label className="block text-xs font-semibold text-gray-500">Type
            <select value={a.assessment_type} onChange={(e) => setA({ ...a, assessment_type: e.target.value })} className={inp}>{["progress", "quiz", "test", "report"].map((t) => <option key={t}>{t}</option>)}</select>
          </label>
          <div className="grid grid-cols-2 gap-2">
            <label className="block text-xs font-semibold text-gray-500">Score<input type="number" step="0.5" value={a.score} onChange={(e) => setA({ ...a, score: e.target.value })} className={inp} /></label>
            <label className="block text-xs font-semibold text-gray-500">Out of<input type="number" step="0.5" value={a.max_score} onChange={(e) => setA({ ...a, max_score: e.target.value })} className={inp} /></label>
          </div>
          <label className="block text-xs font-semibold text-gray-500">Notes<textarea value={a.notes} onChange={(e) => setA({ ...a, notes: e.target.value })} rows={2} className={inp} /></label>
          <button type="submit" disabled={busy || !enr} className="w-full rounded-lg bg-navy py-2.5 text-sm font-semibold text-white disabled:opacity-50">Save academic entry</button>
        </form>
      )}
      {tab === "photo" && (
        <form onSubmit={savePhoto} className="space-y-2 rounded-xl border border-gray-200 bg-white p-3 shadow-sm">
          <p className="text-xs text-gray-500">Photograph the page of work. It is stored privately and turned into a progress entry for you to confirm.</p>
          <input type="file" accept="image/*" capture="environment" onChange={(e) => setPhoto(e.target.files?.[0] ?? null)} className="w-full text-xs" />
          <div className="flex flex-wrap gap-1.5">{SUBJECTS.map((s) => <button type="button" key={s} onClick={() => setPhotoNote({ ...photoNote, subject: s })} className={`rounded-full px-3 py-1 text-xs font-semibold ${photoNote.subject === s ? "bg-navy text-white" : "border border-gray-300 text-gray-600"}`}>{s}</button>)}</div>
          <input value={photoNote.note} onChange={(e) => setPhotoNote({ ...photoNote, note: e.target.value })} placeholder="Optional note" className={inp} />
          <button type="submit" disabled={busy || !enr} className="w-full rounded-lg bg-navy py-2.5 text-sm font-semibold text-white disabled:opacity-50">{busy ? "Uploading…" : "Upload photo"}</button>
        </form>
      )}

      {student && (
        <>
          <h2 className="mb-2 mt-5 text-xs font-bold uppercase tracking-wide text-gray-400">Recent for {student.first_name}</h2>
          <div className="space-y-1.5">
            {recent.map((x, i) => <div key={i} className="flex items-center gap-2 rounded-lg border border-gray-100 bg-white px-3 py-2 text-sm"><span className="rounded-full bg-silver px-2 py-0.5 text-[10px] font-semibold text-navy">{x.kind}</span><span className="flex-1 truncate text-gray-700">{x.text}</span><span className="text-[11px] text-gray-400">{usDate(x.date)}</span></div>)}
            {!recent.length && <p className="text-sm text-gray-400">Nothing recorded yet.</p>}
          </div>
        </>
      )}
    </div>
  );
}
