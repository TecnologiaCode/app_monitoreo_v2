import React from 'react';
import { Layout, Drawer } from 'antd';
import { useNavigate } from 'react-router-dom';
import SidebarContent from './SidebarContent'; // El contenido del menú

const { Sider } = Layout;

const Sidebar = ({
  isMobile,
  collapsed,
  open,
  onClose,
  width
}) => {
  const navigate = useNavigate();

  const handleMenuClick = (e) => {
    navigate(e.key);
    if (isMobile) {
      onClose();
    }
  };

  const content = (
    <SidebarContent
      collapsed={isMobile ? false : collapsed}
      onMenuClick={handleMenuClick}
    />
  );

  if (isMobile) {
    // --- VISTA MÓVIL (Drawer) ---
    return (
      <Drawer
        open={open}
        onClose={onClose}
        placement="left"
        // --- INICIO CORRECCIÓN ADVERTENCIA ---
        // Usamos 'styles.body' en lugar de 'bodyStyle'
        styles={{ body: { backgroundColor: '#286e86', padding: 0 } }}
        // --- FIN CORRECCIÓN ADVERTENCIA ---
        width={width}
        closable={false}
      >
        {content}
      </Drawer>
    );
  }

  // --- VISTA ESCRITORIO (Sider) ---
  return (
    <Sider
      collapsed={collapsed}
      trigger={null}
      collapsible
      width={width}
      style={{
        overflow: 'auto',
        height: '100vh',
        position: 'fixed',
        left: 0,
        top: 0,
        bottom: 0,
        transition: 'width 0.2s',
        // backgroundColor: '#286e86' // El fondo se aplica por CSS
      }}
    >
      {content}
    </Sider>
  );
};

export default Sidebar;