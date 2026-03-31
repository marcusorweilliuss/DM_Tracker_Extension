import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './hooks/useAuth';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import ConversationPage from './pages/ConversationPage';
import Navbar from './components/Navbar';

export default function App() {
  const { auth, login, logout, isLoggedIn } = useAuth();

  if (!isLoggedIn) {
    return <LoginPage onLogin={login} />;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar user={auth!.user} onLogout={logout} />
      <main className="max-w-7xl mx-auto px-4 py-6">
        <Routes>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/conversation/:id" element={<ConversationPage />} />
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </main>
    </div>
  );
}
