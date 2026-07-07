import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext.jsx';
import Layout from './components/Layout.jsx';
import Spinner from './components/Spinner.jsx';

const Login = lazy(() => import('./pages/Login.jsx'));
const Dashboard = lazy(() => import('./pages/Dashboard.jsx'));
const Orders = lazy(() => import('./pages/Orders.jsx'));
const Menu = lazy(() => import('./pages/Menu.jsx'));
const Settings = lazy(() => import('./pages/Settings.jsx'));
const Expired = lazy(() => import('./pages/Expired.jsx'));

function Protected({ children }) {
  const { session, profile, restaurant, loading, expired } = useAuth();
  if (loading) return <Spinner full />;
  if (!session) return <Navigate to="/login" replace />;
  if (!profile || !restaurant) return <Navigate to="/login" replace state={{ noProfile: true }} />;
  if (expired) return <Navigate to="/expired" replace />;
  return <Layout>{children}</Layout>;
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Suspense fallback={<Spinner full />}>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/expired" element={<Expired />} />
            <Route path="/" element={<Protected><Dashboard /></Protected>} />
            <Route path="/orders" element={<Protected><Orders /></Protected>} />
            <Route path="/menu" element={<Protected><Menu /></Protected>} />
            <Route path="/settings" element={<Protected><Settings /></Protected>} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </AuthProvider>
    </BrowserRouter>
  );
}
