// src/pages/HistorialPage.jsx

import React from 'react';
import {
  Table, Input, Button, Modal, Form,
  Select, Typography, Tag, Space, Tooltip, message
} from 'antd';

const { Title, Text } = Typography; // Importamos 'Text' para la etiqueta

// Color Azul Primario para acentos y encabezados: #2a8bb6
const PRIMARY_BLUE = '#2a8bb6';

// Componente temporal para la sección de Historial
const HistorialPage = () => {
  return (
    <div>
      <Title level={1} style={{ color: PRIMARY_BLUE, fontWeight: 'bold' }}> 📜 Historial o Reporte</Title>
      <Typography.Text type="secondary">
        Tabla con los últimos registros y filtros de búsqueda.
      </Typography.Text>

      <div style={{ height: '300px', border: '1px solid #ccc', backgroundColor: '#fee' }}>
        {/* Contenedor simulado para una tabla de datos */}
        Tabla de Reportes Aquí.
      </div>
    </div>
  );
};

export default HistorialPage;