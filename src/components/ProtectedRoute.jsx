import React from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext'; // Importa el hook
import { Spin } from 'antd'; // Importa Spin

/**
 * Componente Guardia:
 * 1. Muestra Spinner mientras se verifica el estado auth inicial.
 * 2. Si autenticado => Muestra contenido protegido (Outlet).
 * 3. Si NO autenticado => Redirige a /login.
 */
const ProtectedRoute = () => {
  // Obtiene estados del contexto Auth
  const { isAuthenticated, loadingAuthState } = useAuth();
  const location = useLocation();

  // Log detallado para depuración en CADA renderizado
  console.log(
    `ProtectedRoute Check: Path=${location.pathname}, IsAuthenticated=${isAuthenticated}, Loading=${loadingAuthState}`
  );

  // --- 1. Estado de Carga ---
  // Mientras onAuthStateChanged no ha dado la primera respuesta
  if (loadingAuthState) {
    console.log("ProtectedRoute: >>> WAITING for auth state...");
    // Muestra un spinner ocupando toda la pantalla
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <Spin size="large" tip="Verificando sesión..." />
      </div>
    );
  }

  // --- 2. Estado Determinado (loadingAuthState es false aquí) ---
  if (isAuthenticated) {
    // Si SÍ está autenticado...
    console.log("ProtectedRoute: >>> AUTHENTICATED. Rendering <Outlet />");
    // ...renderiza el contenido anidado (DashboardLayout y sus hijos).
    return <Outlet />;
  } else {
    // Si NO está autenticado...
    console.log("ProtectedRoute: >>> NOT Authenticated. Navigating to /login");
    // ...redirige a la página de login.
    return <Navigate to="/login" replace state={{ from: location }} />;
  }
};

export default ProtectedRoute;