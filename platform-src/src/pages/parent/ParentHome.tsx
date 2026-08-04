import { useEffect, useMemo, useState } from "react";
import { supabase, configMissing } from "../../lib/supabase";
import { useAuth } from "../../lib/auth";

interface Child {
  student_id: string;
  students: {
    id: string;
    first_name: string;
    last_name: string;
    enrollments: { id: string; grade_name: string; school_year: string; status: string }[];
  };
}
interface AttRow { date: string; status: "present" | "late" | "absent" }
interface Ev { id: string; title: string; event_type: string; start_date: string; end_date: string | null; location: string | null; rsvp_enabled: boolean }
interface Ann { id: string; title: string; content: string; category: string; is_pinned: boolean; requires_ack: boolean; publish_date: string | null; announcement_acks: { parent_id: string }[] }

const pill: Record<string, string> = {
  present: "bg-green-100 text-green-700",
  late: "bg-amber-100 text-amber-800",
  absent: "bg-red-100 text-red-700",
};

export default function ParentHome() {
  const { profile, session, signOut } = useAuth();
  const [children, setChildren] = useState<Child[]>([]);
  const [active, setActive] = useState<Child | null>(null);
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [att, setAtt] = useState<AttRow[]>([]);
  const [events, setEvents] = useState<Ev[]>([]);
  const [anns, setAnns] = useState<Ann[]>([]);

  useEffect(() => {
    if (configMissing) return;
    (async () => {
      const today = new Date().toISOString().slice(0, 10);
      const [{ data: kids }, { data: evs }, { data: as }] = await Promise.all([
        supabase.from("parent_students")
          .select("student_id, students ( id, first_name, last_name, enrollments ( id, grade_name, school_year, status ) )")
          .order("student_id"),
        supabase.from("calendar_events").select("id, title, event_type, start_date, end_date, location, rsvp_enabled")
          .gte("start_date", today).order("start_date").limit(6),
        supabase.from("announcements")
          .select("id, title, content, category, is_pinned, requires_ack, publish_date, announcement_acks ( parent_id )")
          .eq("status", "published")
          .order("is_pinned", { ascending: false })
          .order("publish_date", { ascending: false })
          .limit(10),
      ]);
      const c = (kids as unknown as Child[]) ?? [];
      setChildren(c);
      setActive(c[0] ?? null);
      setEvents(evs ?? []);
      setAnns((as as unknown as Ann[]) ?? []);
    })();
  }, []);

  useEffect(() => {
    if (configMissing || !active) return;
    const enrollment = active.students.enrollments.find((e) => e.status === "active") ?? active.students.enrollments[0];
    if (!enrollment) { setAtt([]); return; }
    const [y, m] = month.split("-").map(Number);
    const last = new Date(y, m, 0).getDate();
    supabase.from("attendance")
      .select("date, status")
      .eq("enrollment_id", enrollment.id)
      .gte("date", `${month}-01`)
      .lte("date", `${month}-${String(last).padStart(2, "0")}`)
      .then(({ data }) => setAtt((data as AttRow[]) ?? []));
  }, [active, month]);

  const counts = useMemo(() => {
    const c = { present: 0, late: 0, absent: 0 };
    att.forEach((a) => c[a.status]++);
    return c;
  }, [att]);

  const monthGrid = useMemo(() => {
    const [y, m] = month.split("-").map(Number);
    const first = new Date(y, m - 1, 1);
    const days = new Date(y, m, 0).getDate();
    const map = new Map(att.map((a) => [a.date, a.status]));
    const cells: { day: number | null; status?: string }[] = [];
    for (let i = 0; i < first.getDay(); i++) cells.push({ day: null });
    for (let d = 1; d <= days; d++) {
      const key = `${month}-${String(d).padStart(2, "0")}`;
      cells.push({ day: d, status: map.get(key) });
    }
    return cells;
  }, [month, att]);

  async function ack(a: Ann) {
    if (!session) return;
    await supabase.from("announcement_acks").insert({ announcement_id: a.id, parent_id: session.user.id });
    setAnns((prev) => prev.map((x) => x.id === a.id
      ? { ...x, announcement_acks: [...x.announcement_acks, { parent_id: session.user.id }] } : x));
  }

  const activeEnrollment = active?.students.enrollments.find((e) => e.status === "active") ?? active?.students.enrollments[0];
  const monthOptions = useMemo(() => {
    const opts: string[] = [];
    const now = new Date();
    for (let i = 0; i < 10; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      opts.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
    }
    return opts;
  }, []);

  return (
    <div className="min-h-screen bg-silver">
      <header className="bg-navy px-4 py-3 text-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <div className="flex items-center gap-3">
            <img src="/images/logo.jpg" alt="" className="h-9 w-9 rounded-full object-cover" />
            <div>
              <div className="font-display text-sm font-semibold leading-tight">Falah Academy</div>
              <div className="text-[11px] text-gold-light">Family Portal</div>
            </div>
          </div>
          <div className="flex items-center gap-4 text-sm">
            <span className="hidden text-white/70 sm:inline">{profile?.full_name}</span>
            <button onClick={signOut} className="text-white/70 underline hover:text-white">Sign out</button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl space-y-5 p-4 lg:p-6">
        {configMissing && <div className="rounded-lg bg-amber-50 p-4 text-sm text-amber-800">Platform is not connected to a database yet.</div>}

        {/* Child switcher */}
        {children.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {children.map((c) => (
              <button key={c.student_id} onClick={() => setActive(c)}
                className={`rounded-full px-4 py-1.5 text-sm font-semibold transition ${
                  active?.student_id === c.student_id ? "bg-navy text-white" : "border border-gray-300 bg-white text-gray-600 hover:bg-white/60"}`}>
                {c.students.first_name}
                {c.students.enrollments[0] && <span className="ml-1.5 opacity-70">· {c.students.enrollments.find((e) => e.status === "active")?.grade_name ?? c.students.enrollments[0].grade_name}</span>}
              </button>
            ))}
          </div>
        )}
        {!configMissing && !children.length && (
          <div className="rounded-xl bg-white p-6 text-sm text-gray-500 shadow-sm">
            Assalamu Alaikum{profile ? `, ${profile.full_name}` : ""} — no students are linked to your account yet. Please contact the school office.
          </div>
        )}

        <div className="grid gap-5 lg:grid-cols-5">
          {/* Attendance */}
          <section className="rounded-xl bg-white p-5 shadow-sm lg:col-span-3">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-display text-lg font-semibold text-navy">
                Attendance{active ? ` — ${active.students.first_name}` : ""}
              </h2>
              <select value={month} onChange={(e) => setMonth(e.target.value)}
                className="rounded border border-gray-300 px-2 py-1 text-sm">
                {monthOptions.map((m) => (
                  <option key={m} value={m}>
                    {new Date(m + "-15").toLocaleDateString("en-US", { month: "long", year: "numeric" })}
                  </option>
                ))}
              </select>
            </div>
            <div className="mb-4 grid grid-cols-3 gap-3">
              {(["present", "late", "absent"] as const).map((s) => (
                <div key={s} className={`rounded-lg p-3 text-center ${pill[s]}`}>
                  <div className="font-display text-2xl font-semibold">{counts[s]}</div>
                  <div className="text-xs font-semibold uppercase tracking-wide">{s}</div>
                </div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-1 text-center text-xs">
              {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
                <div key={i} className="py-1 font-bold text-gray-400">{d}</div>
              ))}
              {monthGrid.map((c, i) => (
                <div key={i} className={`flex h-9 items-center justify-center rounded ${
                  c.day == null ? "" :
                  c.status === "present" ? "bg-green-100 font-semibold text-green-700" :
                  c.status === "late" ? "bg-amber-100 font-semibold text-amber-800" :
                  c.status === "absent" ? "bg-red-100 font-semibold text-red-700" :
                  "bg-silver text-gray-400"}`}>
                  {c.day ?? ""}
                </div>
              ))}
            </div>
            {activeEnrollment && (
              <p className="mt-3 text-xs text-gray-400">
                {activeEnrollment.grade_name} · {activeEnrollment.school_year}. Green = present, amber = late, red = absent.
              </p>
            )}
          </section>

          {/* Upcoming events */}
          <section className="rounded-xl bg-white p-5 shadow-sm lg:col-span-2">
            <h2 className="mb-4 font-display text-lg font-semibold text-navy">Upcoming</h2>
            <div className="space-y-3">
              {events.map((e) => (
                <div key={e.id} className="flex gap-3">
                  <div className="w-14 shrink-0 rounded-lg bg-silver py-1 text-center">
                    <div className="text-[10px] font-bold uppercase text-gray-400">
                      {new Date(e.start_date + "T12:00:00").toLocaleDateString("en-US", { month: "short" })}
                    </div>
                    <div className="font-display text-lg font-semibold text-navy">
                      {new Date(e.start_date + "T12:00:00").getDate()}
                    </div>
                  </div>
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold text-gray-800">{e.title}</div>
                    <div className="text-xs text-gray-400">
                      {e.event_type}{e.location ? ` · ${e.location}` : ""}
                    </div>
                  </div>
                </div>
              ))}
              {!events.length && !configMissing && <p className="text-sm text-gray-400">No upcoming events.</p>}
            </div>
          </section>
        </div>

        {/* Announcements */}
        <section className="rounded-xl bg-white p-5 shadow-sm">
          <h2 className="mb-4 font-display text-lg font-semibold text-navy">Announcements</h2>
          <div className="space-y-4">
            {anns.map((a) => {
              const acked = a.announcement_acks.some((x) => x.parent_id === session?.user.id);
              return (
                <div key={a.id} className="border-b pb-4 last:border-0 last:pb-0">
                  <div className="flex flex-wrap items-center gap-2">
                    {a.is_pinned && <span title="Pinned">📌</span>}
                    <span className="font-semibold text-navy">{a.title}</span>
                    <span className="rounded-full bg-silver px-2.5 py-0.5 text-xs text-gray-500">{a.category}</span>
                    <span className="ml-auto text-xs text-gray-400">
                      {a.publish_date ? new Date(a.publish_date).toLocaleDateString() : ""}
                    </span>
                  </div>
                  <p className="mt-1 whitespace-pre-wrap text-sm text-gray-600">{a.content}</p>
                  {a.requires_ack && (
                    acked ? (
                      <p className="mt-2 text-xs font-semibold text-green-600">✓ Acknowledged</p>
                    ) : (
                      <button onClick={() => ack(a)}
                        className="mt-2 rounded-lg bg-gold px-3 py-1.5 text-xs font-semibold text-navy-dark hover:bg-gold-light">
                        Acknowledge
                      </button>
                    )
                  )}
                </div>
              );
            })}
            {!anns.length && !configMissing && <p className="text-sm text-gray-400">No announcements yet.</p>}
          </div>
        </section>
      </main>
    </div>
  );
}
