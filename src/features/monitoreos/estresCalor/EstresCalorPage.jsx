// src/features/monitoreos/estresCalor/EstresCalorPage.jsx
// Página principal de "Monitoreo de Estrés por Calor" (UI + hooks).
// NOTA: usa utilidades globales en src/utils/ y componentes locales en ./components/

import React, { useEffect, useMemo, useState, useCallback } from 'react';

// AntD UI
import {
  Table, Button, Form, Input, Modal, Select, Typography, Space, Tooltip,
  message, Spin, InputNumber, Descriptions, Pagination, Checkbox, Progress,
  Row, Col, TimePicker, Breadcrumb
} from 'antd';

import {
  PlusOutlined, EditOutlined, DeleteOutlined, EyeOutlined,
  FilePdfOutlined, FileExcelOutlined, SaveOutlined, ArrowLeftOutlined
} from '@ant-design/icons';
import { Link, useNavigate, useParams } from 'react-router-dom';

// supabase client (asegúrate que exportes 'supabase' desde src/supabaseClient.js)
import { supabase } from '../../../supabaseClient.js';

// Fecha: dayjs (solo usado para mostrar/parseo ligero)
import dayjs from 'dayjs';
import 'dayjs/locale/es';
import utc from 'dayjs/plugin/utc';
dayjs.locale('es');
dayjs.extend(utc);

// Componentes / utilidades modularizadas
// - columnas y formulario son componentes creados en ./components/
import getEstresCalorColumns from './estresCalorColumns.jsx';
import EstresCalorForm from './estresCalorForm.jsx';

// Utils globales (debes tener estos archivos en src/utils/)
import { toNumberOrString } from '../../../utils/numbers.js';
import { getImagesArray, processImageForPdf } from '../../../utils/images.js';
import { downloadImagesAsZip } from '../../../utils/downloadImagesAsZip.js';
import { buildPdfData } from '../../../utils/buildPdfData.js';
import { exportEstresCalor } from '../../../reports/excel/exportEstresCalor.js';

// PDF rendering (react-pdf)
import { PDFViewer } from '@react-pdf/renderer';
import { ReporteFotografico } from '../../../reports/pdf/ReporteFotografico.jsx'; // export default en ese archivo

// Tipografías y constantes
const { Title, Text } = Typography;
const { Option } = Select;
const PRIMARY_BLUE = '#2a8bb6';
const TABLE_NAME = 'estres_calor';

/* ===========================
   Componente principal
   =========================== */
const EstresCalorPage = () => {
  // --- Router params y navegación
  const { projectId, monitoreoId: mId, id } = useParams(); // algunos routes usan id / monitoreoId
  const monitoreoId = mId || id;
  const navigate = useNavigate();

  // --- Form (para modal add/edit)
  const [form] = Form.useForm();

  // --- Estados de la página
  const [headerInfo, setHeaderInfo] = useState({
    empresa: '—', area: '—', fecha: '—', equipo: '', modelos: '', series: '',
    tipo_monitoreo: 'Estrés', descripcion_proyecto: ''
  });

  const [rows, setRows] = useState([]);               // filas que vienen de supabase
  const [usersById, setUsersById] = useState({});     // cache de usuarios para mostrar nombre

  const [loadingHeader, setLoadingHeader] = useState(true); // loading para header
  const [loading, setLoading] = useState(true);            // loading para tabla
  const [saving, setSaving] = useState(false);             // loading del form al guardar

  // Form modal control
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [selected, setSelected] = useState(null); // registro seleccionado para editar

  // Buscador / paginación
  const [searchText, setSearchText] = useState('');
  const [pageSize, setPageSize] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);

  // Visor de imágenes (interno, simple)
  const [imageViewerOpen, setImageViewerOpen] = useState(false);
  const [imageViewerList, setImageViewerList] = useState([]);
  const [imageViewerIndex, setImageViewerIndex] = useState(0);

  // PDF modal & estado de selección
  const [isPdfModalVisible, setIsPdfModalVisible] = useState(false);
  const [pdfStep, setPdfStep] = useState('selection'); // 'selection' | 'processing' | 'view'
  const [pdfData, setPdfData] = useState([]);
  const [tempSelections, setTempSelections] = useState({});   // { recordId: imageIndex }
  const [recordSelections, setRecordSelections] = useState({}); // { recordId: boolean }
  const [pdfLayout, setPdfLayout] = useState('2x4');

  // Progreso de procesamiento de imágenes al construir PDF
  const [progressPercent, setProgressPercent] = useState(0);
  const [processingStatus, setProcessingStatus] = useState('');

  /* ---------------------------
     HELPERS LOCALES (ligeros)
     --------------------------- */
  // Formateo de fecha y hora usando dayjs (sólo para UI)
  const formatFechaUTC = (v) => { if (!v) return ''; try { return dayjs(v).utc().format('DD/MM/YYYY'); } catch { return String(v); } };
  const formatHoraUTC = (v) => { if (!v) return ''; try { return dayjs(v).utc().format('HH:mm'); } catch { return String(v); } };

  /* ============================
     Fetch header (empresa, equipos, fecha)
     ============================ */
  useEffect(() => {
    (async () => {
      setLoadingHeader(true);
      try {
        if (monitoreoId) {
          // obtener monitoreo
          const { data: m, error: em } = await supabase
            .from('monitoreos')
            .select('id, tipo_monitoreo, proyecto_id, equipos_asignados')
            .eq('id', monitoreoId)
            .single();
          if (em) throw em;

          // obtener proyecto
          const { data: p } = await supabase
            .from('proyectos')
            .select('id, nombre, created_at, descripcion')
            .eq('id', m.proyecto_id)
            .single();

          // resolver equipos asignados (si aplica)
          let equipos = [];
          let ids = m.equipos_asignados;
          if (typeof ids === 'string') {
            try { ids = JSON.parse(ids); } catch { ids = []; }
          }
          if (Array.isArray(ids) && ids.length) {
            const { data: eq } = await supabase
              .from('equipos')
              .select('id, nombre_equipo, modelo, serie')
              .in('id', ids);
            equipos = eq || [];
          }

          // setear header con datos resueltos
          setHeaderInfo((h) => ({
            ...h,
            empresa: p?.nombre || '—',
            fecha: p?.created_at ? dayjs(p.created_at).format('DD/MM/YYYY') : '—',
            equipo: equipos.length ? equipos.map(e => e.nombre_equipo || 's/n').join(', ') : '',
            modelos: equipos.length ? equipos.map(e => e.modelo || 's/n').join(', ') : '',
            series: equipos.length ? equipos.map(e => e.serie || 's/n').join(', ') : '',
            tipo_monitoreo: m?.tipo_monitoreo || h.tipo_monitoreo,
            descripcion_proyecto: p?.descripcion || h.descripcion_proyecto
          }));
        } else if (projectId) {
          // caso: sólo proyecto (sin monitoreo específico)
          const { data: p } = await supabase
            .from('proyectos')
            .select('id, nombre, created_at, descripcion')
            .eq('id', projectId)
            .single();
          setHeaderInfo((h) => ({
            ...h,
            empresa: p?.nombre || '—',
            fecha: p?.created_at ? dayjs(p.created_at).format('DD/MM/YYYY') : '—',
            descripcion_proyecto: p?.descripcion || ''
          }));
        }
      } catch (e) {
        console.error('Header error:', e);
        message.error('No se pudo cargar la cabecera del monitoreo.');
      } finally {
        setLoadingHeader(false);
      }
    })();
  }, [projectId, monitoreoId]);

  /* ============================
     Fetch rows (registros) - centralizado
     ============================ */
  const fetchRows = useCallback(async (isBackground = false) => {
    if (!isBackground) setLoading(true);
    try {
      // construimos query base
      let q = supabase.from(TABLE_NAME).select('*').order('measured_at', { ascending: true });

      // filtrado condicional (evita .or("") inválido)
      if (monitoreoId && projectId) {
        q = q.or(`monitoreo_id.eq.${monitoreoId},proyecto_id.eq.${projectId}`);
      } else if (monitoreoId) {
        q = q.eq('monitoreo_id', monitoreoId);
      } else if (projectId) {
        q = q.eq('proyecto_id', projectId);
      }

      const { data, error } = await q;
      if (error) throw error;

      // mapear image_urls usando getImagesArray (util limpio en src/utils)
      const mapped = (data || []).map((r) => ({ ...r, image_urls: getImagesArray(r) }));
      setRows(mapped);

      // si no es background, resetear paginación a la página 1
      if (!isBackground) setCurrentPage(1);

      // actualizar fecha del header si existen filas y measured_at
      if (mapped.length && mapped[0].measured_at) {
        const raw = String(mapped[0].measured_at);
        const [yyyy, mm, dd] = raw.slice(0, 10).split('-');
        setHeaderInfo((h) => ({ ...h, fecha: `${dd}/${mm}/${yyyy}` }));
      }

      // traer nombres de usuarios (profiles) para mostrar en la tabla
      const ids = Array.from(new Set(mapped.map(m => m.created_by).filter(Boolean)));
      if (ids.length) {
        const { data: profs } = await supabase
          .from('profiles')
          .select('id, username, nombre_completo')
          .in('id', ids);
        const dict = {};
        (profs || []).forEach((u) => { dict[u.id] = u.nombre_completo || u.username || u.id; });
        setUsersById(dict);
      } else {
        setUsersById({});
      }
    } catch (e) {
      console.error('Fetch error:', e);
      if (!isBackground) message.error('No se pudo cargar Estrés por Calor.');
      setRows([]);
    } finally {
      if (!isBackground) setLoading(false);
    }
  }, [monitoreoId, projectId]);

  // effect inicial: fetch + realtime (si quieres realtime, descomenta y ajusta)
  useEffect(() => {
    fetchRows();
    // Si usas supabase realtime, puedes suscribir. (Comentar/ajustar según tu cliente)
    // const ch = supabase.channel('rt-estres-calor').on('postgres_changes', { event: '*', schema: 'public', table: TABLE_NAME }, () => fetchRows(true)).subscribe();
    // return () => supabase.removeChannel(ch);
  }, [fetchRows]);

  /* ============================
     PDF selection handlers
     ============================ */
  const handlePrevImage = (regId, total) => setTempSelections(prev => ({ ...prev, [regId]: (prev[regId] - 1 + total) % total }));
  const handleNextImage = (regId, total) => setTempSelections(prev => ({ ...prev, [regId]: (prev[regId] + 1) % total }));
  const handleRecordSelectionToggle = (recordId) => setRecordSelections(prev => ({ ...prev, [recordId]: !prev[recordId] }));
  const handleSelectAllRecords = () => {
    const allSelected = {};
    rows.filter(r => getImagesArray(r).length > 0).forEach(r => { allSelected[r.id] = true; });
    setRecordSelections(allSelected);
  };
  const handleDeselectAllRecords = () => {
    const allDeselected = {};
    rows.filter(r => getImagesArray(r).length > 0).forEach(r => { allDeselected[r.id] = false; });
    setRecordSelections(allDeselected);
  };

  // abrir modal PDF inicializando selecciones
  const handleOpenPdf = () => {
    const registrosConFotos = rows.filter(r => getImagesArray(r).length > 0);
    if (!registrosConFotos.length) {
      message.warning('No hay registros con imágenes.');
      return;
    }
    // construir selección inicial: marcar todos y elegir índice 0 por defecto (o selected_image_index)
    const initialSelections = {};
    const initialRecordSelections = {};
    registrosConFotos.forEach(r => {
      const imgs = getImagesArray(r);
      const savedIndex = r.selected_image_index || 0;
      initialSelections[r.id] = (savedIndex >= 0 && savedIndex < imgs.length) ? savedIndex : 0;
      initialRecordSelections[r.id] = true;
    });
    setTempSelections(initialSelections);
    setRecordSelections(initialRecordSelections);
    setPdfStep('selection');
    setPdfData([]);
    setIsPdfModalVisible(true);
  };

  /* ============================
     Generación PDF (batch + progreso)
     - usa buildPdfData(util) y processImageForPdf(util) si options.processImages=true
     ============================ */
  const handleSaveAndGenerate = async () => {
    // validar selección
    const selectedRows = rows.filter(r => recordSelections[r.id] === true && getImagesArray(r).length > 0);
    if (!selectedRows.length) { message.warning('Seleccione al menos un registro.'); return; }

    // cambiar step y reset progreso
    setPdfStep('processing');
    setProgressPercent(0);
    setProcessingStatus('Iniciando procesamiento de imágenes...');

    // Opcional: usar buildPdfData util que puede procesar imágenes (si deseas)
    try {
      // buildPdfData puede procesar imágenes en lote si options.processImages=true
      const final = await buildPdfData(rows, tempSelections, recordSelections, { processImages: true, batchSize: 5, processImageFn: processImageForPdf });
      // setear datos y pasar a vista
      setPdfData(final);
      setProcessingStatus('Generando documento PDF...');

      // breve pausa para UX y luego mostrar vista
      setTimeout(() => { setPdfStep('view'); }, 400);
    } catch (err) {
      console.error('Error generando PDF data:', err);
      message.error('No se pudo generar el PDF.');
      setPdfStep('selection');
    }
  };

  /* ============================
     Descargar todas las imágenes en ZIP
     ============================ */
  const handleDownloadImages = async () => {
    try {
      message.loading({ content: 'Preparando descarga de imágenes...', key: 'zipCalor', duration: 0 });
      await downloadImagesAsZip(rows, headerInfo);
      message.success({ content: 'Descarga lista.', key: 'zipCalor' });
    } catch (err) {
      console.error('Download zip error:', err);
      message.error({ content: 'No se pudieron descargar las imágenes.', key: 'zipCalor' });
    }
  };

  /* ============================
     Exportar Excel -> delega a util exportEstresCalorExcel
     (si prefieres separar reporte, deja este botón o muévelo a otro lugar)
     ============================ */
  const handleExportExcel = () => {
    try {
      exportEstresCalor(rows, headerInfo);
    } catch (err) {
      console.error('Export excel error:', err);
      message.error('No se pudo exportar Excel.');
    }
  };

  /* ============================
     CRUD handlers (add/edit/delete)
     - la lógica real usa supabase (doAdd/doEdit) y refresca fetchRows
     ============================ */
  const handleAdd = () => { setSelected(null); setIsFormOpen(true); };
  const handleEdit = (rec) => { setSelected(rec); setIsFormOpen(true); };

  const handleDelete = (rec) => {
    Modal.confirm({
      title: '¿Eliminar registro?',
      content: `Se eliminará el registro de "${rec.puesto_trabajo || '—'}"`,
      okText: 'Eliminar', okType: 'danger', cancelText: 'Cancelar',
      onOk: async () => {
        try {
          const { error } = await supabase.from(TABLE_NAME).delete().eq('id', rec.id);
          if (error) throw error;
          message.success('Eliminado.');
          fetchRows(true);
        } catch (e) { console.error(e); message.error('No se pudo eliminar.'); }
      }
    });
  };

  // onOk form: decide add o edit según selected
  const onOkForm = () => (selected ? doEdit() : doAdd());
  const onCancelForm = () => { setIsFormOpen(false); setSelected(null); };

  // construir payload desde valores del form (usado en doAdd/doEdit)
  const payloadFromValues = (values) => {
    // horario -> measured_at ISO
    let measuredAt = null;
    if (values.horario) {
      const h = values.horario.hour();
      const m = values.horario.minute();
      const base = selected?.measured_at ? dayjs(selected.measured_at) : dayjs();
      const local = base.hour(h).minute(m).second(0).millisecond(0);
      measuredAt = local.format('YYYY-MM-DD[T]HH:mm:ssZ');
    } else if (selected?.measured_at) {
      measuredAt = selected.measured_at;
    }

    // image_urls textarea -> array
    let imageUrls = null;
    if (values.image_urls && values.image_urls.trim() !== '') {
      imageUrls = values.image_urls.split(',').map(s => s.trim()).filter(Boolean);
    }

    return {
      proyecto_id: projectId || null,
      monitoreo_id: monitoreoId || null,
      measured_at: measuredAt,
      area: values.area || null,
      puesto_trabajo: values.puesto_trabajo || null,
      interior_exterior: values.interior_exterior || null,
      aclimatado: values.aclimatado ?? null,
      desc_actividades: values.desc_actividades || null,
      tipo_ropa_cav: values.tipo_ropa_cav || null,
      capucha: values.capucha ?? null,
      tasa_metabolica: values.tasa_metabolica ?? null,
      hr_percent: toNumberOrString(values.hr_percent),
      vel_viento_ms: toNumberOrString(values.vel_viento_ms),
      presion_mmhg: toNumberOrString(values.presion_mmhg),
      temp_c: toNumberOrString(values.temp_c),
      wbgt_c: toNumberOrString(values.wbgt_c),
      wb_c: toNumberOrString(values.wb_c),
      gt_c: toNumberOrString(values.gt_c),
      observaciones: values.observaciones || null,
      image_urls: imageUrls,
      location: values.location || null
    };
  };

  // doAdd -> inserta en supabase y refresca
  const doAdd = async () => {
    setSaving(true);
    try {
      const values = await form.validateFields();
      const payload = payloadFromValues(values);
      const { error } = await supabase.from(TABLE_NAME).insert(payload);
      if (error) throw error;
      message.success('Registro agregado.');
      setIsFormOpen(false);
      fetchRows(true);
    } catch (e) {
      console.error('Add error:', e);
      message.error('No se pudo agregar: ' + (e.message || e));
    } finally { setSaving(false); }
  };

  // doEdit -> update + refresh
  const doEdit = async () => {
    if (!selected) return;
    setSaving(true);
    try {
      const values = await form.validateFields();
      const payload = payloadFromValues(values);
      const { error } = await supabase.from(TABLE_NAME).update(payload).eq('id', selected.id);
      if (error) throw error;
      message.success('Registro actualizado.');
      setIsFormOpen(false);
      setSelected(null);
      fetchRows(true);
    } catch (e) {
      console.error('Edit error:', e);
      message.error('No se pudo actualizar: ' + (e.message || e));
    } finally { setSaving(false); }
  };

  /* ============================
     Filtrado y paginación (client-side)
     ============================ */
  const filtered = useMemo(() => {
    if (!searchText) return rows;
    const s = searchText.toLowerCase();
    return rows.filter(r => {
      const imgs = Array.isArray(r.image_urls) ? r.image_urls.join(',') : (r.image_urls || '');
      return (
        (r.area && r.area.toLowerCase().includes(s)) ||
        (r.puesto_trabajo && r.puesto_trabajo.toLowerCase().includes(s)) ||
        (formatHoraUTC(r.measured_at) && formatHoraUTC(r.measured_at).includes(s)) ||
        (imgs && imgs.toLowerCase().includes(s))
      );
    });
  }, [searchText, rows]);

  const totalFiltered = filtered.length;
  const pageData = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, currentPage, pageSize]);

  /* ============================
     Abrir visor de imagen (interno)
     ============================ */
  const openImageViewer = (imgs, idx = 0) => {
    const list = Array.isArray(imgs) ? imgs : [];
    if (!list.length) return;
    setImageViewerList(list);
    setImageViewerIndex(idx);
    setImageViewerOpen(true);
  };

  /* ============================
     Columnas (se crean con dependencias inyectadas)
     ============================ */
  const columns = getEstresCalorColumns({
    handleEdit,
    handleDelete,
    openImageViewer,
    usersById,
    pageSize,
    currentPage
  });

  /* ============================
     Breadcrumb (UI)
     ============================ */
  const breadcrumbItems = [
    { title: <Link to="/"><span>Inicio</span></Link> },
    { title: <Link to="/proyectos">Proyectos</Link> },
    { title: <Link to={`/proyectos/${projectId}/monitoreo`}>Monitoreos</Link> },
    { title: 'Monitoreo de Estrés por Calor' }
  ];

  /* ============================
     Renderizado
     ============================ */
  return (
    <>
      {/* Breadcrumb */}
      <Row style={{ marginBottom: 12 }}>
        <Col span={24}><Breadcrumb items={breadcrumbItems} /></Col>
      </Row>

      {/* Título y botones principales */}
      <Row justify="space-between" align="middle" style={{ marginBottom: 8 }}>
        <Col>
          <Title level={2} style={{ color: PRIMARY_BLUE, marginBottom: 0 }}>Monitoreo de Estrés por Calor</Title>
        </Col>

        <Col>
          <Space>
            {/* Volver a la lista de monitoreos */}
            <Button onClick={() => navigate(`/proyectos/${projectId}/monitoreo`)}>
              <ArrowLeftOutlined /> Volver a Monitoreos
            </Button>

            {/* Descargar imágenes (delegado a util) */}
            <Button onClick={handleDownloadImages}>Descargar Imágenes</Button>

            {/* Exportar a Excel (delegado a util) */}
            <Button icon={<FileExcelOutlined />} onClick={handleExportExcel}>Exportar a Excel</Button>

            {/* Abrir selector PDF */}
            <Button icon={<FilePdfOutlined />} onClick={handleOpenPdf} style={{ backgroundColor: '#ff4d4f', color: 'white', borderColor: '#ff4d4f' }}>
              Reporte Fotos
            </Button>

            {/* Agregar registro */}
            <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>Agregar</Button>
          </Space>
        </Col>
      </Row>

      {/* Buscador y select page size */}
      <Row justify="space-between" align="middle" style={{ marginBottom: 12, gap: 15 }}>
        <Col flex="0 0 520px">
          <Input.Search allowClear placeholder="Buscar por puesto, actividades, metabolismo..." value={searchText} onChange={(e) => { setSearchText(e.target.value); setCurrentPage(1); }} />
        </Col>
        <Col>
          <Space>
            <Text type="secondary">Ver:</Text>
            <Select value={pageSize} onChange={(val) => { setPageSize(val); setCurrentPage(1); }} style={{ width: 90 }}>
              <Option value={5}>5</Option><Option value={10}>10</Option><Option value={20}>20</Option><Option value={50}>50</Option>
            </Select>
            <Text type="secondary">registros</Text>
          </Space>
        </Col>
      </Row>

      {/* Header info (empresa, fecha, equipos) */}
      <Spin spinning={loadingHeader}>
        <Descriptions bordered size="small" column={2} style={{ marginBottom: 15 }}>
          <Descriptions.Item label="NOMBRE DE LA EMPRESA">{headerInfo.empresa}</Descriptions.Item>
          <Descriptions.Item label="FECHA DE MONITOREO">{headerInfo.fecha}</Descriptions.Item>
          <Descriptions.Item label="AREA DE TRABAJO">{headerInfo.area}</Descriptions.Item>
          <Descriptions.Item label="EQUIPO">{headerInfo.equipo}</Descriptions.Item>
          <Descriptions.Item label="MODELO DEL EQUIPO">{headerInfo.modelos}</Descriptions.Item>
          <Descriptions.Item label="SERIE DEL EQUIPO">{headerInfo.series}</Descriptions.Item>
        </Descriptions>
      </Spin>

      {/* Tabla principal */}
      <Spin spinning={loading}>
        <div style={{ overflowX: 'auto' }}>
          <Table className="tabla-general" size="small" columns={columns} dataSource={pageData} rowKey="id" pagination={false} scroll={{ x: 1800 }} />
        </div>
      </Spin>

      {/* Barra inferior: contadores y paginación */}
      <Row justify="space-between" align="middle" style={{ marginTop: 12 }}>
        <Col>
          <Text type="secondary">Registros {Math.min(currentPage * pageSize, totalFiltered)} de {totalFiltered}</Text>
        </Col>
        <Col>
          <Pagination current={currentPage} pageSize={pageSize} total={totalFiltered} onChange={(p) => setCurrentPage(p)} size="small" showSizeChanger={false} />
        </Col>
      </Row>

      {/* Modal Form: usamos componente modular EstresCalorForm */}
      <EstresCalorForm
        visible={isFormOpen}
        initialValues={selected}
        loading={saving}
        onCancel={onCancelForm}
        onSubmit={async (payload) => {
          // payload ya viene preprocesado (medido_at, image_urls)
          try {
            setSaving(true);
            if (selected) {
              // actualizar
              const { error } = await supabase.from(TABLE_NAME).update(payload).eq('id', selected.id);
              if (error) throw error;
              message.success('Registro actualizado.');
            } else {
              // insertar
              const { error } = await supabase.from(TABLE_NAME).insert(payload);
              if (error) throw error;
              message.success('Registro agregado.');
            }
            setIsFormOpen(false);
            setSelected(null);
            fetchRows(true);
          } catch (e) {
            console.error('Form submit error:', e);
            message.error('No se pudo guardar registro.');
          } finally {
            setSaving(false);
          }
        }}
      />

      {/* Modal PDF (tres steps: selection, processing, view) */}
      <Modal title="Vista Previa PDF" open={isPdfModalVisible} onCancel={() => setIsPdfModalVisible(false)} width={1000} style={{ top: 20 }} footer={null} destroyOnHidden maskClosable={pdfStep !== 'processing'}>
        {/* STEP 1: selección */}
        {pdfStep === 'selection' && (
          <div style={{ display: 'flex', flexDirection: 'column', height: '70vh' }}>
            <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f5f5f5', padding: 10, borderRadius: 5 }}>
              <div style={{ display: 'flex', gap: 8 }}>
                <Button size="small" onClick={handleSelectAllRecords}>Todos</Button>
                <Button size="small" onClick={handleDeselectAllRecords}>Ninguno</Button>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Text strong>Distribución:</Text>
                <Select value={pdfLayout} onChange={setPdfLayout} style={{ width: 120 }}>
                  <Option value="2x2">2 x 2</Option><Option value="2x3">2 x 3</Option><Option value="2x4">2 x 4</Option><Option value="3x3">3 x 3</Option><Option value="3x4">3 x 4</Option>
                </Select>
                <Button type="primary" icon={<SaveOutlined />} onClick={handleSaveAndGenerate}>Generar PDF</Button>
              </div>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: 5 }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, justifyContent: 'center' }}>
                {rows.filter(r => getImagesArray(r).length > 0).map(r => {
                  const imgs = getImagesArray(r);
                  const currentIdx = tempSelections[r.id] || 0;
                  const isSelected = recordSelections[r.id] === true;
                  return (
                    <div key={r.id} style={{ width: '23%', border: isSelected ? '1px solid #ddd' : '1px dashed #999', opacity: isSelected ? 1 : 0.5, padding: 8, position: 'relative', backgroundColor: isSelected ? '#fff' : 'transparent', borderRadius: 6 }}>
                      <Checkbox checked={isSelected} onChange={() => handleRecordSelectionToggle(r.id)} style={{ position: 'absolute', top: 6, right: 6 }} />
                      <div style={{ fontSize: 12, fontWeight: 700, textAlign: 'center' }}>{headerInfo.tipo_monitoreo}</div>
                      <div style={{ position: 'relative', width: '100%', height: 150, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#fff', marginTop: 6 }}>
                        {imgs[currentIdx] ? <img src={imgs[currentIdx]} alt="" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} /> : null}
                        {imgs.length > 1 && <Button shape="circle" size="small" style={{ position: 'absolute', left: 5 }} onClick={() => handlePrevImage(r.id, imgs.length)}></Button>}
                        {imgs.length > 1 && <Button shape="circle" size="small" style={{ position: 'absolute', right: 5 }} onClick={() => handleNextImage(r.id, imgs.length)}></Button>}
                        {imgs.length > 1 && <div style={{ position: 'absolute', bottom: 4, right: 6, fontSize: 10, background: 'rgba(255,255,255,0.7)', padding: '2px 6px', borderRadius: 4 }}>{currentIdx + 1}/{imgs.length}</div>}
                      </div>
                      <div style={{ textAlign: 'center', marginTop: 6, fontSize: 11 }}>{r.puesto_trabajo}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* STEP 2: processing */}
        {pdfStep === 'processing' && (
          <div style={{ height: '50vh', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', padding: 40 }}>
            <Spin size="large" />
            <div style={{ marginTop: 30, width: '80%' }}><Progress percent={progressPercent} status="active" /></div>
            <Text style={{ marginTop: 15, fontSize: 16 }}>{processingStatus}</Text>
          </div>
        )}

        {/* STEP 3: view PDF */}
        {pdfStep === 'view' && (
          <div style={{ height: '80vh', display: 'flex', flexDirection: 'column' }}>
            <Button onClick={() => setPdfStep('selection')} icon={<ArrowLeftOutlined />} style={{ marginBottom: 10, width: 'fit-content' }}>Volver</Button>
            {pdfData.length > 0 && (
              <PDFViewer width="100%" height="100%" showToolbar>
                <ReporteFotografico data={pdfData} empresa={headerInfo.descripcion_proyecto || ''} layout={pdfLayout} tituloMonitoreo={headerInfo.tipo_monitoreo} />
              </PDFViewer>
            )}
          </div>
        )}
      </Modal>

      {/* Modal visor de imágenes simple (interno) */}
      <Modal
        open={imageViewerOpen}
        onCancel={() => setImageViewerOpen(false)}
        centered
        width={720}
        title="Imagen del registro"
        footer={
          imageViewerList.length > 1
            ? [
                <Button key="prev" onClick={() => setImageViewerIndex(prev => (prev - 1 + imageViewerList.length) % imageViewerList.length)}>Anterior</Button>,
                <Button key="next" type="primary" onClick={() => setImageViewerIndex(prev => (prev + 1) % imageViewerList.length)}>Siguiente</Button>
              ]
            : null
        }
      >
        {imageViewerList.length ? (
          <div style={{ textAlign: 'center' }}>
            <img src={imageViewerList[imageViewerIndex]} alt="registro" style={{ maxWidth: '100%', maxHeight: '80vh', objectFit: 'contain' }} />
            <div style={{ marginTop: 15, fontSize: 15 }}>{imageViewerIndex + 1} / {imageViewerList.length}</div>
          </div>
        ) : <Text type="secondary">Sin imagen.</Text>}
      </Modal>
    </>
  );
};

export default EstresCalorPage;
