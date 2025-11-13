import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Form, Input, Button, Card, Typography, Alert, Spin } from 'antd';
// CAMBIADO: UserOutlined por MailOutlined
import { MailOutlined, LockOutlined } from '@ant-design/icons';
import { useAuth } from '../context/AuthContext'; // Importa el NUEVO hook

const { Title } = Typography;

const LoginPage = () => {
  // Los nombres vienen del nuevo AuthContext
  const { login, authError, loadingAuthState, isAuthenticated } = useAuth();
  const [form] = Form.useForm();
  const [loadingSubmit, setLoadingSubmit] = useState(false);
  const navigate = useNavigate();

  // Esta lógica de redirección sigue igual y es correcta
  useEffect(() => {
    if (isAuthenticated) {
      navigate('/');
    }
  }, [isAuthenticated, navigate]);

  const onFinish = async (values) => {
    setLoadingSubmit(true);
    // CAMBIADO: 'values.username' por 'values.email'
    await login(values.email, values.password);
    setLoadingSubmit(false);
  };

  // Esta lógica de carga inicial sigue igual y es correcta
  if (loadingAuthState) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <Spin size="large" tip="Verificando sesión..." />
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', backgroundColor: '#f0f2f5' }}>
        <Card style={{ width: 400, borderRadius: '12px' }}>
          <div style={{ textAlign: 'center', marginBottom: '24px' }}>
            <Title level={2} style={{ color: '#286e86' }}> APP-MONITOREO </Title>
            <Typography.Text type="secondary"> Inicia sesión para acceder </Typography.Text>
          </div>

          {/* Muestra error de autenticación (sigue igual) */}
          {authError &&
            <Alert
              message={authError}
              type="error"
              showIcon
              style={{ marginBottom: '24px' }}
            />
          }

          <Form
            form={form}
            name="login_form"
            onFinish={onFinish}
            layout="vertical"
          >
            {/* --- CAMBIOS AQUÍ --- */}
            <Form.Item 
              name="email" // 1. Cambiado de 'username' a 'email'
              label="Correo Electrónico" // 2. Label cambiado
              rules={[
                { required: true, message: 'Ingresa tu correo' },
                { type: 'email', message: 'Ingresa un correo válido' } // 3. Regla de email
              ]}
            >
              <Input 
                prefix={<MailOutlined />} // 4. Icono cambiado
                placeholder="correo@ejemplo.com" 
                size="large"
              />
            </Form.Item>
            {/* --- FIN DE CAMBIOS --- */}

            <Form.Item name="password" label="Contraseña" rules={[{ required: true, message: 'Ingresa tu contraseña' }]}>
              <Input.Password prefix={<LockOutlined />} placeholder="Contraseña" size="large"/>
            </Form.Item>
            <Form.Item>
              <Button type="primary" htmlType="submit" block size="large" loading={loadingSubmit}>
                {loadingSubmit ? 'Ingresando...' : 'Iniciar Sesión'}
              </Button>
            </Form.Item>
          </Form>

          {/* Eliminamos el botón de Google por ahora, ya que requiere configuración extra en Supabase */}

        </Card>
    </div>
  );
};

export default LoginPage;
