import React, { useState, useMemo, useEffect } from 'react';
import {
  Table, Input, Button, Modal, Form,
  Select, Typography, Tag, Space, Tooltip, message, Spin
} from 'antd';
import {
  PlusOutlined, EyeOutlined, EditOutlined,
  DeleteOutlined, SearchOutlined, LockOutlined, MailOutlined
} from '@ant-design/icons';
import { useMediaQuery } from '../hooks/useMediaQuery.js';
// 1. IMPORTAR SUPABASE
import { supabase } from '../supabaseClient.js';
// 2. QUITAR IMPORTACIONES DE FIRESTORE
// import { db } from '../firebaseConfig.js';
// import { collection, addDoc, getDocs, Timestamp, updateDoc, deleteDoc, doc, query, where, limit } from "firebase/firestore";

const { Title, Text } = Typography;
const { Option } = Select;

// Valores por defecto para el formulario de Agregar
const defaultAddValues = {
    rol: 'Usuario', // Cambiado a 'Usuario' por defecto
    estado: 'activo'
};

const UsuariosPage = () => {
  // --- Estados (Sin cambios) ---
  const [users, setUsers] = useState([]);
  const [searchText, setSearchText] = useState('');
  const [pageSize, setPageSize] = useState(10);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isModalVisible, setIsModalVisible] = useState(false); 
  const [isViewModalVisible, setIsViewModalVisible] = useState(false);
  const [isDeleteModalVisible, setIsDeleteModalVisible] = useState(false);
  const [isPermisosModalVisible, setIsPermisosModalVisible] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null); 
  const [form] = Form.useForm();
  const isMobile = useMediaQuery('(max-width: 768px)');

  // --- Cargar Usuarios (MODIFICADO) ---
  const fetchUsers = async () => {
    setLoading(true);
    try {
      // 3. Usar Supabase para leer la tabla 'profiles'
      const { data, error } = await supabase
        .from('profiles')
        .select('*'); // '*' trae todas las columnas (id, username, nombre_completo, etc.)

      if (error) throw error;
      setUsers(data); // Los datos ya vienen como un array
    } catch (error) { 
      console.error("Error loading users: ", error); 
      message.error("Error al cargar usuarios: " + error.message); 
    }
    finally { setLoading(false); }
  };
  useEffect(() => { fetchUsers(); }, []);

  // --- Filtrado (MODIFICADO) ---
  const filteredData = useMemo(() => {
     if (!searchText) return users;
     const lowerSearchText = searchText.toLowerCase();
     return users.filter(user =>
       // 4. Usar 'nombre_completo' (de la DB) en lugar de 'nombreCompleto'
       (user.nombre_completo && user.nombre_completo.toLowerCase().includes(lowerSearchText)) ||
       (user.username && user.username.toLowerCase().includes(lowerSearchText)) ||
       (user.email && user.email.toLowerCase().includes(lowerSearchText)) ||
       (user.rol && user.rol.toLowerCase().includes(lowerSearchText))
     );
   }, [users, searchText]);

  // --- Columnas (MODIFICADO) ---
  const columns = [
    // 5. Usar 'nombre_completo'
    { title: 'Nombre Completo', dataIndex: 'nombre_completo', key: 'nombre_completo', sorter: (a, b) => (a.nombre_completo || '').localeCompare(b.nombre_completo || ''), width: 180, ellipsis: true, fixed: isMobile ? 'left' : false },
    { title: 'Usuario', dataIndex: 'username', key: 'username', sorter: (a, b) => a.username.localeCompare(b.username), width: 120, ellipsis: true, responsive: ['md'] },
    { title: 'Correo Electrónico', dataIndex: 'email', key: 'email', sorter: (a, b) => (a.email || '').localeCompare(b.email || ''), ellipsis: true, responsive: ['lg'], },
    { title: 'Descripción', dataIndex: 'descripcion', key: 'descripcion', ellipsis: true, responsive: ['lg'] },
    { title: 'Rol', dataIndex: 'rol', key: 'rol', width: 100, sorter: (a, b) => (a.rol || '').localeCompare(b.rol || ''), render: (rol) => { let color = 'default'; if (rol === 'Admin') color = 'volcano'; else if (rol === 'Usuario') color = 'green'; else if (rol === 'Invitado') color = 'gold'; return <Tag color={color}>{rol?.toUpperCase() || 'N/A'}</Tag>; }, responsive: ['sm'] },
    { title: 'Estado', dataIndex: 'estado', key: 'estado', width: 100, sorter: (a, b) => (a.estado || '').localeCompare(b.estado || ''), render: (estado) => { const color = estado === 'activo' ? 'success' : 'error'; return <Tag color={color}>{estado?.toUpperCase() || 'N/A'}</Tag>; }, responsive: ['md'] },
    { title: 'Acciones', key: 'acciones', align: 'right', fixed: isMobile ? 'right' : false, width: 150, render: (_, record) => ( <Space size="small"> <Tooltip title="Ver Detalles"><Button type="primary" shape="circle" icon={<EyeOutlined />} onClick={() => handleView(record)} /></Tooltip> <Tooltip title="Editar"><Button type="default" shape="circle" icon={<EditOutlined />} onClick={() => handleEdit(record)} /></Tooltip> <Tooltip title="Permisos"><Button shape="circle" icon={<LockOutlined />} onClick={() => handlePermisos(record)} style={{ color: '#faad14', borderColor: '#faad14' }}/></Tooltip> <Tooltip title="Eliminar"><Button danger shape="circle" icon={<DeleteOutlined />} onClick={() => handleDelete(record)} /></Tooltip> </Space> ) },
   ];

  // --- Manejadores de Modales (Apertura) (Sin cambios) ---
  const handleView = (user) => { setSelectedUser(user); setIsViewModalVisible(true); };
  const handleEdit = (user) => {
    setSelectedUser(user);
    setIsModalVisible(true);
   };
  const handlePermisos = (user) => { setSelectedUser(user); setIsPermisosModalVisible(true); };
  const handleDelete = (user) => { setSelectedUser(user); setIsDeleteModalVisible(true); };
  const handleAdd = () => {
    setSelectedUser(null);
    setIsModalVisible(true);
   };

   // --- useEffect para preparar el formulario (MODIFICADO) ---
   useEffect(() => {
     if (isModalVisible) {
       form.resetFields();
       if (selectedUser) {
         // 6. Mapear 'nombre_completo' (DB) a 'nombreCompleto' (Form)
         setTimeout(() => form.setFieldsValue({
            ...selectedUser,
            nombreCompleto: selectedUser.nombre_completo 
         }), 0);
       } else {
         setTimeout(() => form.setFieldsValue(defaultAddValues), 0);
       }
     }
   }, [isModalVisible, selectedUser, form]);

  // --- Validación de Username (MODIFICADO) ---
  const validateUsername = async (_, value) => {
    if (!value) return Promise.resolve();
    try {
      // 7. Validar contra Supabase
      const { data, error } = await supabase
        .from('profiles')
        .select('id')
        .eq('username', value.toLowerCase())
        .limit(1);

      if (error) throw error;
      if (selectedUser && data.length > 0 && data[0].id === selectedUser.id) return Promise.resolve();
      if (data.length > 0) return Promise.reject(new Error('Este nombre de usuario ya está en uso.'));
      return Promise.resolve();
    } catch (error) { 
        console.error("Error al validar username:", error); 
        return Promise.reject(new Error('No se pudo validar el username.')); 
    }
  };

  // --- Lógica CRUD ---
  const handleOk = () => { selectedUser ? handleEditOk() : handleAddOk(); };

  // --- handleAddOk (GRAN CAMBIO) ---
  const handleAddOk = async () => {
    setSaving(true);
    let createdAuthUserId = null; // Para guardar el ID del usuario de auth

    try {
      const values = await form.validateFields();
      
      // --- PASO 1: Crear el usuario en supabase.auth ---
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: values.email,
        password: values.password, // Toma la contraseña del formulario
      });

      if (authError) throw authError; // Falla si el email ya existe o la contraseña es débil
      if (!authData.user) throw new Error("No se pudo crear el usuario de autenticación.");
      
      createdAuthUserId = authData.user.id; // Guardamos el ID

      // --- PASO 2: Crear el perfil en public.profiles ---
      const profileData = {
        id: createdAuthUserId, // Vincula al usuario de auth
        nombre_completo: values.nombreCompleto,
        username: values.username.toLowerCase(),
        email: values.email,
        descripcion: values.descripcion,
        rol: values.rol,
        estado: values.estado,
      };

      const { error: profileError } = await supabase
        .from('profiles')
        .insert(profileData);
      
      if (profileError) throw profileError;

      await fetchUsers();
      setIsModalVisible(false);
      message.success('Usuario agregado exitosamente');

    } catch (errorInfo) {
      console.error("Error Supabase (Add): ", errorInfo);
      message.error("Error al guardar usuario: " + errorInfo.message);

      // Si el perfil falló pero el auth user se creó, intentamos borrar el auth user
      if (createdAuthUserId) {
         console.warn("Intentando revertir creación de auth user...");
         // Esto requiere una función de servidor (Edge Function)
         // Por ahora, solo notificamos
         message.error("El perfil no se creó, pero la cuenta de auth sí. Se requiere limpieza manual.", 10);
      }
    } finally {
      setSaving(false);
    }
  };

  // --- handleEditOk (MODIFICADO) ---
  const handleEditOk = async () => {
    setSaving(true);
    try {
      const values = await form.validateFields();
      
      // 8. Preparamos los datos solo para la tabla 'profiles'
      // Ya no manejamos la contraseña aquí.
      const updateData = {
        nombre_completo: values.nombreCompleto,
        username: values.username.toLowerCase(),
        email: values.email || '',
        descripcion: values.descripcion,
        rol: values.rol,
        estado: values.estado,
      };

      // 9. Damos UPDATE a 'profiles'
      const { error } = await supabase
        .from('profiles')
        .update(updateData)
        .eq('id', selectedUser.id);
        
      if (error) throw error;

      await fetchUsers();
      setIsModalVisible(false);
      message.success('Usuario actualizado exitosamente');
    } catch (errorInfo) {
       console.error("Error Supabase (Edit): ", errorInfo); 
       message.error("Error al actualizar usuario: " + errorInfo.message);
    } finally { setSaving(false); }
   };

  // --- handleDeleteOk (MODIFICADO) ---
  const handleDeleteOk = async () => {
    setSaving(true);
    try {
      // 10. Borramos solo de 'profiles'. 
      const { error } = await supabase
        .from('profiles')
        .delete()
        .eq('id', selectedUser.id);

      if (error) throw error;
      
      await fetchUsers();
      setIsDeleteModalVisible(false);
      message.success('Perfil de usuario eliminado.');
      message.warning('La cuenta de autenticación (login) de este usuario sigue existiendo. Debe eliminarse manualmente desde el panel de Supabase.', 10);
    } catch (error) { 
      console.error("Error al eliminar usuario: ", error); 
      message.error("Error al eliminar perfil: " + error.message); 
    }
    finally { setSaving(false); }
   };

  const handlePermisosOk = () => { message.info('Funcionalidad permisos no implementada.'); setIsPermisosModalVisible(false); };

  const PRIMARY_BLUE = '#2a8bb6';

  // --- Renderizado (MODIFICADO) ---
  return (
    <>
      <Title level={2} style={{ color: PRIMARY_BLUE, fontWeight: 'bold' }}> 🧑‍🤝‍🧑 Gestión de Usuarios </Title>
      <Text type="secondary"> Listado completo de usuarios del sistema y herramientas de administración. </Text>

      {/* Controles (Sin cambios) */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '24px 0', flexWrap: 'wrap', gap: '16px' }}>
         <Input prefix={<SearchOutlined />} placeholder="Buscar por Nombre, Usuario, Email o Rol..." onChange={e => setSearchText(e.target.value)} style={{ minWidth: '250px', flex: 1 }} />
         <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
             <Text>Mostrar:</Text>
             <Select value={pageSize} onChange={(value) => setPageSize(value)} style={{ width: 80 }} >
                 <Option value={10}>10</Option> <Option value={20}>20</Option> <Option value={30}>30</Option> <Option value={40}>40</Option> <Option value={100}>100</Option>
             </Select>
         </div>
         {/* El botón de Agregar sigue funcionando, pero ahora usa el flujo de Supabase */}
         <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}> Agregar Nuevo Usuario </Button>
       </div>

      {/* Tabla (Sin cambios) */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '50px' }}>
          <Spin size="large" />
        </div>
       ) : (
        <div style={{ overflowX: 'auto' }}>
          <Table
            columns={columns}
            dataSource={filteredData}
            scroll={{ x: true }}
            pagination={{ pageSize: pageSize }}
            rowKey="id" 
          />
        </div>
       )}

      {/* --- Modales --- */}
      <Modal
        title={selectedUser ? "Editar Usuario" : "Agregar Nuevo Usuario"}
        open={isModalVisible}
        onOk={handleOk}
        confirmLoading={saving}
        onCancel={() => {setIsModalVisible(false); setSelectedUser(null);}}
        destroyOnHidden
      >
        <Form
          form={form}
          layout="vertical"
          name="userForm"
          preserve={false}
        >
          {/* 11. El 'name' del form es 'nombreCompleto' */}
          <Form.Item name="nombreCompleto" label="Nombre Completo" rules={[{ required: true, message: 'El nombre completo es obligatorio' }]}>
            <Input />
          </Form.Item>
          <Form.Item name="username" label="Nombre de Usuario" rules={[{ required: true, message: 'El nombre de usuario es obligatorio' }, { validator: validateUsername }]} validateTrigger="onBlur" >
            <Input />
          </Form.Item>
          {/* El email será de solo lectura si estamos editando, porque está ligado al auth.user */}
          <Form.Item name="email" label="Correo Electrónico" rules={[{ required: true, message: 'El correo es obligatorio' },{ type: 'email', message: 'Ingresa un correo válido' }]} >
            <Input prefix={<MailOutlined />} placeholder="ejemplo@correo.com" disabled={!!selectedUser} />
          </Form.Item>
          
          {/* 12. ELIMINAMOS el campo de contraseña si estamos EDITANDO */}
          {/* Solo mostramos la contraseña al CREAR */}
          {!selectedUser && (
            <Form.Item name="password" label="Contraseña" rules={[{ required: true, message: 'Contraseña obligatoria' }]}>
              <Input.Password placeholder="Contraseña" />
            </Form.Item>
          )}

          <Form.Item name="descripcion" label="Descripción">
            <Input.TextArea rows={2} />
          </Form.Item>
          <Form.Item name="rol" label="Rol" rules={[{ required: true, message: 'Selecciona un rol' }]}>
            <Select placeholder="Selecciona un rol">
              <Option value="Admin">Admin</Option>
              <Option value="Usuario">Usuario</Option>
              <Option value="Invitado">Invitado</Option>
            </Select>
          </Form.Item>
          <Form.Item name="estado" label="Estado" rules={[{ required: true, message: 'Selecciona un estado' }]}>
            <Select placeholder="Selecciona un estado">
              <Option value="activo">Activo</Option>
              <Option value="inactivo">Inactivo</Option>
            </Select>
          </Form.Item>
        </Form>
      </Modal>

      {/* Otros Modales (MODIFICADO) */}
      <Modal title={`Permisos para "${selectedUser?.nombre_completo}"`} open={isPermisosModalVisible} onOk={handlePermisosOk} onCancel={() => setIsPermisosModalVisible(false)} >
         <p>Aquí se configurarán los permisos.</p>
      </Modal>
      <Modal title="Detalles del Usuario" open={isViewModalVisible} onOk={() => setIsViewModalVisible(false)} onCancel={() => setIsViewModalVisible(false)} footer={[<Button key="ok" type="primary" onClick={() => setIsViewModalVisible(false)}>Cerrar</Button>]} >
          {selectedUser && (
            <div>
              {/* 13. Usar 'nombre_completo' */}
              <p><strong>Nombre:</strong> {selectedUser.nombre_completo}</p>
              <p><strong>Usuario:</strong> {selectedUser.username}</p>
              <p><strong>Correo:</strong> {selectedUser.email || 'N/A'}</p>
              <p><strong>Desc:</strong> {selectedUser.descripcion || 'N/A'}</p>
              <p><strong>Rol:</strong> {selectedUser.rol}</p>
              <p><strong>Estado:</strong> {selectedUser.estado}</p>
            </div>
           )}
       </Modal>
      <Modal title="Confirmar Eliminación" open={isDeleteModalVisible} onOk={handleDeleteOk} confirmLoading={saving} onCancel={() => setIsDeleteModalVisible(false)} okText="Eliminar" cancelText="Cancelar" okButtonProps={{ danger: true }} >
         {/* 14. Usar 'nombre_completo' */}
         <p>Eliminar a "{selectedUser?.nombre_completo}" ({selectedUser?.username})?</p>
         <Text type="danger">Advertencia: Esto solo eliminará el perfil, no la cuenta de autenticación.</Text>
      </Modal>
    </>
  );
};

export default UsuariosPage;