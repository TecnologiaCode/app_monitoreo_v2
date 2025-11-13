import React from 'react'
import ReactDOM from 'react-dom/client'
// 1. Importamos el Router aquí (lo moveremos desde App.jsx)
import { BrowserRouter as Router } from 'react-router-dom';
import App from './App.jsx'
// 2. Importamos nuestro nuevo "Cerebro" de autenticación
import { AuthProvider } from './context/AuthContext.jsx';

// Importamos todos los CSS globales que ya usábamos
import './assets/css/antd-overrides.css';
import './index.css'; 

import 'antd/dist/reset.css'; // ✅ Limpia estilos base de AntD v5

// 👇 AGREGA ESTA LÍNEA AQUÍ
import '@ant-design/v5-patch-for-react-19';



ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    {/* 3. El Router debe envolver a TODO, incluido el AuthProvider */}
    <Router>
      {/* 4. Envolvemos la App con el AuthProvider */}
      {/* Ahora, CUALQUIER componente dentro de <App /> podrá
           usar el hook 'useAuth()' para saber si está logueado */}
      <AuthProvider>
        <App />
      </AuthProvider>
    </Router>
  </React.StrictMode>,
)