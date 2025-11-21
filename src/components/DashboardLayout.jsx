import React, { useState } from 'react';
// 1. Importamos Outlet. Este es el "espacio" donde se renderizarán
//    tus páginas (DashboardPage, UsuariosPage, etc.)
import { Outlet } from 'react-router-dom';
import { Layout } from 'antd';
import Header from './Header.jsx';
import Sidebar from './Sidebar.jsx';
import Footer from './Footer.jsx';
import { useMediaQuery } from '../hooks/useMediaQuery.js';
///import { useAuth } from '../context/AuthContext';

const { Content } = Layout;

// Variables de layout (las movimos de App.jsx aquí)
const pageMarginTop = 24;
const pageMarginSides = 16;
const desktopSidebarWidth = 250;
const desktopSidebarCollapsedWidth = 80;

/**
 * Este componente contiene el layout principal del Dashboard
 * (Sidebar, Header, Content, Footer)
 */
const DashboardLayout = () => {
  
  // Toda la lógica de estado del layout que estaba en App.jsx
  // ahora vive aquí.
  const isMobile = useMediaQuery('(max-width: 768px)');
  const [desktopCollapsed, setDesktopCollapsed] = useState(false);
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);

  const currentSidebarWidth = isMobile 
    ? 0 
    : (desktopCollapsed ? desktopSidebarCollapsedWidth : desktopSidebarWidth);

  const handleToggle = () => {
    if (isMobile) {
      setMobileDrawerOpen(!mobileDrawerOpen);
    } else {
      setDesktopCollapsed(!desktopCollapsed);
    }
  };

  const collapsedStateForIcon = isMobile ? mobileDrawerOpen : desktopCollapsed;

  return (
    <Layout style={{ minHeight: '100vh' }}>
      
      <Sidebar 
        isMobile={isMobile}
        collapsed={desktopCollapsed}
        open={mobileDrawerOpen}
        onClose={() => setMobileDrawerOpen(false)}
        width={desktopSidebarWidth} 
      />

      <Layout 
        style={{ 
          marginLeft: currentSidebarWidth,
          transition: 'margin-left 0.2s',
          minHeight: '100vh'
        }}
      >
        <Header 
          collapsed={collapsedStateForIcon} 
          toggleCollapsed={handleToggle} 
          sidebarWidth={currentSidebarWidth}
        />

        <Content
          style={{
            margin: `${pageMarginTop}px ${pageMarginSides}px`,
            padding: 24,
            minHeight: `calc(100vh - 64px - 70px - ${pageMarginTop * 2}px)`,
            overflow: 'initial',
            marginTop: 20 + pageMarginTop,
          }}
        >
          {/* 2. ¡CAMBIO CLAVE! */}
          {/* Aquí es donde react-router renderizará la página
              correcta (DashboardPage, UsuariosPage, etc.) */}
          <Outlet />
        </Content>

        <Footer />
      </Layout>
    </Layout>
  );
};

export default DashboardLayout;