import { useState } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './hooks/useAuth';
import LoginPage from './pages/LoginPage';
import ForgotPasswordPage from './pages/ForgotPasswordPage';
import ResetPasswordPage from './pages/ResetPasswordPage';
import DashboardPage from './pages/DashboardPage';
import ConversationPage from './pages/ConversationPage';
import AccountPage from './pages/AccountPage';
import Navbar from './components/Navbar';

export default function App() {
  const { auth, login, logout, isLoggedIn } = useAuth();
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const location = useLocation();

  // Always allow reset-password page (accessed from email link)
  if (location.pathname === '/reset-password') {
    return <ResetPasswordPage onBack={() => window.location.href = '/'} />;
  }

  if (!isLoggedIn) {
    if (showForgotPassword) {
      return <ForgotPasswordPage onBack={() => setShowForgotPassword(false)} />;
    }
    return <LoginPage onLogin={login} onForgotPassword={() => setShowForgotPassword(true)} />;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar user={auth!.user} onLogout={logout} />
      <main className="max-w-7xl mx-auto px-4 py-6">
        <Routes>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/conversation/:id" element={<ConversationPage />} />
          <Route path="/account" element={<AccountPage user={auth!.user} />} />
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </main>
    </div>
  );
}
