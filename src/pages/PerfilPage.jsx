// src/pages/PerfilPage.jsx
import React, { useState, useEffect } from 'react'; // CAMBIO: agrego useEffect
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
// NUEVO: importar supabase client
import { supabase } from '../supabaseClient'; // NUEVO

// Color Azul Primario para acentos y encabezados: #2a8bb6
const PRIMARY_BLUE = '#2a8bb6';

const { Title } = Typography;

// --- (OPCIONAL) Utilidad para vista previa base64 ---
// La dejamos por si quieres previsualizar sin subir, pero en el flujo real
// mostraremos la URL pública devuelta por Supabase.
const getBase64 = (img, callback) => {
  const reader = new FileReader();
  reader.addEventListener('load', () => callback(reader.result));
  reader.readAsDataURL(img);
};

// Validación del archivo (igual que tu versión)
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

const PerfilPage = () => {
  const [imageUrl, setImageUrl] = useState(null);             // mantiene URL actual del avatar (pública)
  const [form] = Form.useForm();
  const [userId, setUserId] = useState(null);                 // NUEVO: id del usuario logueado
  const [loading, setLoading] = useState(true);               // NUEVO: loading inicial
  const [uploading, setUploading] = useState(false);          // NUEVO: estado de subida
  const [fileList, setFileList] = useState([]);               // NUEVO: control Upload antd

  // CAMBIO: quitamos datos simulados y cargamos datos REALES desde Supabase
  useEffect(() => {
    (async () => {
      try {
        const { data: { user }, error: userErr } = await supabase.auth.getUser(); // NUEVO
        if (userErr) throw userErr;
        if (!user) {
          message.error('No hay sesión activa.');
          setLoading(false);
          return;
        }
        setUserId(user.id);

        // Busca nombre_completo y avatar_url en profiles
        const { data, error } = await supabase
          .from('profiles')
          .select('nombre_completo, avatar_url, email') // si tienes email guardado en profiles
          .eq('id', user.id)
          .single();
        if (error) throw error;

        // Pre-carga del formulario
        form.setFieldsValue({
          // CAMBIO: usamos nombre_completo (tu columna real)
          nombre_completo: data?.nombre_completo || '',
          // Si no guardas email en profiles, puedes mostrar el del auth:
          email: data?.email || user.email || ''
        });

        // Avatar actual
        if (data?.avatar_url) {
          setImageUrl(data.avatar_url);
          setFileList([{
            uid: '1',
            name: 'avatar.png',
            status: 'done',
            url: data.avatar_url
          }]);
        }
      } catch (e) {
        console.error(e);
        message.error('No se pudo cargar tu perfil.');
      } finally {
        setLoading(false);
      }
    })();
  }, [form]);

  // CAMBIO: ahora onFinish guarda en la tabla profiles (nombre + avatar_url)
  const onFinish = async (values) => {
    if (!userId) return;
    try {
      const payload = {
        nombre_completo: values.nombre_completo, // CAMBIO: guarda columna real
        avatar_url: imageUrl || null,
        // Si quieres guardar email en profiles, descomenta:
        // email: values.email
      };
      const { error } = await supabase
        .from('profiles')
        .update(payload)
        .eq('id', userId);
      if (error) throw error;

      message.success('¡Perfil actualizado exitosamente!');
    } catch (e) {
      console.error(e);
      message.error('No se pudieron guardar los cambios.');
    }
  };

  // CAMBIO: ahora subimos a Supabase Storage en vez de simular
  const handleUploadChange = async (info) => {
    // Antd manda muchos estados; manejamos only on file selected
    if (info.file.status === 'uploading') return;

    if (info.file.status === 'done' || info.file.status === 'error') {
      // Subimos manualmente a Supabase usando customRequest
      // (El customRequest ya llama a esta función; aquí solo mantenemos coherencia de UI)
    }
  };

  // NUEVO: función para customRequest que sube a Storage
  const uploadToSupabase = async ({ file, onSuccess, onError }) => {
    if (!userId) {
      onError?.(new Error('Usuario no disponible'));
      return;
    }
    setUploading(true);
    try {
      const ext = file.name.split('.').pop();
      const filePath = `u_${userId}/${Date.now()}.${ext}`;

      // Subir archivo
      const { error: upErr } = await supabase
        .storage
        .from('avatars')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: true
        });
      if (upErr) throw upErr;

      // Obtener URL pública (bucket público)
      const { data: publicData } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);

      const publicUrl = publicData?.publicUrl;
      if (!publicUrl) throw new Error('No se obtuvo URL pública.');

      // Actualizar estado UI
      setImageUrl(publicUrl);
      setFileList([{
        uid: file.uid || String(Date.now()),
        name: file.name,
        status: 'done',
        url: publicUrl
      }]);

      message.success('Imagen subida.');
      onSuccess?.('ok');
    } catch (e) {
      console.error(e);
      message.error('Error al subir la imagen.');
      onError?.(e);
    } finally {
      setUploading(false);
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
          src={imageUrl || undefined} // CAMBIO: ahora viene de Supabase/public URL
        />
        
        {/* Componente de subida de Ant Design */}
        <Upload
          name="avatar"
          showUploadList={false}
          beforeUpload={beforeUpload}
          onChange={handleUploadChange}
          // CAMBIO: ahora usamos subida REAL a Supabase
          customRequest={uploadToSupabase} // CAMBIO
          accept="image/*"
          disabled={uploading || loading}
        >
          <Button icon={<UploadOutlined />} style={{ marginTop: 16 }} loading={uploading}>
            {uploading ? 'Subiendo...' : 'Cambiar Foto de Perfil'}
          </Button>
        </Upload>
      </div>

      <Form
        form={form}
        layout="vertical"
        onFinish={onFinish}
        disabled={loading}
      >
        {/* CAMBIO: nombre_completo (columna real) */}
        <Form.Item
          name="nombre_completo"
          label="Nombre Completo"
          rules={[{ required: true, message: 'Por favor ingresa tu nombre' }]}
        >
          <Input prefix={<UserOutlined />} placeholder="Nombre Completo" />
        </Form.Item>
        
        {/* Puedes dejar email editable o solo lectura; aquí editable */}
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
