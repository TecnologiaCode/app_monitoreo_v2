// 1. Polyfill para Buffer (CRUCIAL para @react-pdf)
// Esto debe ir ANTES de cualquier otro import para asegurar que esté disponible globalmente
import { Buffer } from 'buffer';
window.Buffer = window.Buffer || Buffer;

import React from 'react';
import ReactDOM from 'react-dom/client';

// 2. Importamos el Router
import { BrowserRouter as Router } from 'react-router-dom';
import App from './App.jsx';

// 3. Importamos el contexto de autenticación
import { AuthProvider } from './context/AuthContext.jsx';

// Importamos todos los CSS globales
import './assets/css/antd-overrides.css';
import './index.css'; 

import 'antd/dist/reset.css'; // ✅ Limpia estilos base de AntD v5

// Parche para React 19 + Ant Design v5
import '@ant-design/v5-patch-for-react-19';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    {/* El Router debe envolver a TODO, incluido el AuthProvider */}
    <Router>
      <AuthProvider>
        <App />
      </AuthProvider>
    </Router>
  </React.StrictMode>,
);