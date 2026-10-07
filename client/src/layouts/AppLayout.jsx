import { useState } from 'react';
import { Link, NavLink, Outlet } from 'react-router';
import { useAuth } from '../features/auth/AuthContext.js';
import { Button } from '../components/ui/Button.jsx';

const navClass = ({ isActive }) =>
  `rounded-md px-3 py-2 text-sm font-semibold ${isActive ? 'bg-rule/50 text-ink' : 'text-ink-soft hover:text-ink'}`;

export function AppLayout() {
  const { user, logout } = useAuth();
  const [loggingOut, setLoggingOut] = useState(false);

  const handleLogout = async () => {
    setLoggingOut(true);
    await logout();
  };

  return (
    <div className="min-h-screen">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:rounded-md focus:bg-white focus:px-3 focus:py-2"
      >
        Skip to content
      </a>
      <header className="border-b border-rule bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-3">
          <div className="flex items-center gap-6">
            <Link to="/" className="font-reading text-xl font-semibold">
              StudyMate
            </Link>
            <nav aria-label="Main" className="flex gap-1">
              <NavLink to="/" end className={navClass}>
                Library
              </NavLink>
              <NavLink to="/chat" className={navClass}>
                Chat
              </NavLink>
            </nav>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <span className="hidden text-ink-soft sm:inline">{user.name}</span>
            <Button variant="quiet" loading={loggingOut} onClick={handleLogout}>
              Log out
            </Button>
          </div>
        </div>
      </header>
      <main id="main" className="mx-auto max-w-5xl px-6 py-10">
        <Outlet />
      </main>
    </div>
  );
}
