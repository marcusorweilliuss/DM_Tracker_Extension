import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../services/api';

interface ResetPasswordPageProps {
  onBack: () => void;
}

export default function ResetPasswordPage({ onBack }: ResetPasswordPageProps) {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || '';

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (newPassword.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    setLoading(true);
    try {
      await api.resetPassword(token, newPassword);
      setSuccess(true);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="w-full max-w-sm bg-white rounded-xl shadow-sm border border-gray-200 p-8 text-center">
          <p className="text-red-500 text-sm mb-4">Invalid reset link. Please request a new one.</p>
          <button onClick={onBack} className="text-sm text-brand-500 hover:underline">
            Back to login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="w-full max-w-sm bg-white rounded-xl shadow-sm border border-gray-200 p-8">
        <h1 className="text-2xl font-bold text-brand-500 mb-2 text-center">DM Tracker</h1>
        <h2 className="text-sm text-gray-500 mb-6 text-center">Set your new password</h2>

        {success ? (
          <div className="text-center">
            <div className="text-green-500 text-4xl mb-3">&#10003;</div>
            <p className="text-sm text-gray-600 mb-4">
              Password reset successfully! You can now log in with your new password.
            </p>
            <button onClick={onBack} className="text-sm text-brand-500 hover:underline">
              Go to login
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <input
              type="password"
              placeholder="New password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-brand-500"
              required
            />
            <input
              type="password"
              placeholder="Confirm new password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-brand-500"
              required
            />

            {error && <p className="text-red-500 text-xs">{error}</p>}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2 bg-brand-500 text-white rounded-lg text-sm font-semibold hover:bg-brand-600 disabled:opacity-60 transition-colors"
            >
              {loading ? 'Resetting...' : 'Reset Password'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
