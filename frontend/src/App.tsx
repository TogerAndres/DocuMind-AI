import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Login } from "@/pages/Login";
import { Dashboard } from "@/pages/Dashboard";
import { Admin } from "@/pages/Admin";

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-ink-500 text-sm">
        Cargando…
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function RequireAdmin({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  if (user && user.role !== "admin") return <Navigate to="/" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        path="/"
        element={
          <RequireAuth>
            <Dashboard />
          </RequireAuth>
        }
      />
      <Route
        path="/admin"
        element={
          <RequireAuth>
            <RequireAdmin>
              <Admin />
            </RequireAdmin>
          </RequireAuth>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
