// src/components/SidebarContent.jsx

import React, { useState, useEffect, useMemo } from 'react';
import { Menu, Spin, message } from 'antd';
import { useLocation, Link } from 'react-router-dom';
import {
  DashboardOutlined,
  TeamOutlined,
  EnvironmentOutlined,
  HistoryOutlined,
  BellOutlined,
  VideoCameraOutlined,
  SettingOutlined,
  ProjectOutlined,
  FolderOpenOutlined,
  ToolOutlined,
} from '@ant-design/icons';
import '../assets/css/Sidebar.css';
import { supabase } from '../supabaseClient.js';
import { useAuth } from '../context/AuthContext';          // ✅ usamos AuthContext

// --- Lógica para abrir submenús según la ruta actual ---
const getOpenKeys = (pathname, items) => {
  const openKeys = [];
  const gestionSub = items.find(item => item.key === 'gestion-proyectos-sub');

  if (pathname.startsWith('/proyectos') && gestionSub) {
    openKeys.push(gestionSub.key);

    if (gestionSub.children) {
      for (const projectSub of gestionSub.children) {
        const projectId = projectSub.key?.split('-')[1];
        if (projectId && pathname.startsWith(`/proyectos/${projectId}`)) {
          openKeys.push(projectSub.key);
          break;
        }
      }
    }
  }
  return openKeys;
};

const SidebarContent = ({ collapsed }) => {
  const location = useLocation();
  const { can, profile } = useAuth();                      // ✅ traemos perfil y helper de permisos

  const [projectsList, setProjectsList] = useState([]);
  const [loadingProjects, setLoadingProjects] = useState(true);

  // Carga de proyectos desde Supabase
  useEffect(() => {
    const fetchProjects = async () => {
      setLoadingProjects(true);
      try {
        const { data, error } = await supabase
          .from('proyectos')
          .select('id, nombre')
          .order('nombre', { ascending: true });

        if (error) throw error;

        const projectsData = data.map(project => ({
          id: project.id,
          nombre: project.nombre || 'Proyecto sin nombre',
        }));

        // TODO: cuando tengamos claro el modelo de asignación usuario-proyecto,
        // aquí se puede filtrar projectsData para mostrar SOLO los proyectos
        // asignados al usuario actual (profile.id, por ejemplo).

        setProjectsList(projectsData);
      } catch (error) {
        console.error('Error al obtener proyectos (Supabase): ', error);
        message.error('Error al cargar la lista de proyectos.');
      } finally {
        setLoadingProjects(false);
      }
    };

    fetchProjects();
  }, []);

  // ---- Lógica de permisos para el menú ----
  const isAdmin = profile?.rol === 'Admin';

  const canSeeHistorial = isAdmin || can('reports:read');
  const canSeeProjects = isAdmin || can('projects:read');
  const canSeeUsers = isAdmin || can('users:read');
  const canSeeEquipos = isAdmin || can('equipments:read');
  const canSeeSettings = isAdmin || can('settings:write');

  // Estructura de items del menú, condicionada por permisos
  const items = useMemo(() => {
    // Sub-opciones de visualización dentro de cada proyecto
    const visualizationOptions = (projectId) => [
      {
        key: `/proyectos/${projectId}/mapa`,
        icon: <EnvironmentOutlined />,
        label: <Link to={`/proyectos/${projectId}/mapa`}>Mapa</Link>,
      },
      {
        key: `/proyectos/${projectId}/monitoreo`,
        icon: <VideoCameraOutlined />,
        label: <Link to={`/proyectos/${projectId}/monitoreo`}>Monitoreo</Link>,
      },
      {
        key: `/proyectos/${projectId}/notificaciones`,
        icon: <BellOutlined />,
        label: <Link to={`/proyectos/${projectId}/notificaciones`}>Notificaciones</Link>,
      },
    ];

    const baseItems = [];

    // 1) Dashboard: SIEMPRE visible (Admin, Usuario, Invitado)
    baseItems.push({
      key: '/',
      icon: <DashboardOutlined />,
      label: <Link to="/">Dashboard</Link>,
    });

    // 2) Historial / Reporte (solo con permiso)
    if (canSeeHistorial) {
      baseItems.push({
        key: '/historial',
        icon: <HistoryOutlined />,
        label: <Link to="/historial">Historial / Reportes</Link>,
      });
    }

    // 3) Gestión de Proyectos (solo con projects:read)
    if (canSeeProjects) {
      baseItems.push({
        key: 'gestion-proyectos-sub',
        icon: <ProjectOutlined />,
        label: 'Gestión de Proyectos',
        children: [
          {
            key: '/proyectos',
            icon: <ProjectOutlined />,
            label: <Link to="/proyectos">Ver Todos</Link>,
          },
          { type: 'divider' },
          ...(loadingProjects
            ? [
                {
                  key: 'loading-projects',
                  label: 'Cargando...',
                  disabled: true,
                  icon: <Spin size="small" />,
                },
              ]
            : projectsList.map(project => ({
                key: `project-${project.id}`,
                icon: <FolderOpenOutlined />,
                label: project.nombre,
                children: visualizationOptions(project.id),
              }))),
        ],
      });
    }

    // 4) Usuarios (solo admin o quien tenga users:read)
    if (canSeeUsers) {
      baseItems.push({
        key: '/usuarios',
        icon: <TeamOutlined />,
        label: <Link to="/usuarios">Usuarios</Link>,
      });
    }

    // 5) Equipos de monitoreo (solo admin o equipments:read)
    if (canSeeEquipos) {
      baseItems.push({
        key: '/equipos',
        icon: <ToolOutlined />,
        label: <Link to="/equipos">Equipos</Link>,
      });
    }

    // 6) Configuración (solo admin o settings:write)
    if (canSeeSettings) {
      baseItems.push({
        key: '/configuracion',
        icon: <SettingOutlined />,
        label: <Link to="/configuracion">Configuración</Link>,
      });
    }

    return baseItems;
  }, [
    canSeeHistorial,
    canSeeProjects,
    canSeeUsers,
    canSeeEquipos,
    canSeeSettings,
    loadingProjects,
    projectsList,
  ]);

  // --- Submenús abiertos según ruta actual ---
  const [openKeys, setOpenKeys] = useState(() => getOpenKeys(location.pathname, items));

  useEffect(() => {
    if (!collapsed) {
      setOpenKeys(getOpenKeys(location.pathname, items));
    } else {
      setOpenKeys([]);
    }
  }, [location.pathname, collapsed, items]);

  const onOpenChange = (keys) => {
    const rootSubmenuKeys = items.filter(item => item.children).map(item => item.key);
    const latestOpenKey = keys.find(key => openKeys.indexOf(key) === -1);

    if (rootSubmenuKeys.includes(latestOpenKey)) {
      setOpenKeys(latestOpenKey ? [latestOpenKey] : []);
    } else {
      const currentRootOpen = openKeys.find(key => rootSubmenuKeys.includes(key));
      setOpenKeys(
        currentRootOpen
          ? [currentRootOpen, ...keys.filter(k => k !== currentRootOpen)]
          : keys
      );
    }
  };

  return (
    <>
      {/* Logo */}
      <div
        style={{
          height: '64px',
          margin: '16px',
          color: 'white',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '1.2rem',
          fontWeight: 'bold',
          background: 'rgba(255, 255, 255, 0.1)',
          borderRadius: '8px',
          overflow: 'hidden',
        }}
      >
        {collapsed ? 'APP' : 'METRIC'}
      </div>

      {/* Menú lateral */}
      <Menu
        theme="dark"
        mode="inline"
        selectedKeys={[location.pathname]}
        openKeys={openKeys}
        onOpenChange={onOpenChange}
        items={items}
      />
    </>
  );
};

export default SidebarContent;
