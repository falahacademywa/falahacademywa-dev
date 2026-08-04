import { useAuth } from "../../lib/auth";

// Parent Portal shell — full dashboard arrives in Phase 2.
export default function ParentHome() {
  const { profile, signOut } = useAuth();
  return (
    <div className="mx-auto max-w-3xl p-8">
      <div className="rounded-2xl bg-white p-8 shadow">
        <h1 className="font-display text-2xl font-semibold text-navy">
          Assalamu Alaikum{profile ? `, ${profile.full_name}` : ""}
        </h1>
        <p className="mt-2 text-gray-600">
          The Parent Portal is being rolled out in phases. Attendance, assignments,
          Qur'an progress, fees, and the school calendar will appear here as each
          module goes live.
        </p>
        <button onClick={signOut} className="mt-6 text-sm text-royal underline">Sign out</button>
      </div>
    </div>
  );
}
