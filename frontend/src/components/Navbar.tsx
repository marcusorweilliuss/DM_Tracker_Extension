import { useNavigate } from 'react-router-dom';
import { User } from '../types';

interface NavbarProps {
  user: User;
  onLogout: () => void;
}

export default function Navbar({ user, onLogout }: NavbarProps) {
  const navigate = useNavigate();

  return (
    <nav className="bg-white border-b border-gray-200 px-4 py-3">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        <a href="/" className="text-lg font-bold text-brand-500">
          DM Tracker
        </a>
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/account')}
            className="text-sm text-gray-600 hover:text-brand-500 transition-colors"
          >
            {user.name}
          </button>
          <button
            onClick={onLogout}
            className="text-sm text-gray-400 hover:text-brand-500 transition-colors"
          >
            Log out
          </button>
        </div>
      </div>
    </nav>
  );
}
