import React from 'react';
import { ConfigProvider } from 'antd';   // ✅ Proveedor de configuración global
import esES from 'antd/locale/es_ES';   // ✅ Idioma español (para Ant Design v5)
import { Routes, Route, Navigate, useParams } from 'react-router-dom';

// Componentes Principales
import LoginPage from './pages/LoginPage.jsx';
import DashboardLayout from './components/DashboardLayout.jsx';
import ProtectedRoute from './components/ProtectedRoute.jsx';

// Páginas del Dashboard
import DashboardPage from './pages/DashboardPage.jsx';
import MapaPage from './pages/MapaPage.jsx';
import UsuariosPage from './pages/UsuariosPage.jsx';
import EquiposPage from './pages/EquiposPage.jsx';
import HistorialPage from './pages/HistorialPage.jsx';
import NotificacionesPage from './pages/NotificacionesPage.jsx';
import ConfiguracionPage from './pages/ConfiguracionPage.jsx';
import PerfilPage from './pages/PerfilPage.jsx';
import ProyectosPage from './pages/ProyectosPage.jsx';

// --- Páginas de Monitoreo y Mediciones ---
import MonitoreoPage from './pages/MonitoreoPage.jsx';
import IluminacionPage from './pages/IluminacionPage.jsx';
import VentilacionPage from './pages/VentilacionPage.jsx';
import ParticulasPage from './pages/ParticulasPage.jsx';
import GasesPage from './pages/GasesPage.jsx';
import RuidoPage from './pages/RuidoPage.jsx';
import EstresFrioPage from './pages/EstresFrioPage.jsx';
import EstresCalorPage from './pages/EstresCalorPage.jsx';
import VibracionPage from './pages/VibracionPage.jsx';
import ErgonomiaPage from './pages/ErgonomiaPage.jsx';

// --- 1. AÑADIR IMPORTACIÓN FALTANTE ---
// Asegúrate de que el nombre del archivo (DosimetriaPage.jsx) sea correcto
import DosimetriaPage from './pages/DosimetriaPage.jsx';
// --- FIN IMPORTACIÓN ---



// Componente simple para ver detalle de proyecto
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
            {/* Ruta pública */}
            <Route path="/login" element={<LoginPage />} />

            {/* Rutas protegidas */}
            <Route element={<ProtectedRoute />}>
                {/* Layout principal del dashboard */}
                <Route path="/" element={<DashboardLayout />}>
                    {/* Rutas de primer nivel dentro del dashboard */}
                    <Route index element={<DashboardPage />} />
                    <Route path="historial" element={<HistorialPage />} />
                    <Route path="usuarios" element={<UsuariosPage />} />
                    <Route path="equipos" element={<EquiposPage />} />
                    <Route path="configuracion" element={<ConfiguracionPage />} />
                    <Route path="perfil" element={<PerfilPage />} />
                    <Route path="proyectos" element={<ProyectosPage />} />

                    {/* Proyecto específico */}
                    <Route path="proyectos/:projectId" element={<ProyectoDetailPage />} />
                    <Route path="proyectos/:projectId/mapa" element={<MapaPage />} />
                    <Route
                        path="proyectos/:projectId/monitoreo"
                        element={<MonitoreoPage />}
                    />
                    <Route
                        path="proyectos/:projectId/notificaciones"
                        element={<NotificacionesPage />}
                    />

                    {/* --- Rutas de Mediciones (Anidadas) --- */}
label="Rutas de Mediciones (Anidadas)"
                    <Route path="proyectos/:projectId/monitoreo/:monitoreoId/iluminacion" element={<IluminacionPage />} />
                    <Route path="proyectos/:projectId/monitoreo/:monitoreoId/ventilacion" element={<VentilacionPage />} />
                    <Route path="proyectos/:projectId/monitoreo/:monitoreoId/particulas" element={<ParticulasPage />} />
                    <Route path="proyectos/:projectId/monitoreo/:monitoreoId/gases" element={<GasesPage />} />
                    <Route path="proyectos/:projectId/monitoreo/:monitoreoId/ruido" element={<RuidoPage />} />
                    <Route path="proyectos/:projectId/monitoreo/:monitoreoId/estres-frio" element={<EstresFrioPage />} />
                    <Route path="proyectos/:projectId/monitoreo/:monitoreoId/estres-calor" element={<EstresCalorPage />} />
                    <Route path="proyectos/:projectId/monitoreo/:monitoreoId/vibracion" element={<VibracionPage />} />
                    <Route path="proyectos/:projectId/monitoreo/:monitoreoId/ergonomia" element={<ErgonomiaPage />} />
                    
                    {/* --- 2. AÑADIR RUTA FALTANTE PARA DOSIMETRIA --- */}
                    <Route
                        path="proyectos/:projectId/monitoreo/:monitoreoId/dosimetria"
                        element={<DosimetriaPage />}
                    />
                    {/* --- FIN RUTA AÑADIDA --- */}

                    {/* Catch-all dentro del layout */}
                    <Route path="*" element={<Navigate to="/" replace />} />
                </Route>
            </Route>
        </Routes>
    </ConfigProvider>
        
    );
}

export default App;

