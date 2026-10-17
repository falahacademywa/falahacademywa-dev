// Teacher app — my profile (phone, qualification, short bio), my grades, install hint, sign out.
import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../lib/auth";
import { useMyTeacher } from "../../lib/teacher";

export default function Me() {
  const { signOut, session } = useAuth();
  const { me, reload } = useMyTeacher();
  const [form, setForm] = useState({ phone: "", qualification: "", bio: "" });
  const [msg, setMsg] = useState<string | null>(null);
  useEffect(() => { if (me) setForm({ phone: me.phone ?? "", qualification: me.qualification ?? "", bio: me.bio ?? "" }); }, [me]);

  async function save(e: React.FormEvent) {
    e.preventDefault(); if (!me) return;
    const { error } = await supabase.from("teachers").update({ phone: form.phone || null, qualification: form.qualification || null, bio: form.bio || null }).eq("id", me.id);
    setMsg(error ? "Could not save: " + error.message : "Saved."); reload();
  }
  const standalone = window.matchMedia("(display-mode: standalone)").matches;
  const ios = /iphone|ipad/i.test(navigator.userAgent);
  const inp = "mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm";
  return (
    <div>
      <h1 className="mb-3 font-display text-xl font-semibold text-navy">Me</h1>
      {me ? (
        <>
          <div className="mb-3 rounded-xl border border-gray-200 bg-white p-3 shadow-sm">
            <div className="font-semibold text-navy">{me.first_name} {me.last_name}</div>
            <div className="text-xs text-gray-500">{session?.user.email}</div>
            <div className="mt-2 flex flex-wrap gap-1">
              {me.teacher_grades.map((tg) => <span key={tg.id} className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${tg.role === "quran" ? "bg-emerald-50 text-emerald-deep" : "bg-silver text-navy"}`}>{tg.grades.name} · {tg.role === "quran" ? "Qur'an" : "Homeroom"}</span>)}
              {!me.teacher_grades.length && <span className="text-xs text-gray-400">No grade assigned yet — ask the office.</span>}
            </div>
          </div>
          <form onSubmit={save} className="space-y-2 rounded-xl border border-gray-200 bg-white p-3 shadow-sm">
            <label className="block text-xs font-semibold text-gray-500">Phone<input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className={inp} /></label>
            <label className="block text-xs font-semibold text-gray-500">Qualification<input value={form.qualification} onChange={(e) => setForm({ ...form, qualification: e.target.value })} className={inp} /></label>
            <label className="block text-xs font-semibold text-gray-500">Short bio (shown to parents later)<textarea value={form.bio} onChange={(e) => setForm({ ...form, bio: e.target.value })} rows={3} className={inp} /></label>
            {msg && <div className={`rounded-lg p-2 text-sm ${msg === "Saved." ? "bg-green-50 text-green-800" : "bg-red-50 text-red-700"}`}>{msg}</div>}
            <button type="submit" className="w-full rounded-lg bg-navy py-2.5 text-sm font-semibold text-white">Save</button>
            <p className="text-[11px] text-gray-400">Name and e-mail are changed by the office.</p>
          </form>
        </>
      ) : <p className="text-sm text-gray-400">Loading…</p>}

      {!standalone && (
        <div className="mt-3 rounded-xl border border-gold/50 bg-gold/10 p-3 text-xs text-navy">
          <b>Install this app:</b> {ios ? "tap the Share button in Safari, then “Add to Home Screen”." : "open the browser menu (⋮) and tap “Install app” or “Add to Home screen”."} You stay signed in.
        </div>
      )}
      <button onClick={signOut} className="mt-4 w-full rounded-lg border border-gray-300 bg-white py-2.5 text-sm font-semibold text-gray-600">Sign out</button>
    </div>
  );
}
