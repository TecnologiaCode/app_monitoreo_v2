// src/App.jsx
import React from 'react';
import { ConfigProvider } from 'antd';
import esES from 'antd/locale/es_ES';
import { Routes, Route, Navigate, useParams } from 'react-router-dom';

import LoginPage from './pages/LoginPage.jsx';
import DashboardLayout from './components/DashboardLayout.jsx';
import ProtectedRoute from './components/ProtectedRoute.jsx';
import RequirePermission from './components/RequirePermission.jsx';

import DashboardPage from './pages/DashboardPage.jsx';
import MapaPage from './pages/MapaPage.jsx';
import UsuariosPage from './pages/UsuariosPage.jsx';
import EquiposPage from './pages/EquiposPage.jsx';
import HistorialPage from './pages/HistorialPage.jsx';
import NotificacionesPage from './pages/NotificacionesPage.jsx';
import ConfiguracionPage from './pages/ConfiguracionPage.jsx';
import PerfilPage from './pages/PerfilPage.jsx';
import ProyectosPage from './pages/ProyectosPage.jsx';

// Monitoreos
import MonitoreoPage from './pages/MonitoreoPage.jsx';
import IluminacionPage from './pages/IluminacionPage.jsx';
import VentilacionPage from './pages/VentilacionPage.jsx';
import ParticulasPage from './pages/ParticulasPage.jsx';
import GasesPage from './pages/GasesPage.jsx';
import RuidoPage from './pages/RuidoPage.jsx';
import EstresFrioPage from './pages/EstresFrioPage.jsx';
//import EstresCalorPage from './pages/EstresCalorPage.jsx';
import VibracionPage from './pages/VibracionPage.jsx';
import ErgonomiaPage from './pages/ErgonomiaPage.jsx';
import DosimetriaPage from './pages/DosimetriaPage.jsx';

// Routes
import EstresCalorRoute from './pages/EstresCalorRoute.jsx';

const ProyectoDetailPage = () => {
  const { projectId } = useParams();
  return (
    <div>
      <h2>Detalles del Proyecto</h2>
      <p>Mostrando info para Proyecto ID: {projectId}</p>
    </div>
  );
};

function App() {
  return (
    <ConfigProvider locale={esES}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />

        {/* Rutas protegidas por sesión */}
        <Route element={<ProtectedRoute />}>
          <Route path="/" element={<DashboardLayout />}>
            <Route index element={<DashboardPage />} />

            {/* Usuarios: sólo quienes tengan users:read */}
            <Route
              path="usuarios"
              element={
                <RequirePermission perm="users:read">
                  <UsuariosPage />
                </RequirePermission>
              }
            />

            {/* Historial: luego afinamos permisos (ej. reports:read / reports:export) */}
            <Route path="historial" element={<HistorialPage />} />

            {/* 
              ⚙️ Equipos: AHORA alineado con Sidebar.
              ✅ Usamos 'equipments:read' (igual que en SidebarContent).
              Admin pasa siempre por AuthContext.can()
            */}
            <Route
              path="equipos"
              element={
                <RequirePermission perm="equipments:read"> {/* CAMBIO CLAVE */}
                  <EquiposPage />
                </RequirePermission>
              }
            />

            <Route path="configuracion" element={<ConfiguracionPage />} />
            <Route path="perfil" element={<PerfilPage />} />

            {/* Proyectos (listado general). Permiso 'projects:read' */}
            <Route
              path="proyectos"
              element={
                <RequirePermission perm="projects:read">
                  <ProyectosPage />
                </RequirePermission>
              }
            />

            {/* Detalle proyecto */}
            <Route
              path="proyectos/:projectId"
              element={
                <RequirePermission perm="projects:read">
                  <ProyectoDetailPage />
                </RequirePermission>
              }
            />

            {/* Mapa / Monitoreos / Notificaciones del proyecto */}
            <Route
              path="proyectos/:projectId/mapa"
              element={
                <RequirePermission perm="projects:read">
                  <MapaPage />
                </RequirePermission>
              }
            />

            <Route
              path="proyectos/:projectId/monitoreo"
              element={
                <RequirePermission perm="monitors:read">
                  <MonitoreoPage />
                </RequirePermission>
              }
            />

            <Route
              path="proyectos/:projectId/notificaciones"
              element={
                <RequirePermission perm="projects:read">
                  <NotificacionesPage />
                </RequirePermission>
              }
            />

            {/* Rutas de Mediciones */}
            <Route
              path="proyectos/:projectId/monitoreo/:monitoreoId/iluminacion"
              element={
                <RequirePermission perm="monitors:read">
                  <IluminacionPage />
                </RequirePermission>
              }
            />
            <Route
              path="proyectos/:projectId/monitoreo/:monitoreoId/ventilacion"
              element={
                <RequirePermission perm="monitors:read">
                  <VentilacionPage />
                </RequirePermission>
              }
            />
            <Route
              path="proyectos/:projectId/monitoreo/:monitoreoId/particulas"
              element={
                <RequirePermission perm="monitors:read">
                  <ParticulasPage />
                </RequirePermission>
              }
            />
            <Route
              path="proyectos/:projectId/monitoreo/:monitoreoId/gases"
              element={
                <RequirePermission perm="monitors:read">
                  <GasesPage />
                </RequirePermission>
              }
            />
            <Route
              path="proyectos/:projectId/monitoreo/:monitoreoId/ruido"
              element={
                <RequirePermission perm="monitors:read">
                  <RuidoPage />
                </RequirePermission>
              }
            />
            <Route
              path="proyectos/:projectId/monitoreo/:monitoreoId/estres-frio"
              element={
                <RequirePermission perm="monitors:read">
                  <EstresFrioPage />
                </RequirePermission>
              }
            />

            {/*este codigo esta comentado porque tiene codigo refactorizado*/}
            
            {/*<Route
              path="proyectos/:projectId/monitoreo/:monitoreoId/estres-calor"
              element={
                <RequirePermission perm="monitors:read">
                  <EstresCalorPage />
                </RequirePermission>
              }
            />*/}
{/*codigo refactorizado*/}
            <Route
              path="proyectos/:projectId/monitoreo/:monitoreoId/estres-calor"
              element={
                <RequirePermission perm="monitors:read">
                  <EstresCalorRoute />
                </RequirePermission>
              }
            />

            <Route
              path="proyectos/:projectId/monitoreo/:monitoreoId/vibracion"
              element={
                <RequirePermission perm="monitors:read">
                  <VibracionPage />
                </RequirePermission>
              }
            />
            <Route
              path="proyectos/:projectId/monitoreo/:monitoreoId/ergonomia"
              element={
                <RequirePermission perm="monitors:read">
                  <ErgonomiaPage />
                </RequirePermission>
              }
            />
            <Route
              path="proyectos/:projectId/monitoreo/:monitoreoId/dosimetria"
              element={
                <RequirePermission perm="monitors:read">
                  <DosimetriaPage />
                </RequirePermission>
              }
            />

            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </ConfigProvider>
  );
}

export default App;
