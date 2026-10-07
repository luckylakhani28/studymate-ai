import { Navigate, Outlet, useLocation } from 'react-router';
import { useAuth } from './AuthContext.js';
import { FullPageLoader } from '../../components/ui/Spinner.jsx';

export function ProtectedRoute() {
  const { status } = useAuth();
  const location = useLocation();
  if (status === 'loading') return <FullPageLoader />;
  if (status === 'anonymous') return <Navigate to="/login" replace state={{ from: location }} />;
  return <Outlet />;
}

export function GuestRoute() {
  const { status } = useAuth();
  const location = useLocation();
  if (status === 'loading') return <FullPageLoader />;
  if (status === 'authenticated')
    return <Navigate to={location.state?.from?.pathname ?? '/'} replace />;
  return <Outlet />;
}
