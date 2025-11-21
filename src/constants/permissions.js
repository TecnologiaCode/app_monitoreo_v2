// src/constants/permissions.js

/**
 * Grupos de permisos que se muestran en el modal de permisos.
 * Cada grupo tiene:
 *  - label: título visible en la tarjeta
 *  - permissions: arreglo de claves de permisos
 */
export const PERMISSION_GROUPS = [
  // ===== Usuarios =====
  {
    label: 'Usuarios',
    permissions: [
      'users:read',        // Ver lista de usuarios
      'users:write',       // Crear / editar usuarios
      'users:delete',      // Eliminar usuarios
      'users:permissions', // Gestionar permisos
    ],
  },

  // ===== Proyectos =====
  {
    label: 'Proyectos',
    permissions: [
      'projects:read',   // Ver proyectos
      'projects:write',  // Crear / editar proyectos
      'projects:delete', // Eliminar proyectos
    ],
  },

  // ===== Monitoreos =====
  {
    label: 'Gestion de Monitoreos',
    permissions: [
      'monitors:read',    // Ver monitoreos
      'monitors:create',  // Agregar mediciones
      'monitors:update',  // Editar mediciones
      'monitors:delete',  // Eliminar mediciones
    ],
  },

  // ===== Equipos =====
  {
    label: 'Equipos',
    permissions: [
      'equipments:read',    // Ver equipos
      'equipments:create',  // Agregar equipos
      'equipments:update',  // Editar equipos
      'equipments:delete',  // Eliminar equipos
    ],
  },

  // ===== Reportes =====
  {
    label: 'Reportes',
    permissions: [
      'reports:read',   // Ver historial / reportes
      'reports:export', // Exportar a Excel / PDF
    ],
  },

  // ===== Configuración =====
  {
    label: 'Configuración',
    permissions: [
      'settings:write', // Modificar configuración avanzada
    ],
  },

  // ===== Auditoría (opcional) =====
  {
    label: 'Auditoría',
    permissions: [
      'audits:read', // Ver registros de auditoría
    ],
  },
];

/**
 * Permisos por defecto según rol.
 * Esto lo usa AuthContext (ROLE_DEFAULTS) cuando el usuario
 * no tiene nada en `profiles.permisos_usuarios`.
 */
export const ROLE_DEFAULTS = {
  Admin: [
    // Usuarios
    'users:read',
    'users:write',
    'users:delete',
    'users:permissions',

    // Proyectos
    'projects:read',
    'projects:write',
    'projects:delete',

    // Monitoreos
    'monitors:read',
    'monitors:create',
    'monitors:update',
    'monitors:delete',

    // Equipos
    'equipments:read',
    'equipments:create',
    'equipments:update',
    'equipments:delete',

    // Reportes
    'reports:read',
    'reports:export',

    // Configuración
    'settings:write',

    // Auditoría
    'audits:read',
  ],

  Usuario: [
    // Puede ver proyectos donde esté asignado y trabajar sus monitoreos
    'projects:read',
    'monitors:read',
    'monitors:create',
    // si quieres permitir edición:
    // 'monitors:update',
    'reports:read',
  ],

  Invitado: [
    // Solo visualización básica de proyectos
    'projects:read',
  ],
};
