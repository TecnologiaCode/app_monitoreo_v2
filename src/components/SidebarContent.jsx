import React, { useState, useEffect, useMemo } from 'react';
import { Menu, Spin, message } from 'antd';
import { useLocation, Link } from 'react-router-dom'; // Añadido Link para los items
import {
  DashboardOutlined, TeamOutlined, EnvironmentOutlined, HistoryOutlined,
  BellOutlined, VideoCameraOutlined, SettingOutlined,
  ProjectOutlined, FolderOpenOutlined,
  ToolOutlined
} from '@ant-design/icons';
import '../assets/css/Sidebar.css';
// 1. IMPORTAR SUPABASE
import { supabase } from '../supabaseClient.js';
// 2. QUITAR IMPORTACIONES DE FIRESTORE
// import { db } from '../firebaseConfig.js';
// import { collection, onSnapshot, query, orderBy } from "firebase/firestore";

// --- Lógica para Abrir Submenús (Sin cambios) ---
const getOpenKeys = (pathname, items) => {
  const openKeys = [];
  const gestionSub = items.find(item => item.key === 'gestion-proyectos-sub');

  if (pathname.startsWith('/proyectos') && gestionSub) {
    openKeys.push(gestionSub.key);

    if (gestionSub.children) {
      for (const projectSub of gestionSub.children) {
        // La key del submenú es `project-${project.id}`
        // Buscamos si alguna ruta hija empieza con `/proyectos/${project.id}`
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
// --- Fin Lógica Submenús ---


const SidebarContent = ({ collapsed, onMenuClick }) => {
  const location = useLocation();

  // Estados (Sin cambios)
  const [projectsList, setProjectsList] = useState([]);
  const [loadingProjects, setLoadingProjects] = useState(true);

  // --- useEffect para cargar proyectos (MODIFICADO) ---
  useEffect(() => {
    const fetchProjects = async () => {
        setLoadingProjects(true);
        try {
            // 3. Usar Supabase para leer 'proyectos'
            const { data, error } = await supabase
                .from('proyectos')
                .select('id, nombre') // Solo necesitamos id y nombre para el menú
                .order('nombre', { ascending: true });

            if (error) throw error;

            // Mapeo no es estrictamente necesario si solo seleccionas id y nombre,
            // pero lo mantenemos por si acaso la estructura de datos cambia.
            const projectsData = data.map(project => ({
                id: project.id,
                nombre: project.nombre || 'Proyecto sin nombre'
            }));

            setProjectsList(projectsData);

        } catch (error) {
            console.error("Error al obtener proyectos (Supabase): ", error);
            message.error("Error al cargar la lista de proyectos.");
        } finally {
            setLoadingProjects(false);
        }
    };

    fetchProjects();

    // Nota: Eliminamos la lógica de 'unsubscribe' de onSnapshot.
    // Para actualizaciones en tiempo real, se necesitaría Supabase Realtime.
  }, []); // Se ejecuta solo una vez al montar

  // --- Estructura de 'items' Anidada (MODIFICADO para usar Link) ---
  const items = useMemo(() => {
    // Definimos las opciones de visualización
    const visualizationOptions = (projectId) => [
      { key: `/proyectos/${projectId}/mapa`, icon: <EnvironmentOutlined />, label: <Link to={`/proyectos/${projectId}/mapa`}>Mapa</Link> },
      { key: `/proyectos/${projectId}/monitoreo`, icon: <VideoCameraOutlined />, label: <Link to={`/proyectos/${projectId}/monitoreo`}>Monitoreo</Link> },
      { key: `/proyectos/${projectId}/notificaciones`, icon: <BellOutlined />, label: <Link to={`/proyectos/${projectId}/notificaciones`}>Notificaciones</Link> },
    ];

    // Construimos el array 'items'
    return [
      { key: '/', icon: <DashboardOutlined />, label: <Link to="/">Dashboard</Link> },
      { key: '/historial', icon: <HistoryOutlined />, label: <Link to="/historial">Historial o Reporte</Link> },
      {
        key: 'gestion-proyectos-sub',
        icon: <ProjectOutlined />,
        label: 'Gestión de Proyectos',
        children: [
          { key: '/proyectos', icon: <ProjectOutlined />, label: <Link to="/proyectos">Ver Todos</Link> },
          { type: 'divider' },
          ...(loadingProjects
              ? [{ key: 'loading', label: 'Cargando...', disabled: true, icon: <Spin size="small"/> }]
              : projectsList.map(project => ({
                  // La key del submenú sigue siendo `project-${project.id}`
                  key: `project-${project.id}`,
                  icon: <FolderOpenOutlined />,
                  label: project.nombre, // El nombre ya viene de Supabase
                  // Los hijos usan project.id (UUID de Supabase)
                  children: visualizationOptions(project.id)
                }))
            )
        ]
      },
      { key: '/usuarios', icon: <TeamOutlined />, label: <Link to="/usuarios">Usuarios</Link> },
      { key: '/equipos', icon: <ToolOutlined />, label: <Link to="/equipos">Equipos</Link> },
      { key: '/configuracion', icon: <SettingOutlined />, label: <Link to="/configuracion">Configuración</Link> },
    ];
  }, [loadingProjects, projectsList]);
  // --- FIN DE LA MODIFICACIÓN ---


  // --- Lógica de Submenús Abiertos (Ajustada) ---
  const [openKeys, setOpenKeys] = useState(() => getOpenKeys(location.pathname, items));

  useEffect(() => {
    if (!collapsed) {
      // Re-calcula las claves abiertas basado en la ruta actual y los items (que pueden haber cambiado)
      setOpenKeys(getOpenKeys(location.pathname, items));
    } else {
      setOpenKeys([]);
    }
  }, [location.pathname, collapsed, items]); // Depende de 'items'

  const onOpenChange = (keys) => {
     const rootSubmenuKeys = items.filter(item => item.children).map(item => item.key);
     const latestOpenKey = keys.find(key => openKeys.indexOf(key) === -1);

     if (rootSubmenuKeys.includes(latestOpenKey)) {
       setOpenKeys(latestOpenKey ? [latestOpenKey] : []);
     } else {
       // Mantener abierta la raíz ('gestion-proyectos-sub') si se abre un hijo
       const currentRootOpen = openKeys.find(key => rootSubmenuKeys.includes(key));
       setOpenKeys(currentRootOpen ? [currentRootOpen, ...keys.filter(k => k !== currentRootOpen)] : keys);
     }
   };
  // --- Fin Lógica Submenús ---

  // --- Función onClick para Navegación ---
  // Necesitamos useNavigate aquí si usamos onClick en lugar de Link en label
  // import { useNavigate } from 'react-router-dom'; const navigate = useNavigate();
  // const handleMenuClick = (e) => {
  //   // Solo navega si la clave es una ruta (empieza con /)
  //   if (e.key && e.key.startsWith('/')) {
  //       navigate(e.key);
  //       if (onMenuClick) onMenuClick(); // Llama a la prop si existe (para cerrar en móvil)
  //   }
  // };

  return (
    <>
      {/* Logo (Sin cambios) */}
      <div style={{
          height: '64px', margin: '16px', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem', fontWeight: 'bold', background: 'rgba(255, 255, 255, 0.1)', borderRadius: '8px', overflow: 'hidden',
        }}>
        {collapsed ? 'APP' : 'METRIC'}
      </div>

      {/* Menú (MODIFICADO: Usamos Link en label, quitamos onClick) */}
      <Menu
        theme="dark"
        mode="inline"
        // onClick={handleMenuClick} // Ya no es necesario si usamos Link
        selectedKeys={[location.pathname]} // Resalta el item activo
        // Abre el submenú correcto basado en la ruta actual
        openKeys={openKeys}
        onOpenChange={onOpenChange}
        items={items} // Usa la estructura generada
      />
    </>
  );
};

export default SidebarContent;