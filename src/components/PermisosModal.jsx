// src/components/PermisosModal.jsx

import React, { useState, useEffect } from 'react';
import { Modal, Card, Row, Col, Switch, Typography } from 'antd';
import { PERMISSION_GROUPS } from '../constants/permissions.js';

const { Text } = Typography;

/**
 * Traducciones / etiquetas legibles para cada permiso.
 * Esta tabla solo controla el TEXTO que se ve al lado de cada switch.
 */
const PERM_TRANSLATIONS = {
  // ===== Usuarios =====
  'users:read': 'Ver lista de usuarios',
  'users:write': 'Crear y editar usuarios',
  'users:delete': 'Eliminar usuarios',
  'users:permissions': 'Gestionar permisos de usuarios',

  // ===== Proyectos =====
  'projects:read': 'Ver proyectos',
  'projects:write': 'Crear y editar proyectos',
  'projects:delete': 'Eliminar proyectos',

  // ===== Monitoreos =====
  'monitors:read': 'Ver monitoreos',
  'monitors:create': 'Agregar mediciones',
  'monitors:update': 'Editar mediciones',
  'monitors:delete': 'Eliminar mediciones',

  // Compatibilidad por si hay registros antiguos en BD
  'monitors:write': 'Registrar mediciones (legacy)',
  'monitors:edit': 'Editar mediciones (legacy)',

  // ===== Equipos =====
  'equipments:read': 'Ver equipos',
  'equipments:create': 'Agregar equipos',
  'equipments:update': 'Editar equipos',
  'equipments:delete': 'Eliminar equipos',

  // ===== Reportes =====
  'reports:read': 'Ver historial / reportes',
  'reports:export': 'Exportar a Excel/PDF',

  // ===== Configuración =====
  'settings:write': 'Modificar configuración',

  // ===== Auditoría =====
  'audits:read': 'Ver auditoría',
};

const PermisosModal = ({ open, userRecord, onCancel, onSave, saving }) => {
  // Permisos del usuario que se editan localmente en el modal
  const [currentPerms, setCurrentPerms] = useState([]);

  // Cargar permisos actuales del usuario al abrir el modal
  useEffect(() => {
    const perms = Array.isArray(userRecord?.permisos_usuarios)
      ? userRecord.permisos_usuarios
      : [];
    setCurrentPerms(perms);
  }, [userRecord, open]);

  /**
   * Alta / baja de un permiso en el array local
   * @param {string} permKey  Ej: 'equipments:create'
   * @param {boolean} checked Nuevo estado del switch
   */
  const toggle = (permKey, checked) => {
    if (checked) {
      // Agrega sin duplicar
      setCurrentPerms(prev => [...new Set([...prev, permKey])]);
    } else {
      // Quita el permiso
      setCurrentPerms(prev => prev.filter(p => p !== permKey));
    }
  };

  return (
    <Modal
      title={
        userRecord
          ? `Permisos para "${userRecord.nombre_completo || userRecord.email}"`
          : 'Permisos'
      }
      open={open}
      onOk={() => onSave(currentPerms)}
      onCancel={onCancel}
      confirmLoading={saving}
      width={620}
    >
      <div
        style={{
          maxHeight: '60vh',
          overflowY: 'auto',
          paddingRight: 5,
        }}
      >
        {PERMISSION_GROUPS.map(group => (
          <Card
            key={group.label}
            size="small"
            title={group.label}
            style={{ marginBottom: 10 }}
            styles={{ header: { background: '#f5f5f5' } }} // API moderna AntD
          >
            <Row gutter={[16, 10]}>
              {group.permissions.map(perm => (
                <Col span={12} key={perm}>
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                  >
                    <Text style={{ fontSize: 12 }}>
                      {PERM_TRANSLATIONS[perm] || perm}
                    </Text>
                    <Switch
                      size="small"
                      checked={currentPerms.includes(perm)}
                      onChange={checked => toggle(perm, checked)}
                    />
                  </div>
                </Col>
              ))}
            </Row>
          </Card>
        ))}
      </div>
    </Modal>
  );
};

export default PermisosModal;
