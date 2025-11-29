// src/pages/DashboardPage.jsx

import React from 'react';
import {
  Table, Input, Button, Modal, Form,
  Select, Typography, Tag, Space, Tooltip, message
} from 'antd';

const { Title, Text } = Typography; // Importamos 'Text' para la etiqueta

// Color Naranja Suave para acento: #feac46
const ACCENT_ORANGE = '#feac46';
// Color Azul Primario para acentos y encabezados: #2a8bb6
const PRIMARY_BLUE = '#2a8bb6';
const DashboardPage = () => {
  return (
    <div>
      <Title level={1} style={{ color: PRIMARY_BLUE, fontWeight: 'bold' }}>
        Página Principal 👋
        
      </Title>
      <Typography.Text type="secondary">
        Bienvenido. Aquí irán las estadísticas clave y la información en tiempo real.
      </Typography.Text>


      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
        gap: '20px',
        marginTop: '20px',

      }}>
        {/* Tarjeta de métricas simulada */}
        {[1, 2, 3, 4].map(i => (
          <div key={i} style={{
            padding: '20px',
            borderRadius: '8px',
            boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
            backgroundColor: 'white'
          }}>
            <h3>Métrica {i}</h3>
            <p style={{ fontSize: '2em', fontWeight: 'bold', color: '#3b82f6' }}>{1200 + i}</p>
          </div>
        ))}
      </div>
    </div>
  );
};

export default DashboardPage;