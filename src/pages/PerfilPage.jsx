import React, { useState } from 'react';

import { 
  Card, 
  Avatar, 
  Form, 
  Input, 
  Button, 
  Upload, 
  message,
  Typography
} from 'antd';
import { UserOutlined, UploadOutlined, EditOutlined } from '@ant-design/icons';

// Color Azul Primario para acentos y encabezados: #2a8bb6
const PRIMARY_BLUE = '#2a8bb6';

const { Title } = Typography;

// --- Simulación de carga de imagen ---
// Esta función previene la subida real y en su lugar
// lee el archivo como un base64 para mostrar la vista previa.
const getBase64 = (img, callback) => {
  const reader = new FileReader();
  reader.addEventListener('load', () => callback(reader.result));
  reader.readAsDataURL(img);
};

// Esta función verifica que el archivo sea una imagen
const beforeUpload = (file) => {
  const isJpgOrPng = file.type === 'image/jpeg' || file.type === 'image/png';
  if (!isJpgOrPng) {
    message.error('¡Solo puedes subir archivos JPG/PNG!');
  }
  const isLt2M = file.size / 1024 / 1024 < 2;
  if (!isLt2M) {
    message.error('¡La imagen debe ser más pequeña que 2MB!');
  }
  return isJpgOrPng && isLt2M;
};
// --- Fin de simulación ---


const PerfilPage = () => {
  // Estado para guardar la URL de la imagen (usamos base64 para la simulación)
  const [imageUrl, setImageUrl] = useState(null);
  // Estado para el formulario
  const [form] = Form.useForm();

  // Datos iniciales del usuario (simulados)
  const userData = {
    nombre: 'Admin (Bolivia)',
    email: 'admin@monitoreo.bo',
  };

  // Manejador para cuando el formulario se envía
  const onFinish = (values) => {
    console.log('Datos guardados:', values);
    message.success('¡Perfil actualizado exitosamente!');
  };

  // Manejador para el cambio en el componente Upload
  const handleUploadChange = (info) => {
    if (info.file.status === 'uploading') {
      // Podríamos mostrar un 'loading' aquí si quisiéramos
      return;
    }
    if (info.file.status === 'done' || info.file.status === 'error') {
      // (Simulación) Obtenemos el base64 de la imagen seleccionada
      getBase64(info.file.originFileObj, (url) => {
        setImageUrl(url);
        message.success(`${info.file.name} subido exitosamente.`);
      });
    }
  };

  return (
    <Card>
      <Title level={3}> <p style={{ color: PRIMARY_BLUE }}> 📄Mi Perfil</p></Title>
      
      <div style={{ display: 'flex', alignItems: 'center', flexDirection: 'column', marginBottom: 24 }}>
        {/* Mostramos la imagen subida, o un ícono por defecto */}
        <Avatar 
          size={128} 
          icon={<UserOutlined />} 
          src={imageUrl} 
        />
        
        {/* Componente de subida de Ant Design */}
        <Upload
          name="avatar"
          showUploadList={false} // No mostramos la lista de archivos
          // Usamos 'beforeUpload' para validar Y simular la subida
          // En una app real, 'action' apuntaría a tu API de subida
          // action="https://660d2bd96ddfa2943b33731c.mockapi.io/api/v1/upload" 
          beforeUpload={beforeUpload} 
          onChange={handleUploadChange}
          // Hacemos que la subida se active al seleccionar (no se sube realmente)
          customRequest={({ onSuccess }) => onSuccess("ok")} 
        >
          <Button icon={<UploadOutlined />} style={{ marginTop: 16 }}>
            Cambiar Foto de Perfil
          </Button>
        </Upload>
      </div>

      <Form
        form={form}
        layout="vertical"
        initialValues={userData} // Precargamos el formulario
        onFinish={onFinish}
      >
        <Form.Item
          name="nombre"
          label="Nombre Completo"
          rules={[{ required: true, message: 'Por favor ingresa tu nombre' }]}
        >
          <Input prefix={<UserOutlined />} placeholder="Nombre Completo" />
        </Form.Item>
        
        <Form.Item
          name="email"
          label="Correo Electrónico"
          rules={[{ required: true, type: 'email', message: 'Por favor ingresa un email válido' }]}
        >
          <Input prefix={<EditOutlined />} placeholder="Correo Electrónico" />
        </Form.Item>

        <Form.Item>
          <Button type="primary" htmlType="submit">
            Guardar Cambios
          </Button>
        </Form.Item>
      </Form>
    </Card>
  );
};

export default PerfilPage;
