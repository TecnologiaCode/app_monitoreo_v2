import React, { useEffect } from 'react';
import { Navigate, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Spin } from 'antd';

const FullscreenSpin = () => (
  <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
    <Spin size="large" tip="Cargando sesión..." />
  </div>
);

export default function ProtectedRoute() {
  // 1. TODOS los Hooks deben ir al principio
  const { isAuthenticated, loadingAuthState, profile, logout } = useAuth();
  const navigate = useNavigate();

  // 2. Efecto para auto-logout si el perfil pasa a inactivo
  useEffect(() => {
    if (!loadingAuthState && isAuthenticated && profile && profile.estado === 'inactivo') {
      (async () => {
        await logout();
        navigate('/login?reason=inactivo', { replace: true });
      })();
    }
  }, [loadingAuthState, isAuthenticated, profile, logout, navigate]);

  // 3. Retornos condicionales

  // Mientras Supabase verifica sesión
  if (loadingAuthState) {
    return <FullscreenSpin />;
  }

  // Si terminó de cargar y no hay usuario, mandar al login
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // Si hay usuario pero el perfil aún está cargando
  if (!profile) {
    return <FullscreenSpin />;
  }

  // Si el perfil está marcado como inactivo, mostramos spinner mientras el efecto hace logout + redirect
  if (profile.estado === 'inactivo') {
    return <FullscreenSpin />;
  }

  // Si todo está bien, renderiza la aplicación
  return <Outlet />;
}
