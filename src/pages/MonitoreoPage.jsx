// src/pages/MonitoreosPage.jsx
import React, { useState, useMemo, useEffect } from 'react';
import {
  Table, Input, Button, Modal, Form,
  Select, Typography, Tag, Space, Tooltip, message, Spin,
  Progress, InputNumber, Slider, Popover,
  DatePicker, Radio, Checkbox, Card, Divider,
  Row, Col
} from 'antd';
import {
  PlusOutlined, EyeOutlined, EditOutlined,
  DeleteOutlined, SearchOutlined,
  DatabaseOutlined,
  DeleteTwoTone,
  FilePdfOutlined, // <-- NUEVO ICONO
  CalendarOutlined
} from '@ant-design/icons';
import { useParams, useNavigate } from 'react-router-dom';
import { useMediaQuery } from '../hooks/useMediaQuery.js';
import { supabase } from '../supabaseClient.js';
import { PDFViewer } from '@react-pdf/renderer'; // <-- IMPORTANTE
import { ReporteGeneralPDF } from '../components/ReporteGeneralPDF'; // <-- IMPORTANTE

const { RangePicker } = DatePicker;
const { Title, Text } = Typography;
const { Option } = Select;

const tiposDeMonitoreo = [
  "Iluminacion",
  "Ventilacion",
  "Ruido",
  "Particulas suspendidas",
  "Estres termico por calor",
  "Estres termico por frio",
  "Gases contaminantes",
  "Ergonomia",
  "Vibracion",
  "Dosimetria"
];

const defaultAddValues = {
  tipoMonitoreo: 'Seleccione',
  puntos: 1,
  usuariosAsignados: [],
  equiposAsignados: []
};

const MonitoreosPage = () => {
  const { projectId } = useParams();
  const navigate = useNavigate();

  const [monitoreos, setMonitoreos] = useState([]);
  const [medicionCounts, setMedicionCounts] = useState({});
  const [loadingMediciones, setLoadingMediciones] = useState(false);
  const [usuariosList, setUsuariosList] = useState([]);
  const [equiposList, setEquiposList] = useState([]);
  const [searchText, setSearchText] = useState('');
  const [pageSize, setPageSize] = useState(10);
  const [currentPage, setCurrentPage] = useState(1); // <-- NUEVO
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [isViewModalVisible, setIsViewModalVisible] = useState(false);
  const [isDeleteModalVisible, setIsDeleteModalVisible] = useState(false);
  const [selectedMonitoreo, setSelectedMonitoreo] = useState(null);
  const [isReportModalVisible, setIsReportModalVisible] = useState(false);
  const [reportLoading, setReportLoading] = useState(false);
  const [reportForm] = Form.useForm();
  const [isPdfModalVisible, setIsPdfModalVisible] = useState(false); // Modal del visor
  const [pdfReportData, setPdfReportData] = useState([]); // Datos para el reporte
  const [form] = Form.useForm();
  const isMobile = useMediaQuery('(max-width: 768px)');
  const PRIMARY_BLUE = '#2a8bb6';

  const getTableNameFromTipo = (tipo) => {
    if (!tipo) return null;
    const tipoLower = tipo.toLowerCase();
    if (tipoLower === 'iluminacion') return 'iluminacion';
    if (tipoLower === 'ventilacion') return 'ventilacion';
    if (tipoLower === 'particulas suspendidas') return 'particulas';
    if (tipoLower === 'ruido') return 'ruido';
    if (tipoLower === 'gases contaminantes') return 'gases';
    if (tipoLower === 'estres termico por frio') return 'estres_frio';
    if (tipoLower === 'estres termico por calor') return 'estres_calor';
    if (tipoLower === 'vibracion') return 'vibracion';
    if (tipoLower === 'ergonomia') return 'ergonomia';
    if (tipoLower === 'dosimetria') return 'dosimetria';
    return null;
  };

  const fetchMedicionCounts = async (monitoreosList, isBackground = false) => {
    if (!monitoreosList || monitoreosList.length === 0) return;
    
    // Solo mostramos loading si NO es background
    if (!isBackground) setLoadingMediciones(true);

    try {
      const countsPromises = monitoreosList.map(async (mon) => {
        const tableName = getTableNameFromTipo(mon.tipo_monitoreo);
        if (!tableName) return { monitoreoId: mon.id, count: 0 };
        const { count, error } = await supabase
          .from(tableName)
          .select('id', { count: 'exact', head: true })
          .eq('monitoreo_id', mon.id);
        if (error) {
          console.error(`Error contando mediciones para ${mon.id} en ${tableName}:`, error);
          return { monitoreoId: mon.id, count: 0 };
        }
        return { monitoreoId: mon.id, count };
      });
      const results = await Promise.all(countsPromises);
      const countsMap = results.reduce((acc, r) => { acc[r.monitoreoId] = r.count; return acc; }, {});
      setMedicionCounts(countsMap);
    } catch (error) {
      console.error("Error general al cargar conteos:", error);
      message.error("Error al cargar los conteos de mediciones.");
    } finally {
      // Solo apagamos loading si lo encendimos
      if (!isBackground) setLoadingMediciones(false);
    }
  };

  // ====== Cargar datos
const fetchMonitoreos = async (isBackground = false) => {
    if (!projectId) return;
    
    // Si es background, NO activamos el loading general (evita parpadeo de tabla)
    if (!isBackground) setLoading(true);

    try {
      const { data, error } = await supabase
        .from('monitoreos')
        .select('*')
        .eq('proyecto_id', projectId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      setMonitoreos(data);
      // Pasamos isBackground para que los contadores se actualicen silenciosamente
      await fetchMedicionCounts(data, isBackground);
    } catch (error) {
      console.error("Error loading monitoreos: ", error);
      message.error("Error al cargar monitoreos: " + error.message);
    } finally {
      if (!isBackground) setLoading(false);
    }
  };

  const fetchUsuarios = async () => {
    try {
      const { data, error } = await supabase.from('profiles').select('id, nombre_completo, username');
      if (error) throw error;
      setUsuariosList(data);
    } catch (error) {
      console.error("Error loading users for select: ", error);
    }
  };

  // ⬇️ Trae también el *modelo* del equipo
  const fetchEquipos = async () => {
    try {
      const { data, error } = await supabase
        .from('equipos')
        .select('id, nombre_equipo, modelo, serie');
      if (error) throw error;
      setEquiposList(data);
    } catch (error) {
      console.error("Error loading equipos for select: ", error);
      message.error("No se pudo cargar la lista de equipos.");
    }
  };

  useEffect(() => {
    fetchUsuarios();
    fetchEquipos();
  }, []);

useEffect(() => {
    if (!projectId) return;

    // Carga inicial normal (con loading)
    fetchMonitoreos(false);

    // Función para manejar actualizaciones en tiempo real
    const handleRealtimeUpdate = () => {
      console.log("⚡ Cambio detectado: Actualizando contadores...");
      // Llamamos con true para que sea silencioso
      fetchMonitoreos(true);
    };

    // 1. Suscripción a cambios en la configuración de monitoreos
    const monitoreosChannel = supabase
      .channel(`monitoreos_changes_${projectId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'monitoreos', filter: `proyecto_id=eq.${projectId}` },
        handleRealtimeUpdate
      )
      .subscribe();

    // 2. Suscripción a cambios en las tablas de MEDICIONES
    const tablasMediciones = [
      'iluminacion', 'ventilacion', 'ruido', 'particulas', 'gases',
      'estres_frio', 'estres_calor', 'vibracion', 'ergonomia', 'dosimetria'
    ];

    const medicionesChannel = supabase.channel(`mediciones_updates_${projectId}`);

    tablasMediciones.forEach(tbl => {
      medicionesChannel.on(
        'postgres_changes',
        { event: '*', schema: 'public', table: tbl }, 
        handleRealtimeUpdate // <--- Usamos la función optimizada
      );
    });
    
    medicionesChannel.subscribe();

    // Limpieza al desmontar
    return () => {
      supabase.removeChannel(monitoreosChannel);
      supabase.removeChannel(medicionesChannel);
    };
    
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  const filteredData = useMemo(() => {
    if (!searchText) return monitoreos;
    const lower = searchText.toLowerCase();
    return monitoreos.filter(item =>
      (item.tipo_monitoreo && item.tipo_monitoreo.toLowerCase().includes(lower)) ||
      (item.descripcion && item.descripcion.toLowerCase().includes(lower))
    );
  }, [monitoreos, searchText]);

  const handleView = (mon) => { setSelectedMonitoreo(mon); setIsViewModalVisible(true); };

  const handleOpenMediciones = (mon) => {
    if (!mon || !mon.id) return;
    const tipo = (mon.tipo_monitoreo || '').toLowerCase();
    const rutaMap = {
      'iluminacion': 'iluminacion',
      'ventilacion': 'ventilacion',
      'ruido': 'ruido',
      'particulas suspendidas': 'particulas',
      'gases contaminantes': 'gases',
      'estres termico por frio': 'estres-frio',
      'estres termico por calor': 'estres-calor',
      'vibracion': 'vibracion',
      'ergonomia': 'ergonomia',
      'dosimetria': 'dosimetria'
    };
    const rutaDestino = rutaMap[tipo];
    if (rutaDestino) navigate(`/proyectos/${projectId}/monitoreo/${mon.id}/${rutaDestino}`);
    else message.info(`No hay una página específica para "${mon.tipo_monitoreo}".`);
  };

  const handleEdit = (mon) => { setSelectedMonitoreo(mon); setIsModalVisible(true); };

  const handleDelete = async (mon) => {
    setSelectedMonitoreo(mon);
    const realizados = medicionCounts[mon.id] ?? 0;
    if (realizados > 0) {
      message.error(`No se puede eliminar: Este monitoreo ya tiene ${realizados} mediciones registradas.`);
      setSelectedMonitoreo(null);
    } else {
      setIsDeleteModalVisible(true);
    }
  };

  const handleAdd = () => { setSelectedMonitoreo(null); setIsModalVisible(true); };
  const handleOk = () => { selectedMonitoreo ? handleEditOk() : handleAddOk(); };

  const handleAddOk = async () => {
    setSaving(true);
    try {
      const values = await form.validateFields();
      const newMonitoreoData = {
        proyecto_id: projectId,
        tipo_monitoreo: values.tipoMonitoreo,
        descripcion: values.descripcion,
        usuarios_asignados: values.usuariosAsignados || [],
        equipos_asignados: values.equiposAsignados || [],
        puntos: values.puntos,
      };
      const { error } = await supabase.from('monitoreos').insert(newMonitoreoData);
      if (error) throw error;
      setIsModalVisible(false);
      message.success('Monitoreo agregado exitosamente');
      await fetchMonitoreos(); // ⬅️ MODIFICADO: refrescar inmediatamente para ver “0 / total” al instante
    } catch (errorInfo) {
      if (errorInfo.errorFields) {
        message.error('Por favor, revisa los campos requeridos.');
        console.error('Error de validación:', errorInfo);
      } else {
        console.error("Error Supabase (Add): ", errorInfo);
        message.error("Error al guardar monitoreo: " + errorInfo.message);
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
        tipo_monitoreo: values.tipoMonitoreo,
        descripcion: values.descripcion,
        usuarios_asignados: values.usuariosAsignados || [],
        equipos_asignados: values.equiposAsignados || [],
        puntos: values.puntos,
      };
      const { error } = await supabase
        .from('monitoreos')
        .update(updateData)
        .eq('id', selectedMonitoreo.id);
      if (error) throw error;
      setIsModalVisible(false);
      message.success('Monitoreo actualizado exitosamente');
      await fetchMonitoreos(); // ⬅️ MODIFICADO: refrescar inmediatamente para recalcular “realizados/total”
    } catch (errorInfo) {
      if (errorInfo.errorFields) {
        message.error('Por favor, revisa los campos requeridos.');
        console.error('Error de validación:', errorInfo);
      } else {
        console.error("Error Supabase (Edit): ", errorInfo);
        message.error("Error al actualizar monitoreo: " + errorInfo.message);
      }
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteOk = async () => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from('monitoreos')
        .delete()
        .eq('id', selectedMonitoreo.id);
      if (error) throw error;
      setIsDeleteModalVisible(false);
      message.success('Monitoreo eliminado exitosamente');
      await fetchMonitoreos(); // ⬅️ MODIFICADO: refrescar listado tras eliminar
    } catch (error) {
      console.error("Error al eliminar monitoreo: ", error);
      message.error("Error al eliminar monitoreo: " + error.message);
    } finally {
      setSaving(false);
    }
  };

  // Función para generar la data del reporte
  const handleGenerateReport = async () => {
    try {
      const values = await reportForm.validateFields();
      setReportLoading(true);

      // 1. Definir qué monitoreos vamos a procesar
      let monitoreosAProcesar = [];
      if (values.alcance === 'todos') {
        monitoreosAProcesar = monitoreos; // Todos los de la tabla actual
      } else {
        // Solo los IDs seleccionados
        monitoreosAProcesar = monitoreos.filter(m => values.seleccionados.includes(m.id));
      }

      if (monitoreosAProcesar.length === 0) {
        message.warning("No hay monitoreos seleccionados para el reporte.");
        setReportLoading(false);
        return;
      }

      // 2. Recopilar data de cada monitoreo
      const reporteFinal = [];

      for (const mon of monitoreosAProcesar) {
        const tableName = getTableNameFromTipo(mon.tipo_monitoreo);
        
        if (tableName) {
          // Construir query base
          let query = supabase
            .from(tableName)
            .select('*') // Traemos todos los campos (puedes especificar columnas si prefieres)
            .eq('monitoreo_id', mon.id);

          // 3. Aplicar filtro de fechas si existe
          if (values.fechas && values.fechas.length === 2) {
            const start = values.fechas[0].startOf('day').toISOString();
            const end = values.fechas[1].endOf('day').toISOString();
            // Asumiendo que tus tablas tienen 'measured_at' o 'created_at'
            // Ajusta el nombre de la columna de fecha según tus tablas
            query = query.gte('measured_at', start).lte('measured_at', end); 
          }

          const { data: mediciones, error } = await query;

          if (error) {
            console.error(`Error al traer datos de ${tableName}`, error);
          } else {
            // Solo agregamos al reporte si tiene mediciones (o si quieres mostrar vacíos, quita el if)
            if (mediciones && mediciones.length > 0) {
              reporteFinal.push({
                titulo: mon.tipo_monitoreo,
                descripcion: mon.descripcion,
                puntosTotales: mon.puntos,
                datos: mediciones,
                config: {
                  incluirFotos: values.incluirFotos,
                  incluirEstadisticas: values.incluirEstadisticas,
                  incluirObservaciones: values.incluirObservaciones
                }
              });
            }
          }
        }
      }

      console.log("DATA PARA REPORTE:", reporteFinal);
      
      if (reporteFinal.length === 0) {
        message.info("No se encontraron mediciones en el rango de fechas seleccionado.");
      } else {
        message.success(`Reporte generado con ${reporteFinal.length} tipos de monitoreos.`);
        
        // --- CAMBIO AQUÍ: Guardamos la data y abrimos el modal del PDF ---
        setPdfReportData(reporteFinal);
        setIsPdfModalVisible(true); // Abrimos el modal del visor
        setIsReportModalVisible(false); // Cerramos el modal de configuración
      }

      setIsReportModalVisible(false);

    } catch (error) {
      console.error("Error generando reporte:", error);
      message.error("Error al generar el reporte.");
    } finally {
      setReportLoading(false);
    }
  };

  const columns = [
  {
  title: 'N°',
  key: 'n',
  width: 70,
  fixed: isMobile ? 'left' : true,
  render: (_text, _record, index) => (currentPage - 1) * pageSize + index + 1 // <-- USA currentPage
},

    
    {
      title: 'Tipo de Monitoreo',
      dataIndex: 'tipo_monitoreo',
      key: 'tipo_monitoreo',
      sorter: (a, b) => a.tipo_monitoreo.localeCompare(b.tipo_monitoreo),
      fixed: isMobile ? 'left' : false,
      width: 180
    },
    {
      title: 'Descripción',
      dataIndex: 'descripcion',
      key: 'descripcion',
      ellipsis: true,
      responsive: ['md']
    },
    {
      title: 'Usuarios Asignados',
      dataIndex: 'usuarios_asignados',
      key: 'usuarios_asignados',
      responsive: ['lg'],
      render: (userIds) => (
        <Space size={[0, 8]} wrap>
          {(userIds || []).map(userId => {
            const user = usuariosList.find(u => u.id === userId);
            return (
              <Tag color="blue" key={userId}>
                {user ? (user.nombre_completo || user.username) : 'ID Desconocido'}
              </Tag>
            );
          })}
        </Space>
      )
    },
    {
      title: 'Equipos Asignados',
      dataIndex: 'equipos_asignados',
      key: 'equipos_asignados',
      responsive: ['lg'],
      render: (equipoIds) => (
        <Space size={[0, 8]} wrap>
          {(equipoIds || []).map(equipoId => {
            const eq = equiposList.find(e => e.id === equipoId);
            return (
              <Tag color="cyan" key={equipoId}>
                {/* ⬇️ ahora muestra el MODELO */}
                {eq ? `${eq.nombre_equipo} (${eq.modelo || 's/n'})` : 'ID Desconocido'}
              </Tag>
            );
          })}
        </Space>
      )
    },
    {
      title: 'Puntos (Realizados / Total)',
      dataIndex: 'puntos',
      key: 'puntos_dinamicos',
      sorter: (a, b) => a.puntos - b.puntos,
      width: 150,
      responsive: ['lg'],
      render: (totalPuntos, record) => {
        const realizados = medicionCounts[record.id] ?? 0;
        const faltantes = totalPuntos - realizados;
        const content = (
          <div>
            <Tag color="green">Realizados: {realizados}</Tag>
            <Tag color="red">Faltantes: {faltantes < 0 ? 0 : faltantes}</Tag>
          </div>
        );
        return (
          <Popover content={content} title="Detalle de Puntos">
            <span style={{ cursor: 'pointer' }}>
              {loadingMediciones ? <Spin size="small" /> : `${realizados} / ${totalPuntos}`}
            </span>
          </Popover>
        );
      }
    },
    {
      title: 'Porcentaje de Avance',
      key: 'porcentaje_dinamico',
      dataIndex: 'id',
      width: 150,
      render: (id, record) => {
        if (loadingMediciones) return <Spin size="small" />;
        const totalPuntos = record.puntos;
        const realizados = medicionCounts[id] ?? 0;
        const percent = (totalPuntos && totalPuntos > 0) ? Math.round((realizados / totalPuntos) * 100) : 0;
        const displayPercent = percent > 100 ? 100 : percent;
        return <Progress percent={displayPercent} />;
      }
    },
    {
      title: 'Acciones',
      key: 'acciones',
      align: 'right',
      fixed: 'right', // ⬅️ ahora SIEMPRE fija/“inmóvil” a la derecha
      width: isMobile ? 120 : 180,
      render: (_, record) => (
        <Space size="small">
          <Tooltip title="Ver Detalles">
            <Button type="primary" shape="circle" icon={<EyeOutlined />} onClick={() => handleView(record)} />
          </Tooltip>
          <Tooltip title={`Gestionar mediciones de ${record.tipo_monitoreo}`}>
            <Button type="default" shape="circle" icon={<DatabaseOutlined />} onClick={() => handleOpenMediciones(record)} />
          </Tooltip>
          <Tooltip title="Editar">
            <Button type="default" shape="circle" icon={<EditOutlined />} onClick={() => handleEdit(record)} />
          </Tooltip>
          <Tooltip title="Eliminar">
            <Button danger shape="circle" icon={<DeleteTwoTone twoToneColor="#ff4d4f" />} onClick={() => handleDelete(record)} />
          </Tooltip>
        </Space>
      )
    },
  ];

  return (
    <>
      <Title level={2} style={{ color: PRIMARY_BLUE, fontWeight: 'bold' }}>
        📈 Gestión de Monitoreos
      </Title>
      <Text type="secondary">
        Listado de monitoreos de higiene y seguridad para el proyecto.
      </Text>

      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          margin: '24px 0',
          flexWrap: 'wrap',
          gap: '16px'
        }}
      >
        <Input
          prefix={<SearchOutlined />}
          placeholder="Buscar por Tipo o Descripción..."
          onChange={e => setSearchText(e.target.value)}
          style={{ minWidth: '250px', flex: 1 }}
        />
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Text>Mostrar:</Text>
          <Select value={pageSize} onChange={(value) => setPageSize(value)} style={{ width: 80 }}>
            <Option value={10}>10</Option>
            <Option value={20}>20</Option>
            <Option value={30}>30</Option>
          </Select>
        </div>
        {/* BOTÓN DE REPORTE */}
        <Button 
          icon={<FilePdfOutlined />} 
          onClick={() => {
            reportForm.resetFields();
            setIsReportModalVisible(true);
          }}
          style={{ backgroundColor: '#ff4d4f', color: 'white', borderColor: '#ff4d4f' }}
        >
          Generar Reporte
        </Button>
        <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>
          Agregar Nuevo Monitoreo
        </Button>
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
            pagination={{ 
              pageSize: pageSize,
              current: currentPage,           // <-- NUEVO
              onChange: (page) => setCurrentPage(page) // <-- NUEVO 
            }}
            rowKey="id"
          />
        </div>
      )}

      <Modal
        title={selectedMonitoreo ? "Editar Monitoreo" : "Agregar Nuevo Monitoreo"}
        open={isModalVisible}
        onOk={handleOk}
        confirmLoading={saving}
        onCancel={() => { setIsModalVisible(false); setSelectedMonitoreo(null); }}
        destroyOnHidden
      >
        <Form
          key={selectedMonitoreo ? `edit-${selectedMonitoreo.id}` : 'add-monitoreo'}
          form={form}
          layout="vertical"
          name="monitoreoForm"
          initialValues={
            selectedMonitoreo ? {
              tipoMonitoreo: selectedMonitoreo.tipo_monitoreo,
              descripcion: selectedMonitoreo.descripcion,
              usuariosAsignados: selectedMonitoreo.usuarios_asignados || [],
              equiposAsignados: selectedMonitoreo.equipos_asignados || [],
              puntos: selectedMonitoreo.puntos,
            } : defaultAddValues
          }
          preserve={false}
        >
          <Form.Item
            name="tipoMonitoreo"
            label="Tipo de Monitoreo"
            rules={[{ required: true, message: 'Selecciona un tipo de monitoreo' }]}
          >
            <Select placeholder="Selecciona un tipo">
              {tiposDeMonitoreo.map(tipo => (
                <Option key={tipo} value={tipo}>{tipo}</Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item name="descripcion" label="Descripción (Opcional)">
            <Input.TextArea rows={2} />
          </Form.Item>

          <Form.Item
            name="usuariosAsignados"
            label="Usuarios Asignados"
            rules={[{ required: true, message: 'Asigna al menos un usuario' }]}
          >
            <Select
              mode="multiple"
              allowClear
              placeholder="Selecciona uno o más usuarios"
              loading={usuariosList.length === 0}
            >
              {usuariosList.map(user => (
                <Option key={user.id} value={user.id}>
                  {user.nombre_completo || user.username}
                </Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item name="equiposAsignados" label="Equipos Asignados">
            <Select
              mode="multiple"
              allowClear
              placeholder="Selecciona uno o más equipos"
              loading={equiposList.length === 0}
            >
              {equiposList.map(equipo => (
                <Option key={equipo.id} value={equipo.id}>
                  {/* ⬇️ etiqueta del selector usa MODELO */}
                  {equipo.nombre_equipo} ({equipo.modelo || 's/n'})
                </Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item
            name="puntos"
            label="Nro. Total de Puntos de Muestreo"
            rules={[{ required: true, message: 'Define un número de puntos' }]}
          >
            <InputNumber min={1} style={{ width: '100%' }} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="Detalles del Monitoreo"
        open={isViewModalVisible}
        onOk={() => setIsViewModalVisible(false)}
        onCancel={() => setIsViewModalVisible(false)}
        footer={[
          <Button key="ok" type="primary" onClick={() => setIsViewModalVisible(false)}>
            Cerrar
          </Button>
        ]}
      >
        {selectedMonitoreo && (
          <div>
            <p><strong>Tipo:</strong> {selectedMonitoreo.tipo_monitoreo}</p>
            <p><strong>Descripción:</strong> {selectedMonitoreo.descripcion || 'N/A'}</p>
            <p>
              <strong>Puntos:</strong>{' '}
              {loadingMediciones ? <Spin size="small" /> : `${(medicionCounts[selectedMonitoreo.id] ?? 0)} / ${selectedMonitoreo.puntos}`}
            </p>
            <p><strong>Avance:</strong>{' '}
              {loadingMediciones ? (
                <Spin size="small" />
              ) : (
                <Progress
                  percent={
                    Math.round(((medicionCounts[selectedMonitoreo.id] ?? 0) / selectedMonitoreo.puntos) * 100) > 100
                      ? 100
                      : Math.round(((medicionCounts[selectedMonitoreo.id] ?? 0) / selectedMonitoreo.puntos) * 100)
                  }
                />
              )}
            </p>

            <p><strong>Usuarios:</strong></p>
            <Space size={[0, 8]} wrap>
              {(selectedMonitoreo.usuarios_asignados || []).map(userId => {
                const user = usuariosList.find(u => u.id === userId);
                return (
                  <Tag color="blue" key={userId}>
                    {user ? (user.nombre_completo || user.username) : 'ID Desconocido'}
                  </Tag>
                );
              })}
            </Space>

            <p style={{ marginTop: '10px' }}><strong>Equipos:</strong></p>
            <Space size={[0, 8]} wrap>
              {(selectedMonitoreo.equipos_asignados || []).map(equipoId => {
                const eq = equiposList.find(e => e.id === equipoId);
                return (
                  <Tag color="cyan" key={equipoId}>
                    {/* ⬇️ en el modal también modelo */}
                    {eq ? `${eq.nombre_equipo} (${eq.modelo || 's/n'})` : 'ID Desconocido'}
                  </Tag>
                );
              })}
              {(selectedMonitoreo.equipos_asignados || []).length === 0 && (
                <Text type="secondary">Sin equipos asignados</Text>
              )}
            </Space>
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
        <p>¿Estás seguro de que deseas eliminar el monitoreo de "{selectedMonitoreo?.tipo_monitoreo}"?</p>
      </Modal>

      {/* MODAL DE CONFIGURACIÓN DE REPORTE */}
      <Modal
        title={
            <Space>
                <FilePdfOutlined style={{ color: 'red' }} />
                <span>Configuración de Reporte General</span>
            </Space>
        }
        open={isReportModalVisible}
        onCancel={() => setIsReportModalVisible(false)}
        onOk={handleGenerateReport}
        okText="Generar PDF"
        cancelText="Cancelar"
        confirmLoading={reportLoading}
        width={600}
      >
        <Form
            form={reportForm}
            layout="vertical"
            initialValues={{
                alcance: 'todos',
                incluirFotos: true,
                incluirEstadisticas: true,
                incluirObservaciones: true
            }}
        >
            <Card size="small" style={{ marginBottom: 16, background: '#f5f5f5' }}>
                <Text type="secondary" style={{ fontSize: 12 }}>
                    Este asistente generará un PDF consolidado con la información de los monitoreos seleccionados.
                </Text>
            </Card>

            <Divider orientation="left">Alcance del Reporte</Divider>
            
            <Form.Item name="alcance" label="¿Qué monitoreos desea incluir?">
                <Radio.Group style={{ width: '100%' }}>
                    <Space direction="vertical" style={{ width: '100%' }}>
                        <Radio value="todos">
                            <strong>Todos los monitoreos del proyecto</strong>
                            <div style={{ fontSize: 12, color: '#888', marginLeft: 24 }}>
                                Incluye los {monitoreos.length} tipos listados actualmente.
                            </div>
                        </Radio>
                        <Radio value="seleccion">
                            <strong>Seleccionar específicos</strong>
                        </Radio>
                    </Space>
                </Radio.Group>
            </Form.Item>

            {/* Renderizado condicional: Si elige 'seleccion', mostramos el Select */}
            <Form.Item
                noStyle
                shouldUpdate={(prevValues, currentValues) => prevValues.alcance !== currentValues.alcance}
            >
                {({ getFieldValue }) => 
                    getFieldValue('alcance') === 'seleccion' ? (
                        <Form.Item 
                            name="seleccionados" 
                            label="Seleccione los monitoreos"
                            rules={[{ required: true, message: 'Seleccione al menos uno' }]}
                        >
                            <Select mode="multiple" placeholder="Ej: Iluminación, Ruido...">
                                {monitoreos.map(m => (
                                    <Option key={m.id} value={m.id}>{m.tipo_monitoreo}</Option>
                                ))}
                            </Select>
                        </Form.Item>
                    ) : null
                }
            </Form.Item>

            <Divider orientation="left">Filtros y Contenido</Divider>

            <Row gutter={16}>
                <Col span={12}>
                    <Form.Item name="fechas" label="Rango de Fechas (Opcional)">
                        <RangePicker 
                            style={{ width: '100%' }} 
                            placeholder={['Inicio', 'Fin']}
                            format="DD/MM/YYYY"
                        />
                    </Form.Item>
                </Col>
                <Col span={12}>
                    <Form.Item label="Opciones de contenido">
                        <Space direction="vertical">
                            <Form.Item name="incluirEstadisticas" valuePropName="checked" noStyle>
                                <Checkbox>Incluir Gráficos/Estadísticas</Checkbox>
                            </Form.Item>
                            <Form.Item name="incluirFotos" valuePropName="checked" noStyle>
                                <Checkbox>Incluir Evidencia Fotográfica</Checkbox>
                            </Form.Item>
                            <Form.Item name="incluirObservaciones" valuePropName="checked" noStyle>
                                <Checkbox>Incluir Observaciones</Checkbox>
                            </Form.Item>
                        </Space>
                    </Form.Item>
                </Col>
            </Row>
        </Form>
      </Modal>
      {/* MODAL VISOR DE PDF */}
      <Modal
        title="Vista Previa del Reporte General"
        open={isPdfModalVisible}
        onCancel={() => setIsPdfModalVisible(false)}
        footer={null} // Sin botones, el visor tiene su propia barra de descarga
        width={1000}
        style={{ top: 20 }}
        destroyOnClose
      >
        <div style={{ height: '80vh' }}>
            <PDFViewer width="100%" height="100%" showToolbar={true}>
                <ReporteGeneralPDF 
                    data={pdfReportData}
                    // Aquí puedes pasar info extra del proyecto si la tienes disponible en un estado
                    proyectoInfo={{ nombre: 'Proyecto Actual' }} 
                />
            </PDFViewer>
        </div>
      </Modal>
    </>
  );
};

export default MonitoreosPage;
