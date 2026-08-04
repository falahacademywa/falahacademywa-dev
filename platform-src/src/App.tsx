import { HashRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, RequireRole } from "./lib/auth";
import Login from "./pages/Login";
import AdminLayout from "./layouts/AdminLayout";
import Dashboard from "./pages/admin/Dashboard";
import Students from "./pages/admin/Students";
import Placeholder from "./pages/admin/Placeholder";
import Admissions from "./pages/admin/Admissions";
import Parents from "./pages/admin/Parents";
import Teachers from "./pages/admin/Teachers";
import StudentProfile from "./pages/admin/StudentProfile";
import Settings from "./pages/admin/Settings";
import CalendarAdmin from "./pages/admin/CalendarAdmin";
import AnnouncementsAdmin from "./pages/admin/AnnouncementsAdmin";
import ParentHome from "./pages/parent/ParentHome";

// HashRouter so deep links work on GitHub Pages without server rewrites.
export default function App() {
  return (
    <AuthProvider>
      <HashRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/admin" element={<RequireRole role="admin"><AdminLayout /></RequireRole>}>
            <Route index element={<Dashboard />} />
            <Route path="students" element={<Students />} />
            <Route path="students/:id" element={<StudentProfile />} />
            <Route path="admissions" element={<Admissions />} />
            <Route path="parents" element={<Parents />} />
            <Route path="teachers" element={<Teachers />} />
            <Route path="fees" element={<Placeholder title="Fees" phase="Phase 3" />} />
            <Route path="calendar" element={<CalendarAdmin />} />
            <Route path="announcements" element={<AnnouncementsAdmin />} />
            <Route path="settings" element={<Settings />} />
          </Route>
          <Route path="/parent" element={<RequireRole role="parent"><ParentHome /></RequireRole>} />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </HashRouter>
    </AuthProvider>
  );
}
