import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Form, Input, Button, Card, Typography, Alert, Spin } from 'antd';
import { MailOutlined, LockOutlined } from '@ant-design/icons';
import { useAuth } from '../context/AuthContext';

const { Title } = Typography;

const LoginPage = () => {
  // ================== ESTADO / HOOKS ==================
  const { login, authError, loadingAuthState, isAuthenticated } = useAuth();
  const [form] = Form.useForm();
  const [loadingSubmit, setLoadingSubmit] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  // Detectamos la razón semántica del redirect (inactive, etc.)
  const reason = useMemo(() => {
    const query = new URLSearchParams(location.search).get('reason');
    return location.state?.reason || query || null;
  }, [location.state, location.search]);

  // Mensaje según la razón de regreso al login
  const reasonMsg = useMemo(() => {
    switch (reason) {
      case 'inactivo':
        return {
          type: 'warning',
          message: 'Usuario inactivo, contáctese con el administrador.',
          description: null
        };
      case 'signed-out':
        return {
          type: 'success',
          message: 'Sesión cerrada correctamente',
          description: null
        };
      default:
        return null;
    }
  }, [reason]);

  // Redirigir si ya está autenticado
  useEffect(() => {
    if (isAuthenticated) {
      navigate('/');
    }
  }, [isAuthenticated, navigate]);

  // Submit del login
  const onFinish = async (values) => {
    setLoadingSubmit(true);
    try {
      await login(values.email, values.password);
      // No navegamos aquí; el useEffect de isAuthenticated se encarga
    } catch (error) {
      // El mensaje ya lo maneja AuthContext vía authError
    } finally {
      setLoadingSubmit(false);
    }
  };

  // Pantalla de "verificando sesión" mientras el AuthProvider se inicializa
  if (loadingAuthState) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <Spin size="large" tip="Verificando sesión..." />
      </div>
    );
  }

  // ================== UI ==================
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', backgroundColor: '#f0f2f5' }}>
      <Card style={{ width: 400, borderRadius: '12px' }}>
        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
          <Title level={2} style={{ color: '#286e86' }}> APP-MONITOREO </Title>
          <Typography.Text type="secondary"> Inicia sesión para acceder </Typography.Text>
        </div>

        {/* Mensaje de redirección (usuario inactivo, etc.) */}
        {reasonMsg && (
          <Alert
            showIcon
            type={reasonMsg.type}
            message={reasonMsg.message}
            description={reasonMsg.description}
            style={{ marginBottom: 16 }}
          />
        )}

        {/* Error que venga del AuthContext (credenciales inválidas, usuario inactivo, etc.) */}
        {authError && (
          <Alert
            message={authError}
            type="error"
            showIcon
            style={{ marginBottom: 24 }}
          />
        )}

        <Form
          form={form}
          name="login_form"
          onFinish={onFinish}
          layout="vertical"
        >
          <Form.Item
            name="email"
            label="Correo Electrónico"
            rules={[
              { required: true, message: 'Ingresa tu correo' },
              { type: 'email', message: 'Ingresa un correo válido' }
            ]}
          >
            <Input
              prefix={<MailOutlined />}
              placeholder="correo@ejemplo.com"
              size="large"
            />
          </Form.Item>

          <Form.Item
            name="password"
            label="Contraseña"
            rules={[{ required: true, message: 'Ingresa tu contraseña' }]}
          >
            <Input.Password
              prefix={<LockOutlined />}
              placeholder="Contraseña"
              size="large"
            />
          </Form.Item>

          <Form.Item>
            <Button
              type="primary"
              htmlType="submit"
              block
              size="large"
              loading={loadingSubmit}
            >
              {loadingSubmit ? 'Ingresando...' : 'Iniciar Sesión'}
            </Button>
          </Form.Item>
        </Form>
      </Card>
    </div>
  );
};

export default LoginPage;
