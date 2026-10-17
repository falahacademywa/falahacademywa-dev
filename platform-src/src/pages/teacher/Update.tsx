// Teacher app — post a class update (whole grade or one student), with an
// optional photo and homework due date. Same fields as the Google Form; the
// insert fires the existing admin alert and the parents' evening digest.
import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../lib/auth";
import { useRoster, SUBJECTS, compressImage, todayISO } from "../../lib/teacher";
import { usDate } from "../../lib/format";

interface Post { id: string; subject: string; note: string; update_date: string; homework_due: string | null; attachment_url: string | null; grade_id: number | null; enrollment_id: string | null; created_at: string }

export default function Update() {
  const { roster, grades } = useRoster();
  const { session } = useAuth();
  const [sp] = useSearchParams();
  const [target, setTarget] = useState<string>(sp.get("student") ? `e:${sp.get("student")}` : "");
  const [subject, setSubject] = useState("General");
  const [note, setNote] = useState("");
  const [due, setDue] = useState("");
  const [photo, setPhoto] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);

  useEffect(() => { if (!target && grades.length) setTarget(`g:${grades[0].id}`); }, [grades]);

  async function loadPosts() {
    const { data } = await supabase.from("class_updates").select("id, subject, note, update_date, homework_due, attachment_url, grade_id, enrollment_id, created_at")
      .order("created_at", { ascending: false }).limit(20);
    setPosts((data as Post[]) ?? []);
  }
  useEffect(() => { loadPosts(); }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!target || note.trim().length < 3) return setMsg("Write a short note first.");
    setBusy(true); setMsg(null);
    let attachment_url: string | null = null;
    if (photo) {
      const blob = await compressImage(photo);
      const path = `${todayISO()}/${crypto.randomUUID()}.jpg`;
      const { error } = await supabase.storage.from("class-updates").upload(path, blob, { contentType: "image/jpeg" });
      if (error) { setBusy(false); return setMsg("Photo upload failed: " + error.message); }
      attachment_url = supabase.storage.from("class-updates").getPublicUrl(path).data.publicUrl;
    }
    const [kind, id] = target.split(":");
    const row = { grade_id: kind === "g" ? Number(id) : null, enrollment_id: kind === "e" ? id : null, subject, note: note.trim(),
      homework_due: due || null, attachment_url, update_date: todayISO() };
    const { error } = await supabase.from("class_updates").insert(row);
    if (error) { setBusy(false); return setMsg("Could not post: " + error.message); }
    if (due) {
      await supabase.from("assignments").insert({ grade_id: row.grade_id, enrollment_id: row.enrollment_id, subject, title: note.trim().slice(0, 80),
        instructions: note.trim(), due_date: due, created_by: session?.user.id ?? null });
    }
    setBusy(false); setNote(""); setDue(""); setPhoto(null); setMsg("Posted. Parents see it in their feed; the office has been notified.");
    loadPosts();
  }
  async function remove(p: Post) {
    if (!confirm("Delete this update?")) return;
    const { error } = await supabase.from("class_updates").delete().eq("id", p.id);
    if (error) setMsg("Could not delete (only your own posts, same day): " + error.message);
    loadPosts();
  }
  const nameOf = (p: Post) => p.enrollment_id ? (roster.find((r) => r.enrollment_id === p.enrollment_id)?.first_name ?? "one student") : (grades.find((g) => g.id === p.grade_id)?.name ?? "class");

  return (
    <div>
      <h1 className="mb-3 font-display text-xl font-semibold text-navy">Class update</h1>
      <form onSubmit={submit} className="space-y-3 rounded-xl border border-gray-200 bg-white p-3 shadow-sm">
        <label className="block text-xs font-semibold text-gray-500">For
          <select value={target} onChange={(e) => setTarget(e.target.value)} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm">
            {grades.map((g) => <option key={g.id} value={`g:${g.id}`}>Whole class · {g.name}</option>)}
            <optgroup label="One student">{roster.map((r) => <option key={r.enrollment_id} value={`e:${r.enrollment_id}`}>{r.first_name} {r.last_name} · {r.grade_name}</option>)}</optgroup>
          </select>
        </label>
        <label className="block text-xs font-semibold text-gray-500">Subject
          <div className="mt-1 flex flex-wrap gap-1.5">
            {SUBJECTS.map((s) => <button type="button" key={s} onClick={() => setSubject(s)} className={`rounded-full px-3 py-1 text-xs font-semibold ${subject === s ? "bg-navy text-white" : "border border-gray-300 bg-white text-gray-600"}`}>{s}</button>)}
          </div>
        </label>
        <label className="block text-xs font-semibold text-gray-500">What did the class do today?
          <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={4} placeholder="e.g. We practised letters A–E and read a story about kindness. Homework: trace page 7." className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
        </label>
        <div className="grid grid-cols-2 gap-2">
          <label className="block text-xs font-semibold text-gray-500">Homework due (optional)
            <input type="date" value={due} min={todayISO()} onChange={(e) => setDue(e.target.value)} className="mt-1 w-full rounded-lg border border-gray-300 px-2 py-2 text-sm" />
          </label>
          <label className="block text-xs font-semibold text-gray-500">Photo (optional)
            <input type="file" accept="image/*" capture="environment" onChange={(e) => setPhoto(e.target.files?.[0] ?? null)} className="mt-1 w-full text-xs" />
          </label>
        </div>
        {msg && <div className={`rounded-lg p-2 text-sm ${msg.startsWith("Posted") ? "bg-green-50 text-green-800" : "bg-red-50 text-red-700"}`}>{msg}</div>}
        <button type="submit" disabled={busy} className="w-full rounded-lg bg-navy py-2.5 text-sm font-semibold text-white disabled:opacity-50">{busy ? "Posting…" : "Post update"}</button>
      </form>

      <h2 className="mb-2 mt-5 text-xs font-bold uppercase tracking-wide text-gray-400">Recent posts</h2>
      <div className="space-y-2">
        {posts.map((p) => (
          <div key={p.id} className="rounded-xl border border-gray-200 bg-white p-3 shadow-sm">
            <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
              <span className="rounded-full bg-emerald-50 px-2 py-0.5 font-semibold text-emerald-deep">{p.subject}</span>
              <span className="rounded-full bg-silver px-2 py-0.5 text-navy">{nameOf(p)}</span>
              {p.homework_due && <span className="rounded-full bg-amber-100 px-2 py-0.5 font-semibold text-amber-800">due {usDate(p.homework_due)}</span>}
              <span className="ml-auto text-gray-400">{usDate(p.update_date)}</span>
              {Date.now() - new Date(p.created_at).getTime() < 86400000 && <button onClick={() => remove(p)} className="text-gray-400">✕</button>}
            </div>
            <p className="mt-1 whitespace-pre-wrap text-sm text-gray-700">{p.note}</p>
            {p.attachment_url && <a href={p.attachment_url} target="_blank" rel="noreferrer" className="mt-1 inline-block text-xs text-royal">Photo ↗</a>}
          </div>
        ))}
        {!posts.length && <p className="text-sm text-gray-400">No posts yet.</p>}
      </div>
    </div>
  );
}
