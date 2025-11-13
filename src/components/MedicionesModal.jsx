import React, { useState, useEffect } from 'react';
import {
  Modal, Table, Button, Form, Input,
  Select, Typography, Space, Tooltip, message, Spin, InputNumber,
  Popover, Tag // <-- Popover y Tag añadidos
} from 'antd';
import {
  PlusOutlined, EditOutlined, DeleteOutlined, LinkOutlined, 
  PaperClipOutlined, MinusCircleOutlined // <-- Íconos añadidos
} from '@ant-design/icons';
import { db } from '../firebaseConfig.js';
import { 
  collection, addDoc, getDocs, Timestamp, updateDoc, deleteDoc, doc,
  deleteField // <-- deleteField añadido
} from "firebase/firestore";

const { Text } = Typography;
const { Option } = Select;

// Opciones de ejemplo
const tiposDeIluminacion = ["Natural", "LED", "Fluorescente", "Mixta"];

// --- FUNCIÓN HELPER ---
// Para calcular el promedio de las lecturas
const calculateAverage = (lecturas) => {
  if (!lecturas || lecturas.length === 0) return 0;
  const sum = lecturas.reduce((acc, val) => acc + (val || 0), 0);
  return (sum / lecturas.length).toFixed(1); // Promedio con 1 decimal
};

/**
 * Componente Modal para gestionar la sub-colección de Mediciones
 */
const MedicionesModal = ({ visible, onClose, monitoreo, projectId }) => {
  const [form] = Form.useForm();
  const [mediciones, setMediciones] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isFormModalVisible, setIsFormModalVisible] = useState(false);
  const [selectedMedicion, setSelectedMedicion] = useState(null);

  // Referencia a la sub-colección
  const getMedicionesCollectionRef = () => {
    if (!projectId || !monitoreo || !monitoreo.id) return null;
    return collection(db, "proyectos", projectId, "monitoreos", monitoreo.id, "mediciones");
  };

  // --- Cargar Mediciones ---
  const fetchMediciones = async () => {
    const collectionRef = getMedicionesCollectionRef();
    if (!collectionRef) { setLoading(false); return; }
    
    setLoading(true);
    try {
      const querySnapshot = await getDocs(collectionRef);
      const data = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      }));
      setMediciones(data);
    } catch (error) { console.error("Error loading mediciones: ", error); message.error("Error al cargar mediciones."); }
    finally { setLoading(false); }
  };

  useEffect(() => {
    if (visible && projectId && monitoreo?.id) {
      fetchMediciones();
    }
  }, [visible, monitoreo?.id, projectId]);

  // --- Columnas de la tabla de Mediciones (MODIFICADA) ---
  const columns = [
    { title: 'N°', key: 'numero', render: (text, record, index) => index + 1, width: 60 },
    { title: 'Área', dataIndex: 'area', key: 'area', ellipsis: true },
    { title: 'Puesto de Trabajo', dataIndex: 'puestoTrabajo', key: 'puestoTrabajo', ellipsis: true },
    { title: 'Punto de Medición', dataIndex: 'puntoMedicion', key: 'puntoMedicion', ellipsis: true },
    { title: 'Horario', dataIndex: 'horarioMedicion', key: 'horarioMedicion', width: 100 },
    { title: 'Tipo Iluminación', dataIndex: 'tipoIluminacion', key: 'tipoIluminacion', ellipsis: true },
    { title: 'Nivel Requerido (LUX)', dataIndex: 'nivelRequerido', key: 'nivelRequerido', width: 120 },
    
    // --- COLUMNA MODIFICADA ---
    { 
      title: 'Mediciones (LUX)', // Título cambiado
      dataIndex: 'lecturas',      // dataIndex cambiado
      key: 'lecturas', 
      width: 150,
      render: (lecturas) => {
        // 'lecturas' es ahora un array [500, 510, 520]
        // 'resultadoMedicion' es el campo antiguo (para compatibilidad)
        const data = lecturas || [];
        
        // Si es un array vacío y existe el dato antiguo, úsalo
        if (data.length === 0 && arguments[1].resultadoMedicion) {
          data.push(arguments[1].resultadoMedicion);
        }

        if (data.length === 0) {
          return <Tag color="default">Sin lecturas</Tag>;
        }

        const avg = calculateAverage(data);
        
        // Contenido del Popover (el desplegable)
        const content = (
          <div style={{ maxWidth: 200 }}>
            <Text strong>Lecturas Individuales:</Text>
            <ul style={{ paddingLeft: 18, margin: '8px 0 0 0' }}>
              {data.map((lec, index) => (
                <li key={index}>{lec} LUX</li>
              ))}
            </ul>
          </div>
        );

        return (
          <Popover content={content} title="Detalle de Mediciones" trigger="hover">
            <Tag color="blue" style={{ cursor: 'pointer' }}>
              Promedio: {avg} LUX ({data.length})
            </Tag>
          </Popover>
        );
      }
    },
    // --- FIN COLUMNA MODIFICADA ---

    { 
      title: 'Fotografía', 
      dataIndex: 'fotografiaUrl', 
      key: 'fotografiaUrl', 
      width: 100,
      render: (url) => url ? (<a href={url} target="_blank" rel="noopener noreferrer"><Button type="link" icon={<LinkOutlined />} size="small">Ver</Button></a>) : <Text type="secondary">N/A</Text>
    },
    { title: 'Coordenadas', dataIndex: 'coordenadas', key: 'coordenadas', ellipsis: true },
    { title: 'Observaciones', dataIndex: 'observaciones', key: 'observaciones', ellipsis: true },
    { 
      title: 'Acciones', 
      key: 'acciones', 
      align: 'right', 
      fixed: 'right',
      width: 100, 
      render: (_, record) => ( 
        <Space size="small">
          <Tooltip title="Editar"><Button type="default" shape="circle" icon={<EditOutlined />} onClick={() => handleEdit(record)} /></Tooltip> 
          <Tooltip title="Eliminar"><Button danger shape="circle" icon={<DeleteOutlined />} onClick={() => handleDelete(record)} /></Tooltip> 
        </Space> 
      ) 
    },
   ];

  // --- Manejadores de Formulario ---
  const handleAdd = () => {
    setSelectedMedicion(null);
    form.resetFields();
    form.setFieldsValue({ lecturas: [undefined] }); // Inicia con un campo de lectura
    setIsFormModalVisible(true);
  };
  
  // MODIFICADO para compatibilidad
  const handleEdit = (record) => {
    setSelectedMedicion(record);

    let formData = { ...record };

    // --- Compatibilidad con datos antiguos ---
    // Si el dato es antiguo (resultadoMedicion) y no existe 'lecturas'
    if (record.resultadoMedicion && !record.lecturas) {
      formData.lecturas = [record.resultadoMedicion]; // Conviértelo en un array
    } else if (!record.lecturas || record.lecturas.length === 0) {
      formData.lecturas = [undefined]; // Asegura al menos un campo
    }
    // --- Fin Compatibilidad ---

    form.setFieldsValue(formData);
    setIsFormModalVisible(true);
  };

  const handleDelete = async (record) => {
    const collectionRef = getMedicionesCollectionRef();
    if (!collectionRef) return;
    try {
      const medicionRef = doc(collectionRef, record.id);
      await deleteDoc(medicionRef);
      message.success('Medición eliminada');
      fetchMediciones();
    } catch (error) { message.error('Error al eliminar'); }
  };

  const handleFormOk = () => {
    selectedMedicion ? handleEditOk() : handleAddOk();
  };
  
  const handleFormCancel = () => {
    setIsFormModalVisible(false);
    setSelectedMedicion(null);
    form.resetFields();
  };

  // MODIFICADO (ligero)
  const handleAddOk = async () => {
    const collectionRef = getMedicionesCollectionRef();
    if (!collectionRef) return;
    
    setSaving(true);
    try {
      const values = await form.validateFields();
      // Filtra lecturas nulas o indefinidas
      const cleanValues = {
        ...values,
        lecturas: (values.lecturas || []).filter(lec => lec != null)
      };
      
      const newData = { ...cleanValues, fechaRegistro: Timestamp.fromDate(new Date()) };
      await addDoc(collectionRef, newData);
      await fetchMediciones(); 
      setIsFormModalVisible(false);
      message.success('Medición agregada');
    } catch (errorInfo) { message.error("Error al guardar."); }
    finally { setSaving(false); }
  };

  // MODIFICADO para limpiar datos antiguos
  const handleEditOk = async () => {
    const collectionRef = getMedicionesCollectionRef();
    if (!collectionRef) return;

    setSaving(true);
    try {
      if (!selectedMedicion || !selectedMedicion.id) {
        message.error("Error: ID no encontrado."); return;
      }
      const values = await form.validateFields();
      
      // Filtra lecturas nulas o indefinidas
      const updateData = {
        ...values,
        lecturas: (values.lecturas || []).filter(lec => lec != null),
        resultadoMedicion: deleteField() // <-- ELIMINA EL CAMPO ANTIGUO
      };

      const medicionRef = doc(collectionRef, selectedMedicion.id);
      await updateDoc(medicionRef, updateData);
      await fetchMediciones(); 
      setIsFormModalVisible(false);
      message.success('Medición actualizada');
    } catch (errorInfo) { message.error("Error al actualizar."); }
    finally { setSaving(false); }
  };

  return (
    <>
      <Modal
        title={`Mediciones de: ${monitoreo?.tipoMonitoreo || 'Cargando...'}`}
        open={visible}
        onCancel={onClose}
        footer={[ <Button key="close" onClick={onClose}> Cerrar </Button> ]}
        width="90vw"
        centered
      >
        <Button 
          type="primary" 
          icon={<PlusOutlined />} 
          onClick={handleAdd}
          style={{ marginBottom: 16 }}
        >
          Agregar Medición
        </Button>

        <Spin spinning={loading}>
          <div style={{ overflowX: 'auto' }}>
            <Table
              columns={columns}
              dataSource={mediciones}
              scroll={{ x: 1500 }}
              pagination={{ pageSize: 5 }}
              rowKey="id" 
              size="small"
            />
          </div>
        </Spin>
      </Modal>

      {/* --- MODAL DEL FORMULARIO (MODIFICADO) --- */}
      <Modal
        title={selectedMedicion ? "Editar Medición" : "Agregar Medición"}
        open={isFormModalVisible}
        onOk={handleFormOk}
        confirmLoading={saving}
        onCancel={handleFormCancel}
        destroyOnHidden
        width={600}
        zIndex={1001} 
      >
        <Form form={form} layout="vertical" name="medicionForm" preserve={false}>
          {/* ... (Campos: area, puestoTrabajo, puntoMedicion, descripcion, horarioMedicion, tipoIluminacion) ... */}
          <Form.Item name="area" label="Área" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="puestoTrabajo" label="Puesto de Trabajo" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="puntoMedicion" label="Punto de Medición" rules={[{ required: true }]}>
            <Input placeholder="Ej: P1, Esquina, Oficina Gerente" />
          </Form.Item>
          <Form.Item name="descripcion" label="Descripción (Opcional)">
            <Input.TextArea rows={2} />
          </Form.Item>
          <Form.Item name="horarioMedicion" label="Horario de Medición" rules={[{ required: true }]}>
            <Input placeholder="Ej: 10:30 AM" />
          </Form.Item>
          <Form.Item name="tipoIluminacion" label="Tipo de Iluminación" rules={[{ required: true }]}>
            <Select placeholder="Selecciona un tipo">
              {tiposDeIluminacion.map(tipo => (<Option key={tipo} value={tipo}>{tipo}</Option>))}
            </Select>
          </Form.Item>
          <Form.Item name="nivelRequerido" label="Nivel Requerido (LUX)" rules={[{ required: true }]}>
            <InputNumber min={0} style={{ width: '100%' }} />
          </Form.Item>

          {/* --- CAMPO DE MEDICIONES MODIFICADO --- */}
          <Form.List 
            name="lecturas"
            rules={[{
              validator: async (_, lecturas) => {
                if (!lecturas || lecturas.filter(l => l != null).length === 0) {
                  return Promise.reject(new Error('Agrega al menos una lectura'));
                }
              },
            }]}
          >
            {(fields, { add, remove }, { errors }) => (
              <>
                <Text strong>Lecturas de Medición (LUX)</Text>
                {fields.map(({ key, name, ...restField }) => (
                  <Space key={key} style={{ display: 'flex', marginBottom: 8 }} align="baseline">
                    <Form.Item
                      {...restField}
                      name={name}
                      rules={[{ required: true, message: 'Falta valor' }]}
                    >
                      <InputNumber min={0} placeholder="Ej: 550" style={{ width: '100%' }} />
                    </Form.Item>
                    <MinusCircleOutlined onClick={() => remove(name)} />
                  </Space>
                ))}
                <Form.Item>
                  <Button type="dashed" onClick={() => add()} block icon={<PlusOutlined />}>
                    Añadir Lectura
                  </Button>
                  <Form.ErrorList errors={errors} />
                </Form.Item>
              </>
            )}
          </Form.List>
          {/* --- FIN CAMPO MODIFICADO --- */}


          <Form.Item name="fotografiaUrl" label="URL de Fotografía (Opcional)">
            <Input prefix={<PaperClipOutlined />} placeholder="https://..." />
          </Form.Item>
          <Form.Item name="coordenadas" label="Coordenadas (Opcional)">
            <Input placeholder="Ej: -16.500123, -68.150456" />
          </Form.Item>
          <Form.Item name="observaciones" label="Observaciones (Opcional)">
            <Input.TextArea rows={2} />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
};

export default MedicionesModal;