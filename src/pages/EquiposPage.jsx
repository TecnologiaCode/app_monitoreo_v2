import React, { useState, useMemo, useEffect } from 'react';
import {
  Table, Input, Button, Modal, Form,
  Select, Typography, Tag, Space, Tooltip, message, Spin
} from 'antd';
import {
  PlusOutlined, EyeOutlined, EditOutlined,
  DeleteOutlined, SearchOutlined
} from '@ant-design/icons';
import { useMediaQuery } from '../hooks/useMediaQuery.js';
import { supabase } from '../supabaseClient.js'; 

const { Title, Text } = Typography;
const { Option } = Select;

const EquiposPage = () => {
  // --- Estados (Sin cambios) ---
  const [equipos, setEquipos] = useState([]);
  const [searchText, setSearchText] = useState('');
  const [pageSize, setPageSize] = useState(10);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [isViewModalVisible, setIsViewModalVisible] = useState(false);
  const [isDeleteModalVisible, setIsDeleteModalVisible] = useState(false);
  const [selectedEquipo, setSelectedEquipo] = useState(null);
  const [form] = Form.useForm();
  const isMobile = useMediaQuery('(max-width: 768px)');

  // --- Cargar Equipos (Sin cambios) ---
  const fetchEquipos = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('equipos') 
        .select('*')      
        .order('nombre_equipo', { ascending: true }); 

      if (error) throw error; 
      setEquipos(data); 
    } catch (error) {
      console.error("Error loading equipos: ", error);
      message.error("Error al cargar equipos: " + error.message);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { fetchEquipos(); }, []);

  // --- Filtrado (Sin cambios) ---
  const filteredData = useMemo(() => {
     if (!searchText) return equipos;
     const lowerSearchText = searchText.toLowerCase();
     return equipos.filter(equipo =>
       (equipo.nombre_equipo && equipo.nombre_equipo.toLowerCase().includes(lowerSearchText)) ||
       (equipo.modelo && equipo.modelo.toLowerCase().includes(lowerSearchText)) ||
       (equipo.serie && equipo.serie.toLowerCase().includes(lowerSearchText)) ||
       (equipo.descripcion && equipo.descripcion.toLowerCase().includes(lowerSearchText))
     );
   }, [equipos, searchText]);

  // --- Columnas (Sin cambios) ---
  const columns = [
    { title: 'Nombre de Equipo', dataIndex: 'nombre_equipo', key: 'nombre_equipo', sorter: (a, b) => (a.nombre_equipo || '').localeCompare(b.nombre_equipo || ''), width: 180, ellipsis: true, fixed: isMobile ? 'left' : false },
    { title: 'Modelo', dataIndex: 'modelo', key: 'modelo', sorter: (a, b) => (a.modelo || '').localeCompare(b.modelo || ''), width: 150, ellipsis: true, responsive: ['md'] },
    { title: 'Serie', dataIndex: 'serie', key: 'serie', sorter: (a, b) => (a.serie || '').localeCompare(b.serie || ''), width: 150, ellipsis: true, responsive: ['lg'], },
    { title: 'Descripción', dataIndex: 'descripcion', key: 'descripcion', ellipsis: true, responsive: ['lg'] },
    { 
      title: 'Acciones', 
      key: 'acciones', 
      align: 'right', 
      fixed: isMobile ? 'right' : false, 
      width: 120,
      render: (_, record) => ( 
        <Space size="small"> 
          <Tooltip title="Ver Detalles"><Button type="primary" shape="circle" icon={<EyeOutlined />} onClick={() => handleView(record)} /></Tooltip> 
          <Tooltip title="Editar"><Button type="default" shape="circle" icon={<EditOutlined />} onClick={() => handleEdit(record)} /></Tooltip> 
          <Tooltip title="Eliminar"><Button danger shape="circle" icon={<DeleteOutlined />} onClick={() => handleDelete(record)} /></Tooltip> 
        </Space> 
      ) 
    },
   ];

  // --- Manejadores de Modales (Sin cambios) ---
  const handleView = (equipo) => { setSelectedEquipo(equipo); setIsViewModalVisible(true); };
  const handleEdit = (equipo) => {
    setSelectedEquipo(equipo);
    setIsModalVisible(true);
   };
  const handleDelete = (equipo) => { setSelectedEquipo(equipo); setIsDeleteModalVisible(true); };
  const handleAdd = () => {
    setSelectedEquipo(null);
    setIsModalVisible(true);
   };

   // --- useEffect para preparar el formulario (Sin cambios) ---
   useEffect(() => {
     if (isModalVisible) {
       form.resetFields(); 
       if (selectedEquipo) {
         // MODIFICADO: Aseguramos que el form llene 'nombre_equipo'
         setTimeout(() => form.setFieldsValue({
           ...selectedEquipo,
           nombre_equipo: selectedEquipo.nombre_equipo 
         }), 0);
       } 
     }
   }, [isModalVisible, selectedEquipo, form]);

  // --- Validación de N° de Serie (Sin cambios) ---
  const validateSerie = async (_, value) => {
    if (!value) return Promise.resolve();
    try {
      const { data, error } = await supabase
        .from('equipos')
        .select('id')
        .eq('serie', value.toLowerCase())
        .limit(1);
      if (error) throw error;
      if (selectedEquipo && data.length > 0 && data[0].id === selectedEquipo.id) {
        return Promise.resolve();
      }
      if (data.length > 0) {
        return Promise.reject(new Error('Este N° de Serie ya está registrado.'));
      }
      return Promise.resolve();
    } catch (error) { 
      console.error("Error al validar N° de Serie:", error); 
      return Promise.reject(new Error('No se pudo validar el N° de Serie.')); 
    }
  };

  // --- Lógica CRUD ---
  const handleOk = () => { selectedEquipo ? handleEditOk() : handleAddOk(); };

  // --- handleAddOk (CORREGIDO) ---
  const handleAddOk = async () => {
    setSaving(true);
    try {
      // 'values' ya contiene { nombre_equipo: "...", serie: "..." }
      const values = await form.validateFields();
      
      const newEquipoData = { 
        ...values, 
        serie: values.serie.toLowerCase(), // Solo actualizamos la serie
      };

      const { error } = await supabase
        .from('equipos')
        .insert(newEquipoData); // Enviamos el objeto limpio

      if (error) throw error;

      await fetchEquipos(); // Recarga
      setIsModalVisible(false);
      message.success('Equipo agregado exitosamente');
    } catch (errorInfo) {
       console.error("Error Supabase (Add): ", errorInfo); 
       message.error("Error al guardar el equipo: " + errorInfo.message);
    } finally { setSaving(false); }
  };

  // --- handleEditOk (CORREGIDO) ---
  const handleEditOk = async () => {
    setSaving(true);
    try {
      // 'values' ya contiene { nombre_equipo: "...", serie: "..." }
      const values = await form.validateFields();
      
      const updateData = { 
        ...values, 
        serie: values.serie.toLowerCase(), // Solo actualizamos la serie
      };

      const { error } = await supabase
        .from('equipos')
        .update(updateData)
        .eq('id', selectedEquipo.id); 

      if (error) throw error;

      await fetchEquipos(); // Recarga
      setIsModalVisible(false);
      message.success('Equipo actualizado exitosamente');
    } catch (errorInfo) {
       console.error("Error Supabase (Edit): ", errorInfo); 
       message.error("Error al actualizar el equipo: " + errorInfo.message);
    } finally { setSaving(false); }
   };

  // --- handleDeleteOk (Sin cambios) ---
  const handleDeleteOk = async () => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from('equipos')
        .delete()
        .eq('id', selectedEquipo.id); 
        
      if (error) throw error;

      await fetchEquipos(); // Recarga
      setIsDeleteModalVisible(false);
      message.success('Equipo eliminado exitosamente');
    } catch (error) { 
      console.error("Error al eliminar equipo: ", error); 
      message.error("Error al eliminar el equipo: " + error.message); 
    } finally { setSaving(false); }
   };

  const PRIMARY_BLUE = '#2a8bb6';

  // --- Renderizado (Sin cambios en los 'name' del Form) ---
  return (
    <>
      <Title level={2} style={{ color: PRIMARY_BLUE, fontWeight: 'bold' }}> 🛠️ Gestión de Equipos </Title>
      <Text type="secondary"> Listado completo de equipos del sistema y herramientas de administración. </Text>

      {/* Controles (Sin cambios) */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '24px 0', flexWrap: 'wrap', gap: '16px' }}>
        <Input 
          prefix={<SearchOutlined />} 
          placeholder="Buscar por Nombre, Modelo, Serie o Descripción..." 
          onChange={e => setSearchText(e.target.value)} 
          style={{ minWidth: '250px', flex: 1 }} 
        />
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Text>Mostrar:</Text>
            <Select value={pageSize} onChange={(value) => setPageSize(value)} style={{ width: 80 }} >
                <Option value={10}>10</Option> <Option value={20}>20</Option> <Option value={30}>30</Option>
            </Select>
        </div>
        <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}> 
          Agregar Nuevo Equipo 
        </Button>
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

      {/* --- Modales (Form 'name' ya estaba correcto) --- */}
      <Modal
        title={selectedEquipo ? "Editar Equipo" : "Agregar Nuevo Equipo"}
        open={isModalVisible}
        onOk={handleOk}
        confirmLoading={saving}
        onCancel={() => {setIsModalVisible(false); setSelectedEquipo(null);}}
        destroyOnHidden
      >
        <Form
          form={form}
          layout="vertical"
          name="equipoForm"
          preserve={false}
        >
          {/* El 'name' aquí ya era correcto ('nombre_equipo') */}
          <Form.Item 
            name="nombre_equipo" 
            label="Nombre de Equipo" 
            rules={[{ required: true, message: 'El nombre es obligatorio' }]}
          >
            <Input />
          </Form.Item>
          
          <Form.Item name="modelo" label="Modelo">
            <Input />
          </Form.Item>

          <Form.Item 
            name="serie" 
            label="N° de Serie" 
            rules={[
              { required: true, message: 'El N° de Serie es obligatorio' },
              { validator: validateSerie }
            ]} 
            validateTrigger="onBlur"
          >
            <Input />
          </Form.Item>

          <Form.Item name="descripcion" label="Descripción">
            <Input.TextArea rows={3} />
          </Form.Item>
        </Form>
      </Modal>

      {/* Modal de Ver Detalles (Sin cambios) */}
      <Modal 
        title="Detalles del Equipo" 
        open={isViewModalVisible} 
        onOk={() => setIsViewModalVisible(false)} 
        onCancel={() => setIsViewModalVisible(false)} 
        footer={[<Button key="ok" type="primary" onClick={() => setIsViewModalVisible(false)}>Cerrar</Button>]} 
      >
          {selectedEquipo && (
            <div>
              <p><strong>Nombre:</strong> {selectedEquipo.nombre_equipo}</p>
              <p><strong>Modelo:</strong> {selectedEquipo.modelo || 'N/A'}</p>
              <p><strong>Serie:</strong> {selectedEquipo.serie || 'N/A'}</p>
              <p><strong>Descripción:</strong> {selectedEquipo.descripcion || 'N/A'}</p>
            </div>
           )}
       </Modal>

      {/* Modal de Eliminar (Sin cambios) */}
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
        <p>¿Estás seguro de que deseas eliminar el equipo "{selectedEquipo?.nombre_equipo}" (Serie: {selectedEquipo?.serie})?</p>
      </Modal>
    </>
  );
};

export default EquiposPage;
