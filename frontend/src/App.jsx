import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "./hooks/useAuth";
import { LoginPage } from "./pages/LoginPage";
import { SummaryPage } from "./pages/SummaryPage";
import { CyclingPage } from "./pages/CyclingPage";
import { RunningPage } from "./pages/RunningPage";
import { StepsPage } from "./pages/StepsPage";
import { Navbar } from "./components/Navbar";

function AppShell({ user, onLogout }) {
  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar user={user} onLogout={onLogout} />
      <main className="max-w-7xl mx-auto px-4 pt-20 pb-10">
        <Routes>
          <Route path="/" element={<SummaryPage user={user} />} />
          <Route path="/cycling" element={<CyclingPage />} />
          <Route path="/running" element={<RunningPage />} />
          <Route path="/steps" element={<StepsPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  );
}

export default function App() {
  const { user, loading, error, login, logout } = useAuth();

  if (!user) {
    return (
      <LoginPage
        onLogin={login}
        loading={loading}
        error={error}
      />
    );
  }

  return (
    <BrowserRouter>
      <AppShell user={user} onLogout={logout} />
    </BrowserRouter>
  );
}
