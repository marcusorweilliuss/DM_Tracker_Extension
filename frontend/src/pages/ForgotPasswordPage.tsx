import { useState } from 'react';
import { api } from '../services/api';

interface ForgotPasswordPageProps {
  onBack: () => void;
}

export default function ForgotPasswordPage({ onBack }: ForgotPasswordPageProps) {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await api.forgotPassword(email);
      setSent(true);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="w-full max-w-sm bg-white rounded-xl shadow-sm border border-gray-200 p-8">
        <h1 className="text-2xl font-bold text-brand-500 mb-2 text-center">DM Tracker</h1>
        <h2 className="text-sm text-gray-500 mb-6 text-center">Reset your password</h2>

        {sent ? (
          <div className="text-center">
            <div className="text-green-500 text-4xl mb-3">&#10003;</div>
            <p className="text-sm text-gray-600 mb-4">
              If that email is registered, we've sent a reset link. Check your inbox (and spam folder).
            </p>
            <button
              onClick={onBack}
              className="text-sm text-brand-500 hover:underline"
            >
              Back to login
            </button>
          </div>
        ) : (
          <>
            <form onSubmit={handleSubmit} className="space-y-4">
              <input
                type="email"
                placeholder="Enter your email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-brand-500"
                required
              />

              {error && <p className="text-red-500 text-xs">{error}</p>}

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2 bg-brand-500 text-white rounded-lg text-sm font-semibold hover:bg-brand-600 disabled:opacity-60 transition-colors"
              >
                {loading ? 'Sending...' : 'Send Reset Link'}
              </button>
            </form>

            <p className="text-center text-xs text-gray-400 mt-4">
              <button onClick={onBack} className="text-brand-500 hover:underline">
                Back to login
              </button>
            </p>
          </>
        )}
      </div>
    </div>
  );
}
