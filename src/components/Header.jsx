// src/layout/Header.jsx
import React, { useEffect, useState } from 'react';
import { Layout, Avatar, Dropdown, Button } from 'antd';
import {
  UserOutlined,
  SettingOutlined,
  LogoutOutlined,
  MenuUnfoldOutlined,
  MenuFoldOutlined
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../supabaseClient.js'; // <-- ✅ NUEVO: usaremos Supabase para leer nombre_completo

const { Header: AntHeader } = Layout;

const Header = ({ collapsed, toggleCollapsed, sidebarWidth }) => {
  const navigate = useNavigate();
  const { logout, user: currentUser, loadingAuthState } = useAuth(); // <-- ✅ ya traíamos el usuario

  // ✅ NUEVO: estado local para el nombre visible en el header
  const [displayName, setDisplayName] = useState('Usuario');
  const [loadingName, setLoadingName] = useState(false); // pequeño loading solo del nombre

  // ✅ NUEVO: util para generar iniciales a partir del nombre visible
  const getInitials = (name) => {
    if (!name) return 'U';
    const base = name.includes('@') ? name.split('@')[0] : name;
    const parts = base.trim().split(' ').filter(Boolean);
    if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
    return (parts[0].charAt(0) + parts[1].charAt(0)).toUpperCase();
  };

  // ✅ NUEVO: efecto que busca nombre_completo en la tabla profiles por id del usuario
  useEffect(() => {
    const loadName = async () => {
      if (!currentUser?.id) {
        // si no hay user aún, deja el fallback
        setDisplayName('Usuario');
        return;
      }
      setLoadingName(true);
      try {
        // 1) Intentar leer nombre_completo desde profiles
        const { data, error } = await supabase
          .from('profiles')
          .select('nombre_completo')
          .eq('id', currentUser.id)
          .single();

        if (error) {
          // si hay error leyendo profiles, usamos fallback
          // console.warn('No se pudo leer profiles:', error.message);
        }

        const meta = currentUser.user_metadata || {};
        // 2) Armar cascada de fuentes para el nombre mostrado
        const nombreBD = data?.nombre_completo && data.nombre_completo.trim();
        const metaName =
          (meta.full_name && meta.full_name.trim()) ||
          (meta.name && meta.name.trim()) ||
          '';

        const fallbackEmail = currentUser.email || '';
        const finalName = nombreBD || metaName || fallbackEmail || 'Usuario';

        setDisplayName(finalName);
      } catch (e) {
        // Fallback extremo
        setDisplayName(currentUser?.email || 'Usuario');
      } finally {
        setLoadingName(false);
      }
    };

    loadName();
  }, [currentUser?.id]); // <-- ✅ se dispara cuando cambia el usuario

  // Menú del usuario (sin cambios funcionales)
  const items = [
    { key: '1', icon: <UserOutlined />, label: 'Mi Perfil' },
    { key: '2', icon: <SettingOutlined />, label: 'Configuración' },
    { type: 'divider' },
    { key: '3', icon: <LogoutOutlined />, label: 'Cerrar Sesión' },
  ];

  const handleMenuClick = (e) => {
    switch (e.key) {
      case '1':
        navigate('/perfil');
        break;
      case '2':
        navigate('/configuracion');
        break;
      case '3':
        setTimeout(() => {
          logout();
        }, 0);
        break;
      default:
        break;
    }
  };

  const menuProps = { items, onClick: handleMenuClick };

  const initials = getInitials(displayName); // <-- ✅ iniciales desde el nombre calculado

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
        style={{ fontSize: '16px', width: 64, height: 64, marginLeft: '-16px' }}
      />

      {/* Dropdown del Usuario */}
      {/* Dropdown del Usuario */}
      <div>
        <Dropdown menu={menuProps} trigger={['click']}>
          {/* ✅ invertimos el orden: primero el nombre, luego el avatar */}
          <a
            onClick={(e) => e.preventDefault()}
            style={{
              color: '#286e86',
              cursor: 'pointer',
              display: 'flex',           // <-- NUEVO: para alinear en fila
              alignItems: 'center',
              gap: 8                     // <-- NUEVO: separa texto e icono
            }}
          >
            <span style={{ fontWeight: 600, fontSize: 16}}>
              {'Bienvenid@,'}
            </span>
            {/* Nombre visible */}
            <span style={{ fontWeight: 500, fontSize: 14 }}>
              {(loadingAuthState || loadingName) ? 'Cargando…' : displayName}
            </span>

            {/* Icono/Avatar a la derecha */}
            <Avatar style={{ backgroundColor: '#2a8bb6' }}>
              {currentUser ? initials : <UserOutlined />}
            </Avatar>
          </a>
        </Dropdown>
      </div>

    </AntHeader>
  );
};

export default Header;
