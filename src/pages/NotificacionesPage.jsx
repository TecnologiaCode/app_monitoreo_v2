// src/pages/NotificacionesPage.jsx

import React from 'react';
import {
  Table, Input, Button, Modal, Form,
  Select, Typography, Tag, Space, Tooltip, message
} from 'antd';

const { Title, Text } = Typography; // Importamos 'Text' para la etiqueta

// Color Naranja Suave para acento: #feac46
const ACCENT_ORANGE = '#feac46';

const NotificacionesPage = () => {
  return (
    <div>
      <Title level={1}> <h1 style={{ color: ACCENT_ORANGE, fontWeight: 'bold' }}>🔔 Centro de Notificaciones</h1></Title>
      <Typography.Text type="secondary">
        Registro de alertas y eventos importantes del sistema.
      </Typography.Text>

      <div style={{ padding: '20px', border: '1px solid #ccc', borderRadius: '8px', backgroundColor: '#fff' }}>
        <ul>
          <li>Alerta: Nivel crítico de humedad detectado.</li>
          <li>Reporte: Copia de seguridad completada.</li>
        </ul>
      </div>
    </div>
  );
};

export default NotificacionesPage;