// src/pages/PerfilPage.jsx
import React, { useState, useEffect } from 'react';
import {
  Card,
  Avatar,
  Form,
  Input,
  Button,
  Upload,
  message,
  Typography,
  Select,             // CAMBIO: importamos Select para el campo "estado"
  Tag                 // CAMBIO: para mostrar visualmente el estado
} from 'antd';
import { UserOutlined, UploadOutlined, EditOutlined } from '@ant-design/icons';
import { supabase } from '../supabaseClient'; // (ya estaba)
const { Title, Text } = Typography;
const { Option } = Select;                   // CAMBIO: Option de Select

// Color Azul Primario
const PRIMARY_BLUE = '#2a8bb6';

// Validación de imagen (igual)
const beforeUpload = (file) => {
  const isJpgOrPng = file.type === 'image/jpeg' || file.type === 'image/png';
  if (!isJpgOrPng) message.error('¡Solo puedes subir archivos JPG/PNG!');
  const isLt2M = file.size / 1024 / 1024 < 2;
  if (!isLt2M) message.error('¡La imagen debe ser más pequeña que 2MB!');
  return isJpgOrPng && isLt2M;
};

const PerfilPage = () => {
  const [form] = Form.useForm();
  const [userId, setUserId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);

  const [imageUrl, setImageUrl] = useState(null);           // (ya estaba) URL pública del avatar
  const [estadoActual, setEstadoActual] = useState('activo'); // CAMBIO: guardamos el estado actual para mostrar Tag

  // --------- CARGA INICIAL DE PERFIL DESDE SUPABASE ----------
  useEffect(() => {
    (async () => {
      try {
        const { data: { user }, error: userErr } = await supabase.auth.getUser();
        if (userErr) throw userErr;
        if (!user) {
          message.error('No hay sesión activa.');
          setLoading(false);
          return;
        }
        setUserId(user.id);

        // CAMBIO: pedimos también "estado"
        const { data, error } = await supabase
          .from('profiles')
          .select('nombre_completo, avatar_url, email, estado') // CAMBIO: estado
          .eq('id', user.id)
          .single();
        if (error) throw error;

        form.setFieldsValue({
          nombre_completo: data?.nombre_completo || '',
          email: data?.email || user.email || '',
          estado: data?.estado || 'activo'                    // CAMBIO: precargamos estado
        });

        setEstadoActual(data?.estado || 'activo');            // CAMBIO: para mostrar el Tag

        if (data?.avatar_url) {
          setImageUrl(data.avatar_url);
        }
      } catch (e) {
        console.error(e);
        message.error('No se pudo cargar tu perfil.');
      } finally {
        setLoading(false);
      }
    })();
  }, [form]);

  // --------- GUARDAR PERFIL ----------
  const onFinish = async (values) => {
    if (!userId) return;
    try {
      const payload = {
        nombre_completo: values.nombre_completo,
        avatar_url: imageUrl || null,
        // CAMBIO: guardamos el estado editado
        estado: values.estado,                                // CAMBIO
        // Si manejas email en profiles, puedes guardarlo también:
        // email: values.email
      };

      const { error } = await supabase
        .from('profiles')
        .update(payload)
        .eq('id', userId);

      if (error) throw error;

      setEstadoActual(values.estado);                         // CAMBIO: reflejamos cambio en el Tag
      message.success('¡Perfil actualizado exitosamente!');
    } catch (e) {
      console.error(e);
      message.error('No se pudieron guardar los cambios.');
    }
  };

  // --------- SUBIDA DE AVATAR A STORAGE ----------
  const uploadToSupabase = async ({ file, onSuccess, onError }) => {
    if (!userId) {
      onError?.(new Error('Usuario no disponible'));
      return;
    }
    setUploading(true);
    try {
      const ext = file.name.split('.').pop();
      const filePath = `u_${userId}/${Date.now()}.${ext}`;

      // IMPORTANTE: Debes tener un bucket llamado 'avatars' en Supabase Storage
      const { error: upErr } = await supabase
        .storage
        .from('avatars')                 // CAMBIO: usa bucket 'avatars'
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: true
        });
      if (upErr) throw upErr;

      // Obtenemos URL pública (el bucket debe ser público o tener policy pública de lectura)
      const { data: publicData } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);

      const publicUrl = publicData?.publicUrl;
      if (!publicUrl) throw new Error('No se obtuvo URL pública.');

      setImageUrl(publicUrl);
      message.success('Imagen subida.');
      onSuccess?.('ok');
    } catch (e) {
      console.error(e);
      message.error('Error al subir la imagen. Verifica que exista el bucket "avatars" y sea público.');
      onError?.(e);
    } finally {
      setUploading(false);
    }
  };

  return (
    <Card>
      <Title level={3}><span style={{ color: PRIMARY_BLUE }}>📄 Mi Perfil</span></Title>

      {/* Cabecera con Avatar + estado actual */}
      <div style={{ display: 'flex', alignItems: 'center', flexDirection: 'column', marginBottom: 16 }}>
        <Avatar size={128} icon={<UserOutlined />} src={imageUrl || undefined} />
        <Upload
          name="avatar"
          showUploadList={false}
          beforeUpload={beforeUpload}
          customRequest={uploadToSupabase}
          accept="image/*"
          disabled={uploading || loading}
        >
          <Button icon={<UploadOutlined />} style={{ marginTop: 12 }} loading={uploading}>
            {uploading ? 'Subiendo...' : 'Cambiar Foto de Perfil'}
          </Button>
        </Upload>

        {/* CAMBIO: Tag visual de estado actual */}
        <div style={{ marginTop: 10 }}>
          <Text type="secondary">Estado actual:&nbsp;</Text>
          <Tag color={estadoActual === 'activo' ? 'green' : 'red'}>
            {estadoActual?.toUpperCase()}
          </Tag>
        </div>
      </div>

      <Form
        form={form}
        layout="vertical"
        onFinish={onFinish}
        disabled={loading}
      >
        <Form.Item
          name="nombre_completo"
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

        {/* CAMBIO: Nuevo campo para cambiar el estado */}
        <Form.Item
          name="estado"
          label="Estado del usuario"
          rules={[{ required: true, message: 'Selecciona el estado del usuario' }]}
        >
          <Select placeholder="Selecciona estado">
            <Option value="activo">Activo</Option>
            <Option value="inactivo">Inactivo</Option>
          </Select>
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
