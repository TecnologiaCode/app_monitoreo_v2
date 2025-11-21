import React from 'react';
import { Navigate } from 'react-router-dom';
import { Spin, Result } from 'antd';
import { useAuth } from '../context/AuthContext';

const Center = ({ children }) => (
  <div style={{ minHeight: "60vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
    {children}
  </div>
);

const RequirePermission = ({ perm, children }) => {
  // 1. Hooks al principio
  const { user, isAuthenticated, loadingAuthState, can, profile } = useAuth();

  // 2. Retornos condicionales

  // Si está cargando la autenticación global
  if (loadingAuthState) {
    return <Center><Spin size="large" /></Center>;
  }

  // Si no hay usuario
  if (!isAuthenticated || !user) {
    return <Navigate to="/login" replace />;
  }

  // Si el perfil aún no carga (para evitar falso negativo de permisos)
  if (!profile) {
     return <Center><Spin size="large" tip="Verificando perfil..." /></Center>;
  }

  // 3. Verificación de lógica
  const hasPermission = can(perm);
  const isAdmin = profile?.rol === 'Admin';

  // Admin pasa siempre, o si tiene el permiso específico
  if (!perm && !isAdmin && !hasPermission) {
     // Si perm es undefined pero requerimos validación general
     // (Este caso es raro, normalmente perm tiene valor)
  }

  if (perm && !isAdmin && !hasPermission) {
    return (
      <Center>
        <Result 
          status="403" 
          title="403" 
          subTitle="No tienes permisos para ver esta sección."
          extra={<div>Permiso requerido: <b>{perm}</b></div>}
        />
      </Center>
    );
  }

  return children;
};

export default RequirePermission;

