import React from 'react';
import { Layout } from 'antd';

const { Footer: AntFooter } = Layout;

const Footer = () => {
  return (
    <AntFooter
      style={{
        // --- INICIO DE LA MODIFICACIÓN ---
        // 1. Usamos Flexbox para centrar
        display: 'flex',
        justifyContent: 'center', // Centra horizontalmente
        alignItems: 'center',   // Centra verticalmente
        
        // 2. Ajustes de estilo (para que se vea bien)
        borderTop: '1px solid #e8e8e8', // Una línea sutil arriba
        backgroundColor: '#fcdcbd',     // Mismo color que el Header
        padding: '16px 0', // Un padding vertical de 16px
        color: '#555',    // Un color de texto un poco más oscuro
        fontSize: '0.9rem',
        // --- FIN DE LA MODIFICACIÓN ---
      }}
    
    >
      {/* El texto que quieres centrar */}
      © 2025 Metric Version 3.1.0 | Derechos reservados
    </AntFooter>
  );
};

export default Footer;