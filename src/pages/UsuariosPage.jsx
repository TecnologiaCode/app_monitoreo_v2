// src/pages/UsuariosPage.jsx
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
import { supabase } from '../supabaseClient.js';
import { useAuth } from '../context/AuthContext';               // ✅ usamos AuthContext
import PermisosModal from '../components/PermisosModal';

const { Title, Text } = Typography;
const { Option } = Select;

const defaultAddValues = {
  rol: 'Usuario',
  estado: 'activo'
};

const UsuariosPage = () => {
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

  // CAMBIO: traemos también la session actual (admin)
  const { can, session } = useAuth();                           // CAMBIO: antes solo { can }

  // --- Cargar Usuarios ---
  const fetchUsers = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, nombre_completo, username, email, descripcion, rol, estado, permisos_usuarios')
        .order('username', { ascending: true });

      if (error) throw error;
      setUsers(data || []);
    } catch (error) {
      console.error("Error loading users: ", error);
      message.error("Error al cargar usuarios: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchUsers(); }, []);

  useEffect(() => {
    const channel = supabase
      .channel('profiles_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, () => {
        fetchUsers();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  // --- Filtrado ---
  const filteredData = useMemo(() => {
    if (!searchText) return users;
    const lowerSearchText = searchText.toLowerCase();
    return users.filter(user =>
      (user.nombre_completo && user.nombre_completo.toLowerCase().includes(lowerSearchText)) ||
      (user.username && user.username.toLowerCase().includes(lowerSearchText)) ||
      (user.email && user.email.toLowerCase().includes(lowerSearchText)) ||
      (user.rol && user.rol.toLowerCase().includes(lowerSearchText))
    );
  }, [users, searchText]);

  // --- Columnas ---
  const columns = [
    {
      title: 'Nombre Completo',
      dataIndex: 'nombre_completo',
      key: 'nombre_completo',
      sorter: (a, b) => (a.nombre_completo || '').localeCompare(b.nombre_completo || ''),
      width: 180,
      ellipsis: true,
      fixed: isMobile ? 'left' : false
    },
    {
      title: 'Usuario',
      dataIndex: 'username',
      key: 'username',
      sorter: (a, b) => (a.username || '').localeCompare(b.username || ''),
      width: 120,
      ellipsis: true,
      responsive: ['md']
    },
    {
      title: 'Correo Electrónico',
      dataIndex: 'email',
      key: 'email',
      sorter: (a, b) => (a.email || '').localeCompare(b.email || ''),
      ellipsis: true,
      responsive: ['lg'],
    },
    {
      title: 'Descripción',
      dataIndex: 'descripcion',
      key: 'descripcion',
      ellipsis: true,
      responsive: ['lg']
    },
    {
      title: 'Rol',
      dataIndex: 'rol',
      key: 'rol',
      width: 100,
      sorter: (a, b) => (a.rol || '').localeCompare(b.rol || ''),
      render: (rol) => {
        let color = 'default';
        if (rol === 'Admin') color = 'volcano';
        else if (rol === 'Usuario') color = 'green';
        else if (rol === 'Invitado') color = 'gold';
        return <Tag color={color}>{rol?.toUpperCase() || 'N/A'}</Tag>;
      },
      responsive: ['sm']
    },
    {
      title: 'Estado',
      dataIndex: 'estado',
      key: 'estado',
      width: 100,
      sorter: (a, b) => (a.estado || '').localeCompare(b.estado || ''),
      render: (estado) => {
        const color = estado === 'activo' ? 'success' : 'error';
        return <Tag color={color}>{estado?.toUpperCase() || 'N/A'}</Tag>;
      },
      responsive: ['md']
    },
    {
      title: 'Acciones',
      key: 'acciones',
      align: 'center',
      fixed: isMobile ? 'right' : false,
      width: 130,
      render: (_, record) => (
        <Space size="small">
          {can('users:read') && (
            <Tooltip title="Ver Detalles">
              <Button
                type="primary"
                shape="circle"
                icon={<EyeOutlined />}
                onClick={() => handleView(record)}
              />
            </Tooltip>
          )}
          {can('users:write') && (
            <Tooltip title="Editar">
              <Button
                type="default"
                shape="circle"
                icon={<EditOutlined />}
                onClick={() => handleEdit(record)}
              />
            </Tooltip>
          )}
          {can('users:permissions') && (
            <Tooltip title="Permisos">
              <Button
                shape="circle"
                icon={<LockOutlined />}
                onClick={() => handlePermisos(record)}
                style={{ color: '#faad14', borderColor: '#faad14' }}
              />
            </Tooltip>
          )}
          {can('users:delete') && (
            <Tooltip title="Eliminar">
              <Button
                danger
                shape="circle"
                icon={<DeleteOutlined />}
                onClick={() => handleDelete(record)}
              />
            </Tooltip>
          )}
        </Space>
      )
    },
  ];

  // --- Manejadores de modales ---
  const handleView = (user) => { setSelectedUser(user); setIsViewModalVisible(true); };
  const handleEdit = (user) => { setSelectedUser(user); setIsModalVisible(true); };
  const handlePermisos = (user) => { setSelectedUser(user); setIsPermisosModalVisible(true); };
  const handleDelete = (user) => { setSelectedUser(user); setIsDeleteModalVisible(true); };
  const handleAdd = () => { setSelectedUser(null); setIsModalVisible(true); };

  useEffect(() => {
    if (isModalVisible) {
      form.resetFields();
      if (selectedUser) {
        setTimeout(() => form.setFieldsValue({
          ...selectedUser,
          nombreCompleto: selectedUser.nombre_completo
        }), 0);
      } else {
        setTimeout(() => form.setFieldsValue(defaultAddValues), 0);
      }
    }
  }, [isModalVisible, selectedUser, form]);

  // --- Validación de username ---
  const validateUsername = async (_, value) => {
    if (!value) return Promise.resolve();
    try {
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

  // --- CRUD ---
  const handleOk = () => { selectedUser ? handleEditOk() : handleAddOk(); };

  const handleAddOk = async () => {
    setSaving(true);
    let createdAuthUserId = null;

    // CAMBIO: guardamos la sesión actual del admin (si existe)
    const adminSession = session;                                  // CAMBIO

    try {
      const values = await form.validateFields();

      // 1) Creamos el usuario de autenticación (esto CAMBIA la sesión a ese usuario)
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: values.email,
        password: values.password,
      });

      if (authError) throw authError;
      if (!authData.user) throw new Error("No se pudo crear el usuario de autenticación.");

      createdAuthUserId = authData.user.id;

      // 2) Creamos su perfil
      const profileData = {
        id: createdAuthUserId,
        nombre_completo: values.nombreCompleto,
        username: values.username.toLowerCase(),
        email: values.email,
        descripcion: values.descripcion,
        rol: values.rol,
        estado: values.estado,
        permisos_usuarios: []                                      // sin permisos explícitos al inicio
      };

      const { error: profileError } = await supabase
        .from('profiles')
        .insert(profileData);

      if (profileError) throw profileError;

      // 3) RESTAURAMOS la sesión original del admin
      if (adminSession?.access_token && adminSession?.refresh_token) {  // CAMBIO
        const { error: restoreError } = await supabase.auth.setSession({
          access_token: adminSession.access_token,
          refresh_token: adminSession.refresh_token,
        });
        if (restoreError) {
          console.error('Error al restaurar la sesión del admin:', restoreError);
          message.warning('Usuario creado, pero hubo un problema restaurando tu sesión. Vuelve a iniciar sesión si es necesario.');
        }
      }

      setIsModalVisible(false);
      message.success('Usuario agregado exitosamente');
      fetchUsers();
    } catch (errorInfo) {
      console.error("Error Supabase (Add): ", errorInfo);
      message.error("Error al guardar usuario: " + (errorInfo.message || 'Desconocido'));

      if (createdAuthUserId) {
        message.error("El perfil no se creó correctamente, pero la cuenta de auth sí. Revisa en Supabase.", 10);
      }
    } finally {
      setSaving(false);
    }
  };

  const handleEditOk = async () => {
    setSaving(true);
    try {
      const values = await form.validateFields();

      const updateData = {
        nombre_completo: values.nombreCompleto,
        username: values.username.toLowerCase(),
        email: values.email || '',
        descripcion: values.descripcion,
        rol: values.rol,
        estado: values.estado,
      };

      const { error } = await supabase
        .from('profiles')
        .update(updateData)
        .eq('id', selectedUser.id);

      if (error) throw error;

      setIsModalVisible(false);
      message.success('Usuario actualizado exitosamente');
      fetchUsers();
    } catch (errorInfo) {
      console.error("Error Supabase (Edit): ", errorInfo);
      message.error("Error al actualizar usuario: " + errorInfo.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteOk = async () => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .delete()
        .eq('id', selectedUser.id);

      if (error) throw error;

      setIsDeleteModalVisible(false);
      message.success('Perfil de usuario eliminado.');
      message.warning('La cuenta de autenticación (login) de este usuario sigue existiendo. Debe eliminarse manualmente desde el panel de Supabase.', 10);
      fetchUsers();
    } catch (error) {
      console.error("Error al eliminar usuario: ", error);
      message.error("Error al eliminar perfil: " + error.message);
    } finally {
      setSaving(false);
    }
  };

  const handlePermisosOk = async (newPerms) => {
    if (!selectedUser) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ permisos_usuarios: newPerms })
        .eq('id', selectedUser.id);

      if (error) throw error;

      setIsPermisosModalVisible(false);
      message.success('Permisos actualizados.');
      fetchUsers();
    } catch (e) {
      console.error(e);
      message.error('No se pudieron actualizar los permisos.');
    } finally {
      setSaving(false);
    }
  };

  const PRIMARY_BLUE = '#2a8bb6';

  return (
    <>
      <Title level={2} style={{ color: PRIMARY_BLUE, fontWeight: 'bold' }}> 🧑‍🤝‍🧑 Gestión de Usuarios </Title>
      <Text type="secondary"> Listado completo de usuarios del sistema y herramientas de administración. </Text>

      <div
        style={{
          display: 'flex',
          justifyContent: 'nivel',
          alignItems: 'center',
          margin: '24px 0',
          flexWrap: 'wrap',
          gap: '16px'
        }}
      >
        <Input
          prefix={<SearchOutlined />}
          placeholder="Buscar por Nombre, Usuario, Email o Rol..."
          onChange={e => setSearchText(e.target.value)}
          style={{ minWidth: '250px', flex: 1 }}
        />
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Text>Mostrar:</Text>
          <Select
            value={pageSize}
            onChange={(value) => setPageSize(value)}
            style={{ width: 80 }}
          >
            <Option value={10}>10</Option>
            <Option value={20}>20</Option>
            <Option value={30}>30</Option>
            <Option value={40}>50</Option>
            <Option value={100}>100</Option>
          </Select>
        </div>
        {can('users:write') && (
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={handleAdd}
          >
            Agregar Nuevo Usuario
          </Button>
        )}
      </div>

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

      {/* Modal Crear/Editar */}
      <Modal
        title={selectedUser ? "Editar Usuario" : "Agregar Nuevo Usuario"}
        open={isModalVisible}
        onOk={handleOk}
        confirmLoading={saving}
        onCancel={() => { setIsModalVisible(false); setSelectedUser(null); }}
        destroyOnHidden                                   // ✅ API nueva de AntD
      >
        <Form
          form={form}
          layout="vertical"
          name="userForm"
          preserve={false}
        >
          <Form.Item
            name="nombreCompleto"
            label="Nombre Completo"
            rules={[{ required: true, message: 'El nombre completo es obligatorio' }]}
          >
            <Input />
          </Form.Item>
          <Form.Item
            name="username"
            label="Nombre de Usuario"
            rules={[
              { required: true, message: 'El nombre de usuario es obligatorio' },
              { validator: validateUsername }
            ]}
            validateTrigger="onBlur"
          >
            <Input />
          </Form.Item>
          <Form.Item
            name="email"
            label="Correo Electrónico"
            rules={[
              { required: true, message: 'El correo es obligatorio' },
              { type: 'email', message: 'Ingresa un correo válido' }
            ]}
          >
            <Input
              prefix={<MailOutlined />}
              placeholder="ejemplo@correo.com"
              disabled={!!selectedUser}
            />
          </Form.Item>
          {!selectedUser && (
            <Form.Item
              name="password"
              label="Contraseña"
              rules={[{ required: true, message: 'Contraseña obligatoria' }]}
            >
              <Input.Password placeholder="Contraseña" />
            </Form.Item>
          )}
          <Form.Item name="descripcion" label="Descripción">
            <Input.TextArea rows={2} />
          </Form.Item>
          <Form.Item
            name="rol"
            label="Rol"
            rules={[{ required: true, message: 'Selecciona un rol' }]}
          >
            <Select placeholder="Selecciona un rol">
              <Option value="Admin">Admin</Option>
              <Option value="Usuario">Usuario</Option>
              <Option value="Invitado">Invitado</Option>
            </Select>
          </Form.Item>
          <Form.Item
            name="estado"
            label="Estado"
            rules={[{ required: true, message: 'Selecciona un estado' }]}
          >
            <Select placeholder="Selecciona un estado">
              <Option value="activo">Activo</Option>
              <Option value="inactivo">Inactivo</Option>
            </Select>
          </Form.Item>
        </Form>
      </Modal>

      {/* Modal Detalles */}
      <Modal
        title="Detalles del Usuario"
        open={isViewModalVisible}
        onOk={() => setIsViewModalVisible(false)}
        onCancel={() => setIsViewModalVisible(false)}
        footer={[
          <Button key="ok" type="primary" onClick={() => setIsViewModalVisible(false)}>
            Cerrar
          </Button>
        ]}
      >
        {selectedUser && (
          <div>
            <p><strong>Nombre:</strong> {selectedUser.nombre_completo}</p>
            <p><strong>Usuario:</strong> {selectedUser.username}</p>
            <p><strong>Correo:</strong> {selectedUser.email || 'N/A'}</p>
            <p><strong>Desc:</strong> {selectedUser.descripcion || '-'}</p>
            <p><strong>Rol:</strong> {selectedUser.rol}</p>
            <p><strong>Estado:</strong> {selectedUser.estado}</p>
            <div style={{ marginTop: 8 }}>
              <strong>Permisos:</strong>{' '}
              {Array.isArray(selectedUser.permisos_usuarios) && selectedUser.permisos_usuarios.length > 0
                ? selectedUser.permisos_usuarios.map(p => <Tag key={p}>{p}</Tag>)
                : <Text type="secondary">Sin permisos</Text>}
            </div>
          </div>
        )}
      </Modal>

      {/* Modal Confirmar Eliminación */}
      <Modal
        title="Confirmar Eliminación"
        open={isDeleteModalVisible}
        onOk={handleDeleteOk}
        confirmLoading={saving}
        onCancel={() => setIsDeleteModalVisible(false)}
        okText="Eliminar"
        cancelText="Cancelar"
        okButtonProps={{ danger: true }}
      >
        <p>Eliminar a "{selectedUser?.nombre_completo}" ({selectedUser?.username})?</p>
        <Text type="danger">
          Advertencia: Esto solo eliminará el perfil, no la cuenta de autenticación.
        </Text>
      </Modal>

      {/* Modal de permisos */}
      <PermisosModal
        open={isPermisosModalVisible}
        userRecord={selectedUser}
        onCancel={() => setIsPermisosModalVisible(false)}
        onSave={handlePermisosOk}
        saving={saving}
      />
    </>
  );
};

export default UsuariosPage;
