// src/pages/ProyectosPage.jsx
import React, { useState, useMemo, useEffect } from 'react';
import {
  Table,
  Input,
  Button,
  Modal,
  Form,
  Select,
  Typography,
  Tag,
  Space,
  Tooltip,
  message,
  Spin,
  Progress, // <-- AGREGAR
  Popover,  // <-- AGREGAR
} from 'antd';
import {
  PlusOutlined,
  EyeOutlined,
  EditOutlined,
  DeleteOutlined,
  SearchOutlined,
  LockOutlined,
  LineChartOutlined,
  ExclamationCircleOutlined,
} from '@ant-design/icons';
import { useMediaQuery } from '../hooks/useMediaQuery.js';
import { supabase } from '../supabaseClient.js';
import { Link, useNavigate } from 'react-router-dom';

const { Title, Text, Paragraph } = Typography;
const { Option } = Select;

const ProyectosPage = () => {
  const [proyectos, setProyectos] = useState([]);
  const [monitorCounts, setMonitorCounts] = useState({});
  const [loadingCounts, setLoadingCounts] = useState(false);
const fetchProjectStats = async (projectIds, isBackground = false) => {
    if (!projectIds || projectIds.length === 0) {
      setMonitorCounts({});
      return;
    }
    
    // Si es background, NO activamos el spinner de las celdas
    if (!isBackground) setLoadingCounts(true);
    
    try {
      // 1. Traer todos los monitoreos de estos proyectos
      const { data: allMonitoreos, error: monError } = await supabase
        .from('monitoreos')
        .select('id, proyecto_id, tipo_monitoreo, puntos')
        .in('proyecto_id', projectIds);

      if (monError) throw monError;

      const statsMap = {};
      projectIds.forEach(id => {
        statsMap[id] = { totalPuntos: 0, realizados: 0, countMonitoreos: 0 };
      });

      const measurementPromises = [];

      const getTableName = (tipo) => {
        if (!tipo) return null;
        const t = tipo.toLowerCase();
        if (t === 'iluminacion') return 'iluminacion';
        if (t === 'ventilacion') return 'ventilacion';
        if (t === 'ruido') return 'ruido';
        if (t.includes('particulas')) return 'particulas';
        if (t.includes('gases')) return 'gases';
        if (t.includes('frio')) return 'estres_frio';
        if (t.includes('calor')) return 'estres_calor';
        if (t === 'vibracion') return 'vibracion';
        if (t === 'ergonomia') return 'ergonomia';
        if (t === 'dosimetria') return 'dosimetria';
        return null;
      };

      for (const mon of allMonitoreos) {
        if (statsMap[mon.proyecto_id]) {
            statsMap[mon.proyecto_id].countMonitoreos += 1;
            statsMap[mon.proyecto_id].totalPuntos += (mon.puntos || 0);
        }

        const tableName = getTableName(mon.tipo_monitoreo);
        if (tableName) {
            const promise = supabase
                .from(tableName)
                .select('id', { count: 'exact', head: true })
                .eq('monitoreo_id', mon.id)
                .then(({ count }) => ({
                    proyecto_id: mon.proyecto_id,
                    count: count || 0
                }));
            measurementPromises.push(promise);
        }
      }

      const results = await Promise.all(measurementPromises);

      results.forEach(res => {
          if (statsMap[res.proyecto_id]) {
              statsMap[res.proyecto_id].realizados += res.count;
          }
      });

      setMonitorCounts(statsMap);

    } catch (error) {
      console.error('Error cargando estadísticas:', error);
      if (!isBackground) message.error('Error al cargar estadísticas de avance.');
    } finally {
      if (!isBackground) setLoadingCounts(false);
    }
  };
  const [searchText, setSearchText] = useState('');
  const [pageSize, setPageSize] = useState(10);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [isAddModalVisible, setIsAddModalVisible] = useState(false);
  const [isEditModalVisible, setIsEditModalVisible] = useState(false);
  const [isViewModalVisible, setIsViewModalVisible] = useState(false);
  const [isDeleteModalVisible, setIsDeleteModalVisible] = useState(false);
  const [isPermisosModalVisible, setIsPermisosModalVisible] = useState(false);
  const [isErrorModalVisible, setIsErrorModalVisible] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [selectedProject, setSelectedProject] = useState(null);

  const [form] = Form.useForm();
  const isMobile = useMediaQuery('(max-width: 768px)');
  const PRIMARY_BLUE = '#2a8bb6';
  const navigate = useNavigate(); // 👈 para redirigir

  // ====== cargar conteos de monitoreos por proyecto
  const fetchMonitorCounts = async (projectIds) => {
    if (!projectIds || projectIds.length === 0) {
      setMonitorCounts({});
      return;
    }
    setLoadingCounts(true);
    try {
      const countsPromises = projectIds.map(async (id) => {
        const { count, error } = await supabase
          .from('monitoreos')
          .select('id', { count: 'exact', head: true })
          .eq('proyecto_id', id);
        if (error) {
          console.error(`Error contando monitoreos para proyecto ${id}:`, error);
          return { projectId: id, count: null };
        }
        return { projectId: id, count: count };
      });
      const results = await Promise.all(countsPromises);
      const countsMap = results.reduce((acc, result) => {
        if (result.count !== null) {
          acc[result.projectId] = result.count;
        }
        return acc;
      }, {});
      setMonitorCounts(countsMap);
    } catch (error) {
      console.error('Error general al cargar conteos de monitoreos:', error);
      message.error('No se pudo cargar el número de monitoreos por proyecto.');
      setMonitorCounts({});
    } finally {
      setLoadingCounts(false);
    }
  };

const fetchProyectos = async (isBackground = false) => {
    // Si es background, NO activamos el loading principal (evita parpadeo)
    if (!isBackground) {
        setLoading(true);
    }

    try {
      const { data, error } = await supabase
        .from('proyectos')
        .select('*')
        .order('nombre', { ascending: true });
      if (error) throw error;
      
      setProyectos(data);
      
      const projectIds = data.map((p) => p.id);
      // Pasamos isBackground a la función de estadísticas
      await fetchProjectStats(projectIds, isBackground); 
      
    } catch (error) {
      console.error('Error al cargar proyectos (Supabase): ', error);
      if (!isBackground) message.error('Error al cargar los proyectos: ' + error.message);
    } finally {
      if (!isBackground) setLoading(false);
    }
  };

useEffect(() => {
    // 1. Carga inicial normal
    fetchProyectos(false);

    // 2. Función para recargar silenciosamente
    const handleRealtimeUpdate = () => {
        console.log("⚡ Cambio detectado en el proyecto/mediciones...");
        fetchProyectos(true); // true = background mode
    };

    // Suscripción a cambios en PROYECTOS (ej: nuevo proyecto, cambio de estado)
    const proyectosChannel = supabase
      .channel('proyectos_main_list')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'proyectos' }, handleRealtimeUpdate)
      .subscribe();

    // Suscripción a cambios en MONITOREOS (ej: se agregan puntos a un monitoreo)
    const monitoreosChannel = supabase
      .channel('monitoreos_global_list')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'monitoreos' }, handleRealtimeUpdate)
      .subscribe();

    // Suscripción a cambios en MEDICIONES (ej: entra un registro de gas -> sube el avance)
    const tablasMediciones = [
        'iluminacion', 'ventilacion', 'ruido', 'particulas', 'gases',
        'estres_frio', 'estres_calor', 'vibracion', 'ergonomia', 'dosimetria'
    ];
    const medicionesChannel = supabase.channel('mediciones_global_updates');
    tablasMediciones.forEach(tbl => {
        medicionesChannel.on('postgres_changes', { event: '*', schema: 'public', table: tbl }, handleRealtimeUpdate);
    });
    medicionesChannel.subscribe();

    return () => {
      supabase.removeChannel(proyectosChannel);
      supabase.removeChannel(monitoreosChannel);
      supabase.removeChannel(medicionesChannel);
    };
  }, []);

  // ====== filtrado
  const filteredData = useMemo(() => {
    if (!searchText) return proyectos;
    return proyectos.filter(
      (proyecto) =>
        proyecto.nombre.toLowerCase().includes(searchText.toLowerCase()) ||
        (proyecto.descripcion &&
          proyecto.descripcion.toLowerCase().includes(searchText.toLowerCase()))
    );
  }, [proyectos, searchText]);

  // ====== columnas
const columns = [
    {
      title: 'Nombre del Proyecto',
      dataIndex: 'nombre',
      key: 'nombre',
      sorter: (a, b) => a.nombre.localeCompare(b.nombre),
      width: 200,
      ellipsis: true,
      fixed: isMobile ? 'left' : false,
    },
    {
      title: 'Descripción',
      dataIndex: 'descripcion',
      key: 'descripcion',
      ellipsis: true,
      responsive: ['lg'],
    },
    // --- COLUMNA MODIFICADA: Monitoreos ---
    {
      title: 'Monitoreos',
      key: 'monitorCount',
      dataIndex: 'id',
      width: 110,
      align: 'center',
      sorter: (a, b) => (monitorCounts[a.id]?.countMonitoreos ?? 0) - (monitorCounts[b.id]?.countMonitoreos ?? 0),
      render: (projectId) => {
        const count = monitorCounts[projectId]?.countMonitoreos ?? 0;
        return loadingCounts ? (
          <Spin size="small" />
        ) : (
          <Tag icon={<LineChartOutlined />} color={count > 0 ? 'blue' : 'default'}>
            {count}
          </Tag>
        );
      },
      responsive: ['md'],
    },
    // --- NUEVA COLUMNA: Puntos (Realizados / Total) ---
    {
        title: 'Puntos (Total)',
        key: 'puntos_avance',
        dataIndex: 'id',
        width: 140,
        align: 'center',
        render: (projectId) => {
            if (loadingCounts) return <Spin size="small" />;
            
            const stats = monitorCounts[projectId] || { totalPuntos: 0, realizados: 0 };
            const { totalPuntos, realizados } = stats;
            const faltantes = totalPuntos - realizados;

            const content = (
                <div>
                  <Tag color="green">Realizados: {realizados}</Tag>
                  <Tag color="red">Faltantes: {faltantes < 0 ? 0 : faltantes}</Tag>
                </div>
            );

            return (
                <Popover content={content} title="Progreso General">
                    <span style={{ cursor: 'pointer', fontWeight: '500' }}>
                        {realizados} / {totalPuntos}
                    </span>
                </Popover>
            );
        },
        responsive: ['lg'],
    },
    // --- NUEVA COLUMNA: Porcentaje de Avance ---
    {
        title: 'Avance General',
        key: 'porcentaje_general',
        dataIndex: 'id',
        width: 160,
        render: (projectId) => {
            if (loadingCounts) return <Spin size="small" />;
            
            const stats = monitorCounts[projectId] || { totalPuntos: 0, realizados: 0 };
            const { totalPuntos, realizados } = stats;
            
            const percent = (totalPuntos && totalPuntos > 0) 
                ? Math.round((realizados / totalPuntos) * 100) 
                : 0;
            
            // Capar al 100% si se pasan
            const displayPercent = percent > 100 ? 100 : percent;

            return (
                <Progress 
                    percent={displayPercent} 
                    size="small" 
                    status={displayPercent === 100 ? "success" : "active"}
                />
            );
        }
    },

    {
      title: 'Estado',
      dataIndex: 'estado',
      key: 'estado',
      width: 120,
      sorter: (a, b) => (a.estado || '').localeCompare(b.estado || ''),
      render: (estado) => {
        let color;
        switch (estado) {
          case 'activo':
            color = 'processing';
            break;
          case 'pausado':
            color = 'warning';
            break;
          case 'completado':
            color = 'success';
            break;
          case 'planificado':
            color = 'default';
            break;
          default:
            color = 'default';
        }
        const estadoCapitalizado = estado
          ? estado.charAt(0).toUpperCase() + estado.slice(1)
          : 'Desconocido';
        return <Tag color={color}>{estadoCapitalizado}</Tag>;
      },
      responsive: ['sm'],
    },

    {
      title: 'Acciones',
      key: 'acciones',
      align: 'right',
      fixed: isMobile ? 'right' : false,
      width: 170,
      render: (_, record) => (
        <Space size="small">
          <Tooltip title="Ver Detalles">
            <Button
              type="primary"
              shape="circle"
              icon={<EyeOutlined />}
              onClick={() => handleView(record)}
            />
          </Tooltip>
          <Tooltip title="Editar">
            <Button
              type="default"
              shape="circle"
              icon={<EditOutlined />}
              onClick={() => handleEdit(record)}
            />
          </Tooltip>
          {/* 👇 ESTE era el que no te redirigía */}
          <Tooltip title="Permisos / Monitoreos">
            <Button
              shape="circle"
              icon={<LockOutlined />}
              onClick={() => handlePermisos(record)}
              style={{ color: '#faad14', borderColor: '#faad14' }}
            />
          </Tooltip>
          <Tooltip title="Eliminar">
            <Button
              danger
              shape="circle"
              icon={<DeleteOutlined />}
              onClick={() => handleDelete(record)}
              loading={saving && selectedProject?.id === record.id}
            />
          </Tooltip>
          {/* Este ya redirige bien */}
          <Tooltip title="Ver monitoreos del proyecto">
            <Link to={`/proyectos/${record.id}/monitoreo`}>
              <Button shape="circle" icon={<LineChartOutlined />} />
            </Link>
          </Tooltip>
        </Space>
      ),
    },
  ];

  // ====== manejadores
  const handleView = (proyecto) => {
    setSelectedProject(proyecto);
    setIsViewModalVisible(true);
  };

  const handleEdit = (proyecto) => {
    setSelectedProject(proyecto);
    setIsEditModalVisible(true);
  };

  // 👇 AQUÍ EL CAMBIO: ahora el candado te lleva a MonitoreosPage
  const handlePermisos = (proyecto) => {
    if (!proyecto || !proyecto.id) return;
    navigate(`/proyectos/${proyecto.id}/monitoreo`);
    // si más adelante quieres volver al modal, solo cambias esta línea por:
    // setSelectedProject(proyecto);
    // setIsPermisosModalVisible(true);
  };

  const handleDelete = async (proyecto) => {
    if (!proyecto || !proyecto.id) return;
    setSelectedProject(proyecto);
    setSaving(true);
    try {
      const { count, error: countError } = await supabase
        .from('monitoreos')
        .select('id', { count: 'exact', head: true })
        .eq('proyecto_id', proyecto.id);
      if (countError) throw countError;
      if (count > 0) {
        setErrorMessage(
          `No se puede eliminar "${proyecto.nombre}". Tiene ${count} monitoreo(s) asociado(s). Por favor, elimine primero los monitoreos.`
        );
        setIsErrorModalVisible(true);
      } else {
        setIsDeleteModalVisible(true);
      }
    } catch (error) {
      message.error('Error al verificar monitoreos: ' + error.message);
      console.error('Error en handleDelete: ', error);
    } finally {
      setSaving(false);
    }
  };

  const handleAdd = () => {
    setSelectedProject(null);
    setIsAddModalVisible(true);
  };

  const handleAddOk = async () => {
    setSaving(true);
    try {
      const values = await form.validateFields();
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();
      if (userError || !user)
        throw new Error(userError?.message || 'No se pudo obtener el usuario actual.');

      const newProjectData = {
        nombre: values.nombre,
        descripcion: values.descripcion || null,
        estado: values.estado,
        user_id: user.id,
      };

      const { error } = await supabase.from('proyectos').insert(newProjectData);
      if (error) throw error;
      await fetchProyectos();
      setIsAddModalVisible(false);
      message.success('Proyecto agregado exitosamente');
    } catch (errorInfo) {
      if (errorInfo.errorFields) {
        message.error('Por favor, revisa los campos requeridos.');
        console.error('Error de validación:', errorInfo);
      } else {
        console.error('Error al agregar proyecto (Supabase): ', errorInfo);
        message.error('Error al guardar el proyecto: ' + errorInfo.message);
      }
    } finally {
      setSaving(false);
    }
  };

  const handleEditOk = async () => {
    setSaving(true);
    try {
      const values = await form.validateFields();
      const updateData = { ...values };

      const { error } = await supabase
        .from('proyectos')
        .update(updateData)
        .eq('id', selectedProject.id);
      if (error) throw error;
      await fetchProyectos();
      setIsEditModalVisible(false);
      message.success('Proyecto actualizado exitosamente');
    } catch (errorInfo) {
      console.error('Error al actualizar proyecto (Supabase): ', errorInfo);
      message.error('Error al actualizar el proyecto: ' + errorInfo.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteOk = async () => {
    if (!selectedProject) return;
    setSaving(true);
    try {
      const { error: deleteError } = await supabase
        .from('proyectos')
        .delete()
        .eq('id', selectedProject.id);
      if (deleteError) throw deleteError;
      await fetchProyectos();
      setIsDeleteModalVisible(false);
      message.success('Proyecto eliminado exitosamente');
    } catch (error) {
      console.error('Error al eliminar proyecto: ', error);
      message.error('Error al eliminar el proyecto: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  const handlePermisosOk = () => {
    message.info('Funcionalidad de permisos aún no implementada.');
    setIsPermisosModalVisible(false);
  };

  return (
    <>
      <Title level={2} style={{ color: PRIMARY_BLUE, fontWeight: 'bold' }}>
        🏗️ Gestión de Proyectos
      </Title>
      <Text type="secondary">Listado y administración de los proyectos del sistema.</Text>

      {/* Controles */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          margin: '24px 0',
          flexWrap: 'wrap',
          gap: '16px',
        }}
      >
        <Input
          prefix={<SearchOutlined />}
          placeholder="Buscar por Nombre o Descripción..."
          onChange={(e) => setSearchText(e.target.value)}
          style={{ minWidth: '250px', flex: 1 }}
        />
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Text>Mostrar:</Text>
          <Select value={pageSize} onChange={(value) => setPageSize(value)} style={{ width: 80 }}>
            <Option value={10}>10</Option>
            <Option value={20}>20</Option>
            <Option value={30}>30</Option>
            <Option value={40}>40</Option>
            <Option value={100}>100</Option>
          </Select>
        </div>
        <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>
          Agregar Nuevo Proyecto
        </Button>
      </div>

      {/* Tabla o Spin */}
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

      {/* Modales */}
      <Modal
        title="Agregar Nuevo Proyecto"
        open={isAddModalVisible}
        onOk={handleAddOk}
        confirmLoading={saving}
        onCancel={() => setIsAddModalVisible(false)}
        destroyOnHidden
      >
        <Form
          key="add-project"
          form={form}
          layout="vertical"
          name="addProjectForm"
          initialValues={{ estado: 'planificado' }}
          preserve={false}
        >
          <Form.Item
            name="nombre"
            label="Nombre del Proyecto"
            rules={[{ required: true, message: 'El nombre es obligatorio' }]}
          >
            <Input />
          </Form.Item>
          <Form.Item name="descripcion" label="Descripción">
            <Input.TextArea rows={3} />
          </Form.Item>
          <Form.Item
            name="estado"
            label="Estado"
            rules={[{ required: true, message: 'Selecciona un estado' }]}
          >
            <Select>
              <Option value="planificado">Planificado</Option>
              <Option value="activo">Activo</Option>
              <Option value="pausado">Pausado</Option>
              <Option value="completado">Completado</Option>
            </Select>
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="Editar Proyecto"
        open={isEditModalVisible}
        onOk={handleEditOk}
        confirmLoading={saving}
        onCancel={() => setIsEditModalVisible(false)}
        destroyOnHidden
      >
        <Form
          key={selectedProject ? `edit-${selectedProject.id}` : 'edit-form'}
          form={form}
          layout="vertical"
          name="editProjectForm"
          initialValues={selectedProject || {}}
          preserve={false}
        >
          <Form.Item
            name="nombre"
            label="Nombre del Proyecto"
            rules={[{ required: true, message: 'El nombre es obligatorio' }]}
          >
            <Input />
          </Form.Item>
          <Form.Item name="descripcion" label="Descripción">
            <Input.TextArea rows={3} />
          </Form.Item>
          <Form.Item
            name="estado"
            label="Estado"
            rules={[{ required: true, message: 'Selecciona un estado' }]}
          >
            <Select>
              <Option value="planificado">Planificado</Option>
              <Option value="activo">Activo</Option>
              <Option value="pausado">Pausado</Option>
              <Option value="completado">Completado</Option>
            </Select>
          </Form.Item>
        </Form>
      </Modal>

      {/* este modal queda por si lo usas después */}
      <Modal
        title={`Permisos para "${selectedProject?.nombre}"`}
        open={isPermisosModalVisible}
        onOk={handlePermisosOk}
        onCancel={() => setIsPermisosModalVisible(false)}
      >
        <p>Aquí se configurarán los permisos.</p>
      </Modal>

      <Modal
        title="Detalles del Proyecto"
        open={isViewModalVisible}
        onOk={() => setIsViewModalVisible(false)}
        onCancel={() => setIsViewModalVisible(false)}
        footer={[
          <Button key="ok" type="primary" onClick={() => setIsViewModalVisible(false)}>
            Cerrar
          </Button>,
        ]}
      >
        {selectedProject && (
          <div>
            <p>
              <strong>Nombre:</strong> {selectedProject.nombre}
            </p>
            <p>
              <strong>Descripción:</strong> {selectedProject.descripcion || 'N/A'}
            </p>
            <p>
              <strong>Estado:</strong>{' '}
              {selectedProject.estado
                ? selectedProject.estado.charAt(0).toUpperCase() +
                  selectedProject.estado.slice(1)
                : 'N/A'}
            </p>
            <p>
              <strong>Creado:</strong>{' '}
              {selectedProject.created_at
                ? new Date(selectedProject.created_at).toLocaleString()
                : 'N/A'}
            </p>
          </div>
        )}
      </Modal>

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
        <p>¿Estás seguro de que deseas eliminar "{selectedProject?.nombre}"?</p>
      </Modal>

      <Modal
        title={
          <span>
            <ExclamationCircleOutlined style={{ color: '#faad14', marginRight: 8 }} /> No se puede
            eliminar
          </span>
        }
        open={isErrorModalVisible}
        onOk={() => setIsErrorModalVisible(false)}
        onCancel={() => setIsErrorModalVisible(false)}
        footer={[
          <Button key="ok" type="primary" onClick={() => setIsErrorModalVisible(false)}>
            Entendido
          </Button>,
        ]}
      >
        <Paragraph>{errorMessage}</Paragraph>
      </Modal>
    </>
  );
};

export default ProyectosPage;
