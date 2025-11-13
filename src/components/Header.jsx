import React from 'react';
// 1. Ya no importamos 'Menu' aquí, Antd lo maneja internamente
import { Layout, Avatar, Dropdown, Button } from 'antd';
import { 
  UserOutlined, 
  SettingOutlined, 
  LogoutOutlined, 
  MenuUnfoldOutlined, 
  MenuFoldOutlined 
} from '@ant-design/icons';
// 2. Importamos los hooks en el componente principal
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const { Header: AntHeader } = Layout;

// 3. Eliminamos el componente 'DropdownMenu' que causaba el error

const Header = ({ collapsed, toggleCollapsed, sidebarWidth }) => {
  
  // 4. --- INICIO DE LA CORRECCIÓN ---
  //    Movemos los hooks y la lógica del menú aquí
  const navigate = useNavigate();
  const { logout } = useAuth();

  // 5. Definimos los 'items' del menú aquí
  const items = [
    { key: '1', icon: <UserOutlined />, label: 'Mi Perfil' },
    { key: '2', icon: <SettingOutlined />, label: 'Configuración' },
    { type: 'divider' },
    { key: '3', icon: <LogoutOutlined />, label: 'Cerrar Sesión' },
  ];

  // 6. Definimos el 'handleMenuClick' aquí
  const handleMenuClick = (e) => {
    switch (e.key) {
      case '1':
        navigate('/perfil');
        break;
      case '2':
        navigate('/configuracion');
        break;
      case '3':
        // 7. Mantenemos el 'setTimeout' para evitar la "race condition"
        setTimeout(() => {
          logout();
        }, 0);
        break;
      default:
        break;
    }
  };

  // 8. Creamos el OBJETO de props del menú, como pide Antd
  const menuProps = {
    items: items,
    onClick: handleMenuClick,
  };
  // --- FIN DE LA CORRECCIÓN ---


  return (
    <AntHeader
      style={{
        position: 'fixed',
        zIndex: 10,
        backgroundColor: '#f5f5f5',
        borderBottom: '1px solid #e8e8e8',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '0 24px',
        left: sidebarWidth,
        width: `calc(100% - ${sidebarWidth}px)`,
        transition: 'left 0.2s, width 0.2s',
      }}
    >
      {/* Botón para colapsar/expandir el Sidebar */}
      <Button
        type="text"
        icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
        onClick={toggleCollapsed}
        style={{
          fontSize: '16px',
          width: 64,
          height: 64,
          marginLeft: '-16px'
        }}
      />

      {/* Dropdown del Usuario */}
      <div>
        {/* 9. Pasamos el OBJETO 'menuProps' al prop 'menu' */}
        <Dropdown menu={menuProps} trigger={['click']}>
          <a onClick={(e) => e.preventDefault()} style={{ color: '#286e86', cursor: 'pointer' }}>
            <Avatar style={{ backgroundColor: '#2a8bb6' }} icon={<UserOutlined />} />
            <span style={{ marginLeft: 8, fontWeight: '500' }}>Admin (Bolivia)</span>
          </a>
        </Dropdown>
      </div>
    </AntHeader>
  );
};

export default Header;

