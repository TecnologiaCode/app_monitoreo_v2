// src/pages/ConfiguracionPage.jsx

import React from 'react';
import { 
  Table, Input, Button, Modal, Form, 
  Select, Typography, Tag, Space, Tooltip, message
} from 'antd';

const { Title, Text } = Typography; // Importamos 'Text' para la etiqueta

// Color Azul Primario para acentos y encabezados: #2a8bb6
const PRIMARY_BLUE = '#2a8bb6'; 

const ConfiguracionPage = () => {
  return (
    
    <div>
      <Title level={1}> <h1 style={{ color: PRIMARY_BLUE, fontWeight: 'bold' }}>⚙️ Configuración del Sistema</h1></Title>
      <Typography.Text type="secondary">
        Ajustes generales, seguridad y mantenimiento.
      </Typography.Text>
      
      <div style={{ padding: '20px', border: '1px solid #ccc', borderRadius: '8px', backgroundColor: '#fff' }}>
        <h3>Configuración General</h3>
        <p>Opciones de idioma y región.</p>
      </div>
    </div>
  );
};

export default ConfiguracionPage;