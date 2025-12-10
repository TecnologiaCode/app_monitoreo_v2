// src/pages/VibracionPage.jsx

import React, { useEffect, useMemo, useState } from 'react';
import {
  Table,
  Button,
  Form,
  Input,
  Modal,
  Select,
  Typography,
  Space,
  Tooltip,
  message,
  Spin,
  InputNumber,
  Breadcrumb,
  TimePicker,
  Row,
  Col,
  Descriptions,
  Pagination,
  Checkbox,
  Divider
} from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  HomeOutlined,
  DatabaseOutlined,
  ExclamationCircleOutlined,
  ArrowLeftOutlined,
  FileExcelOutlined,
  EyeOutlined,
  FilePdfOutlined,
  SaveOutlined,
  LeftOutlined,
  RightOutlined
} from '@ant-design/icons';

import { Link, useNavigate, useParams } from 'react-router-dom';
import { supabase } from '../supabaseClient.js';

import dayjs from 'dayjs';
import 'dayjs/locale/es';
import utc from 'dayjs/plugin/utc';
import * as XLSX from 'xlsx';

// ► NUEVO: librerías para descargar todas las imágenes en ZIP
import JSZip from 'jszip';
import { saveAs } from 'file-saver';

// IMPORTS DEL REPORTE FOTOGRÁFICO
import { PDFViewer } from '@react-pdf/renderer';
import { ReporteFotografico } from '../components/ReporteFotografico';

dayjs.locale('es');
dayjs.extend(utc);

const { Title, Text } = Typography;
const { Option } = Select;
const PRIMARY_BLUE = '#2a8bb6';
const TABLE_NAME = 'vibracion';

// --- HELPERS ---
const formatHoraUTC = (v) => {
  if (!v) return '';
  try { return dayjs(v).utc().format('HH:mm'); } catch { return String(v); }
};

const formatFechaUTC = (v) => {
  if (!v) return '';
  try { return dayjs(v).utc().format('DD/MM/YYYY'); } catch { return String(v); }
};

const renderLocation = (v) => {
  if (!v) return <Text type="secondary">N/A</Text>;
  if (typeof v === 'object') {
    const lat = v.lat ?? v.latitude ?? '';
    const lng = v.lng ?? v.longitude ?? '';
    if (lat !== '' || lng !== '') return <span>lat: {lat}{lng !== '' ? `, lng: ${lng}` : ''}</span>;
    const e = v.easting ?? '';
    const n = v.northing ?? '';
    const z = v.utm_zone ?? '';
    if (e !== '' || n !== '' || z !== '') return <span>{`E: ${e}${n !== '' ? `, N: ${n}` : ''}${z ? `, Z: ${z}` : ''}`}</span>;
    if (Array.isArray(v)) return v.join(', ');
    return JSON.stringify(v);
  }
  try { const parsed = JSON.parse(v); return renderLocation(parsed); } catch { return <span>{String(v)}</span>; }
};

const toNumberOrString = (v) => {
  if (v === null || v === undefined || v === '') return null;
  if (typeof v === 'number') return v;
  const s = String(v).replace(',', '.');
  const n = Number(s);
  return Number.isNaN(n) ? String(v) : n;
};

const posturaDisplay = (postura, otro) =>
  postura === 'Otro' && otro ? `${postura} (${otro})` : (postura || '');

// Helper para obtener array de imagenes limpio
const getImagesArray = (reg) => {
  if (Array.isArray(reg.image_urls)) return reg.image_urls;
  if (typeof reg.image_urls === 'string' && reg.image_urls.trim() !== '') {
    try {
      const parsed = JSON.parse(reg.image_urls);
      if(Array.isArray(parsed)) return parsed;
      return [reg.image_urls];
    } catch {
      return reg.image_urls.split(',').map(s => s.trim());
    }
  }
  return [];
};

/* ============================ Export a Excel ============================ */
const exportToExcel = (rows = [], header) => {
  try {
    const empresaNombre = typeof header === 'object' ? (header.empresa || '—') : (header || '—');
    const fechaMonitoreo = typeof header === 'object' ? (header.fecha || '') : '';

    const B = { top: { style: 'thin', color: { rgb: '000000' } }, bottom: { style: 'thin', color: { rgb: '000000' } }, left: { style: 'thin', color: { rgb: '000000' } }, right: { style: 'thin', color: { rgb: '000000' } } };
    const sec = { font: { bold: true }, alignment: { vertical: 'center', horizontal: 'left' }, fill: { fgColor: { rgb: 'D9D9D9' } }, border: B };
    const lab = { font: { bold: true }, alignment: { vertical: 'center', horizontal: 'left', wrapText: true }, fill: { fgColor: { rgb: 'FFFF00' } }, border: B };
    const val = { alignment: { vertical: 'center', horizontal: 'left', wrapText: true }, border: B };
    const title = { font: { bold: true, sz: 14 }, alignment: { vertical: 'center', horizontal: 'center' }, border: B };

    const wb = XLSX.utils.book_new();

    rows.forEach((r, idx) => {
      const wsData = [];
      wsData.push([{ v: 'PLANILLA DE MONITOREO DE VIBRACIONES', s: title }]);
      wsData.push([{ v: 'NOMBRE DE LA EMPRESA', s: lab }, { v: empresaNombre, s: val }, { v: 'FECHA DE MONITOREO', s: lab }, { v: fechaMonitoreo, s: val }]);
      wsData.push(['']); 

      // Sección: INFORMACIÓN GENERAL
      wsData.push([{ v: 'INFORMACION GENERAL', s: sec }]);
      
      // --- CAMBIO EN EXCEL: ORDEN FECHA -> HORA -> AREA ---
      wsData.push([{ v: 'Fecha de medición', s: lab }, { v: formatFechaUTC(r.measured_at), s: val }]);
      wsData.push([{ v: 'Hora de medición', s: lab }, { v: formatHoraUTC(r.measured_at), s: val }]);
      wsData.push([{ v: 'Area de trabajo', s: lab }, { v: r.area_trabajo || '', s: val }]);
      
      wsData.push([{ v: 'Puesto de trabajo', s: lab }, { v: r.puesto_trabajo || '', s: val }]);
      wsData.push([{ v: 'Trabajador Evaluado', s: lab }, { v: r.trabajador_evaluado || '', s: val }]);
      wsData.push([{ v: 'Máquina / Equipo', s: lab }, { v: r.maquina_equipo || '', s: val }]);
      wsData.push([{ v: 'Duración de la Jornada (h)', s: lab }, { v: r.duracion_jornada_h ?? '', s: val }]);
      wsData.push([{ v: 'Tiempo de Exposición (TE) (h)', s: lab }, { v: r.tiempo_expos_h ?? '', s: val }]);
      wsData.push([{ v: 'Postura del evaluado', s: lab }, { v: posturaDisplay(r.postura, r.postura_otro), s: val }]);
      wsData.push([{ v: 'Duración de la prueba (min)', s: lab }, { v: r.duracion_prueba_min ?? '', s: val }]);

      wsData.push(['']);

      // Sección: CUERPO ENTERO
      wsData.push([{ v: 'MONITOREO CUERPO ENTERO', s: sec }]);
      wsData.push([{ v: 'Ubicación del acelerómetro', s: lab }, { v: r.ub_acelerometro || '', s: val }]);
      wsData.push([{ v: 'AeqX (m/s²)', s: lab }, { v: r.aeqx_ce ?? '', s: val }]);
      wsData.push([{ v: 'AeqY (m/s²)', s: lab }, { v: r.aeqy_ce ?? '', s: val }]);
      wsData.push([{ v: 'AeqZ (m/s²)', s: lab }, { v: r.aeqz_ce ?? '', s: val }]);

      wsData.push(['']);

      // Sección: MANO-BRAZO
      wsData.push([{ v: 'MONITOREO MANO-BRAZO', s: sec }]);
      wsData.push([{ v: 'Mano más afectada', s: lab }, { v: r.mano_afectada || '', s: val }]);
      wsData.push([{ v: 'AeqX (m/s²)', s: lab }, { v: r.aeqx_mb ?? '', s: val }]);
      wsData.push([{ v: 'AeqY (m/s²)', s: lab }, { v: r.aeqy_mb ?? '', s: val }]);
      wsData.push([{ v: 'AeqZ (m/s²)', s: lab }, { v: r.aeqz_mb ?? '', s: val }]);

      wsData.push(['']); 

      const imgs = Array.isArray(r.image_urls) ? r.image_urls.join(', ') : (r.image_urls || '');
      const locText = typeof r.location === 'object' ? JSON.stringify(r.location) : (r.location || '');

      wsData.push([{ v: 'Imágenes', s: lab }, { v: imgs, s: val }]);
      wsData.push([{ v: 'Coordenadas UTM', s: lab }, { v: locText, s: val }]);
      wsData.push([{ v: 'Observaciones', s: lab }, { v: r.observaciones || '', s: val }]);

      const ws = XLSX.utils.aoa_to_sheet(wsData);
      ws['!cols'] = [{ wch: 42 }, { wch: 60 }, { wch: 20 }, { wch: 20 }];
      const merges = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 1 } }];
      wsData.forEach((row, rIndex) => {
        if (Array.isArray(row) && row.length === 1 && row[0]?.s === sec) {
          merges.push({ s: { r: rIndex, c: 0 }, e: { r: rIndex, c: 1 } });
        }
      });
      ws['!merges'] = merges;
      XLSX.utils.book_append_sheet(wb, ws, `Vibración ${idx + 1}`);
    });

    XLSX.writeFile(wb, 'reporte_vibracion.xlsx');
  } catch (err) {
    console.error('Excel error:', err);
    message.error('No se pudo exportar el Excel.');
  }
};

/* =========================== Componente principal =========================== */
const VibracionPage = () => {
  const { projectId, monitoreoId: mId, id } = useParams();
  const monitoreoId = mId || id;
  const navigate = useNavigate();
  const [form] = Form.useForm();

  const [headerInfo, setHeaderInfo] = useState({
    empresa: '—',
    area: '—',
    fecha: '—',
    equipo: '',
    modelos: '',
    series: '',
    tipo_monitoreo: 'Vibración',
    descripcion_proyecto: ''
  });

  const [rows, setRows] = useState([]);
  const [usersById, setUsersById] = useState({});

  const [loadingHeader, setLoadingHeader] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [selected, setSelected] = useState(null);

  const [searchText, setSearchText] = useState('');
  const [pageSize, setPageSize] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);

  const [imageViewerOpen, setImageViewerOpen] = useState(false);
  const [imageViewerList, setImageViewerList] = useState([]);
  const [imageViewerIndex, setImageViewerIndex] = useState(0);

  // --- Estados PDF y Selección ---
  const [isPdfModalVisible, setIsPdfModalVisible] = useState(false);
  const [pdfStep, setPdfStep] = useState('selection'); 
  const [pdfData, setPdfData] = useState([]);
  const [tempSelections, setTempSelections] = useState({}); 
  const [recordSelections, setRecordSelections] = useState({}); 
  const [isSavingSelection, setIsSavingSelection] = useState(false);
  const [pdfLayout, setPdfLayout] = useState('2x4');


  /* --------- Cabecera --------- */
  useEffect(() => {
    (async () => {
      setLoadingHeader(true);
      try {
        if (monitoreoId) {
          const { data: m, error: em } = await supabase.from('monitoreos').select('id, tipo_monitoreo, proyecto_id, equipos_asignados').eq('id', monitoreoId).single();
          if (em) throw em;
          // AGREGAMOS 'descripcion'
          const { data: p } = await supabase.from('proyectos').select('id, nombre, created_at, descripcion').eq('id', m.proyecto_id).single();

          let equipos = [];
          let ids = m.equipos_asignados;
          if (typeof ids === 'string') { try { ids = JSON.parse(ids); } catch { ids = []; } }
          if (Array.isArray(ids) && ids.length) {
            const { data: eq } = await supabase.from('equipos').select('id, nombre_equipo, modelo, serie').in('id', ids);
            equipos = eq || [];
          }

          setHeaderInfo((h) => ({
            ...h,
            empresa: p?.nombre || '—',
            fecha: p?.created_at ? dayjs(p.created_at).format('DD/MM/YYYY') : '—',
            equipo: equipos.length ? equipos.map(e => e.nombre_equipo || 's/n').join(', ') : '',
            modelos: equipos.length ? equipos.map(e => e.modelo || 's/n').join(', ') : '',
            series: equipos.length ? equipos.map(e => e.serie || 's/n').join(', ') : '',
            tipo_monitoreo: m.tipo_monitoreo,
            descripcion_proyecto: p?.descripcion || ''
          }));
        } else if (projectId) {
          const { data: p } = await supabase.from('proyectos').select('id, nombre, created_at, descripcion').eq('id', projectId).single();
          setHeaderInfo((h) => ({
            ...h,
            empresa: p?.nombre || '—',
            fecha: p?.created_at ? dayjs(p.created_at).format('DD/MM/YYYY') : '—',
            descripcion_proyecto: p?.descripcion || ''
          }));
        }
      } catch (e) { console.error('Header error:', e); } finally { setLoadingHeader(false); }
    })();
  }, [projectId, monitoreoId]);

  /* --------- Traer filas (incluye selected_image_index) --------- */
  const fetchRows = async (isBackground = false) => {
    if (!isBackground) setLoading(true);
    try {
      // Agregamos 'selected_image_index' al select si no estaba
      let q = supabase.from(TABLE_NAME).select('*').order('inserted_at', { ascending: true });

      if (monitoreoId && projectId) { q = q.or(`monitoreo_id.eq.${monitoreoId},proyecto_id.eq.${projectId}`); }
      else if (monitoreoId) { q = q.eq('monitoreo_id', monitoreoId); }
      else if (projectId) { q = q.eq('proyecto_id', projectId); }

      const { data, error } = await q;
      if (error) throw error;

      const mapped = (data || []).map((r) => {
        let imageUrls = [];
        if (Array.isArray(r.image_urls)) imageUrls = r.image_urls;
        else if (typeof r.image_urls === 'string' && r.image_urls.trim() !== '') {
          try {
              const parsed = JSON.parse(r.image_urls);
              if(Array.isArray(parsed)) imageUrls = parsed;
              else imageUrls = r.image_urls.split(',').map((s) => s.trim());
          } catch {
              imageUrls = r.image_urls.split(',').map((s) => s.trim());
          }
        }
        return { ...r, image_urls: imageUrls };
      });

      setRows(mapped);
      setCurrentPage(1);

      if (mapped.length && mapped[0].measured_at) {
        const raw = String(mapped[0].measured_at);
        const [yyyy, mm, dd] = raw.slice(0, 10).split('-');
        setHeaderInfo((h) => ({ ...h, fecha: `${dd}/${mm}/${yyyy}` }));
      }

      const ids = Array.from(new Set(mapped.map(m => m.created_by).filter(Boolean)));
      if (ids.length) {
        const { data: profs } = await supabase.from('profiles').select('id, username, nombre_completo').in('id', ids);
        const dict = {};
        (profs || []).forEach((u) => { dict[u.id] = u.nombre_completo || u.username || u.id; });
        setUsersById(dict);
      } else { setUsersById({}); }
    } catch (e) { console.error('Fetch error:', e); message.error('No se pudo cargar Vibración.'); setRows([]); }
    finally { if (!isBackground) setLoading(false); }
  };

  useEffect(() => {
    fetchRows();
    const ch = supabase.channel('rt-vibracion').on('postgres_changes', { event: '*', schema: 'public', table: TABLE_NAME }, () => fetchRows(true)).subscribe();
    return () => supabase.removeChannel(ch);
  }, [projectId, monitoreoId]);

  /* ================ LÓGICA PDF Y SELECCIÓN ================ */
  const handlePrevImage = (regId, total) => { setTempSelections(prev => ({ ...prev, [regId]: (prev[regId] - 1 + total) % total })); };
  const handleNextImage = (regId, total) => { setTempSelections(prev => ({ ...prev, [regId]: (prev[regId] + 1) % total })); };
  const handleRecordSelectionToggle = (recordId) => { setRecordSelections(prev => ({ ...prev, [recordId]: !prev[recordId] })); };
  const handleSelectAllRecords = () => { const allSelected = {}; rows.filter(r => getImagesArray(r).length > 0).forEach(r => { allSelected[r.id] = true; }); setRecordSelections(allSelected); };
  const handleDeselectAllRecords = () => { const allDeselected = {}; rows.filter(r => getImagesArray(r).length > 0).forEach(r => { allDeselected[r.id] = false; }); setRecordSelections(allDeselected); };

  const handleOpenPdf = () => {
    const registrosConFotos = rows.filter(r => getImagesArray(r).length > 0);
    if (registrosConFotos.length === 0) { message.warning("No hay registros con imágenes."); return; }
    const initialSelections = {};
    const initialRecordSelections = {};
    registrosConFotos.forEach(r => {
        const imgs = getImagesArray(r);
        const savedIndex = r.selected_image_index || 0;
        initialSelections[r.id] = savedIndex < imgs.length ? savedIndex : 0;
        initialRecordSelections[r.id] = true;
    });
    setTempSelections(initialSelections);
    setRecordSelections(initialRecordSelections);
    setPdfStep('selection');
    setIsPdfModalVisible(true);
  };

  const handleSaveAndGenerate = async () => {
    setIsSavingSelection(true);
    const loadingMsg = message.loading("Generando reporte...", 0);
    try {
        const registrosConFotos = rows.filter(r => getImagesArray(r).length > 0);
        const registrosSeleccionados = registrosConFotos.filter(r => recordSelections[r.id] === true);
        if (registrosSeleccionados.length === 0) { message.warning("No ha seleccionado ningún registro."); setIsSavingSelection(false); loadingMsg(); return; }

        const supabaseTasks = [];
        const dataForPdf = [];
        let i = 0;

        for (const r of registrosSeleccionados) {
            const imgs = getImagesArray(r);
            const selectedIdx = tempSelections[r.id] !== undefined ? tempSelections[r.id] : 0;
            const finalIdx = selectedIdx < imgs.length ? selectedIdx : 0;
            const originalUrl = imgs[finalIdx];
            const codigo = `VIB-${String(i + 1).padStart(2, '0')}`;

            dataForPdf.push({
                imageUrl: originalUrl,
                area: r.area_trabajo || 'N/A', // En Vibración se usa 'area_trabajo'
                puesto: r.puesto_trabajo,
                codigo: codigo,
                fechaHora: `${formatFechaUTC(r.measured_at)} - ${formatHoraUTC(r.measured_at)}`
            });

            supabaseTasks.push(
                supabase.from(TABLE_NAME).update({ selected_image_index: finalIdx }).eq('id', r.id)
            );
            i++;
        }

        await Promise.all(supabaseTasks);
        fetchRows(true); 
        setPdfData(dataForPdf);
        setPdfStep('view'); 
        message.success("Reporte generado");
    } catch (error) { console.error("Error generando PDF:", error); message.error("Ocurrió un error inesperado."); } 
    finally { loadingMsg(); setIsSavingSelection(false); }
  };

  /* --------- CRUD --------- */
  const handleAdd = () => { setSelected(null); setIsFormOpen(true); };
  const handleEdit = (rec) => { setSelected(rec); setIsFormOpen(true); };
  const handleDelete = (rec) => {
    Modal.confirm({
      title: '¿Eliminar registro?',
      icon: <ExclamationCircleOutlined />,
      content: `Se eliminará el registro de "${rec.puesto_trabajo || '—'}"`,
      okText: 'Eliminar', okType: 'danger', cancelText: 'Cancelar',
      onOk: async () => {
        try {
          const { error } = await supabase.from(TABLE_NAME).delete().eq('id', rec.id);
          if (error) throw error;
          message.success('Eliminado.');
        } catch (e) { message.error('No se pudo eliminar.'); }
      }
    });
  };

  const onOkForm = () => (selected ? doEdit() : doAdd());
  const onCancelForm = () => setIsFormOpen(false);

  const payloadFromValues = (values) => {
    let measuredAt = null;
    if (values.horario) {
      const h = values.horario.hour();
      const m = values.horario.minute();
      const base = selected?.measured_at ? dayjs(selected.measured_at) : dayjs();
      const local = base.hour(h).minute(m).second(0).millisecond(0);
      measuredAt = local.format('YYYY-MM-DD[T]HH:mm:ssZ');
    } else if (selected?.measured_at) { measuredAt = selected.measured_at; }

    let imageUrls = null;
    if (values.image_urls && values.image_urls.trim() !== '') {
      imageUrls = values.image_urls.split(',').map(s => s.trim()).filter(Boolean);
    }

    return {
      proyecto_id: projectId || null,
      monitoreo_id: monitoreoId || null,
      measured_at: measuredAt,
      area_trabajo: values.area_trabajo || null,
      puesto_trabajo: values.puesto_trabajo || null,
      trabajador_evaluado: values.trabajador_evaluado || null,
      maquina_equipo: values.maquina_equipo || null,
      duracion_jornada_h: toNumberOrString(values.duracion_jornada_h),
      tiempo_expos_h: toNumberOrString(values.tiempo_expos_h),
      postura: values.postura || null,
      postura_otro: values.postura_otro || null,
      duracion_prueba_min: toNumberOrString(values.duracion_prueba_min),
      tipo: values.tipo || null,
      ub_acelerometro: values.ub_acelerometro || null,
      aeqx_ce: toNumberOrString(values.aeqx_ce),
      aeqy_ce: toNumberOrString(values.aeqy_ce),
      aeqz_ce: toNumberOrString(values.aeqz_ce),
      mano_afectada: values.mano_afectada || null,
      aeqx_mb: toNumberOrString(values.aeqx_mb),
      aeqy_mb: toNumberOrString(values.aeqy_mb),
      aeqz_mb: toNumberOrString(values.aeqz_mb),
      observaciones: values.observaciones || null,
      image_urls: imageUrls,
      location: values.location || null,
    };
  };

  const doAdd = async () => {
    setSaving(true);
    try {
      const values = await form.validateFields();
      const payload = payloadFromValues(values);
      const { error } = await supabase.from(TABLE_NAME).insert(payload);
      if (error) throw error;
      message.success('Registro agregado.');
      setIsFormOpen(false);
    } catch (e) { console.error(e); message.error('No se pudo agregar: ' + e.message); } 
    finally { setSaving(false); }
  };

  const doEdit = async () => {
    setSaving(true);
    try {
      const values = await form.validateFields();
      const payload = payloadFromValues(values);
      const { error } = await supabase.from(TABLE_NAME).update(payload).eq('id', selected.id);
      if (error) throw error;
      message.success('Registro actualizado.');
      setIsFormOpen(false);
    } catch (e) { console.error(e); message.error('No se pudo actualizar: ' + e.message); } 
    finally { setSaving(false); }
  };

  /* --------- Filtro / Paginación --------- */
  const filtered = useMemo(() => {
    if (!searchText) return rows;
    const s = searchText.toLowerCase();
    return rows.filter(r => (
      (r.area_trabajo && r.area_trabajo.toLowerCase().includes(s)) ||
      (r.puesto_trabajo && r.puesto_trabajo.toLowerCase().includes(s)) ||
      (r.trabajador_evaluado && r.trabajador_evaluado.toLowerCase().includes(s))
    ));
  }, [searchText, rows]);
  const totalFiltered = filtered.length;
  const pageData = useMemo(() => { const start = (currentPage - 1) * pageSize; return filtered.slice(start, start + pageSize); }, [filtered, currentPage, pageSize]);
  const openImageViewer = (imgs, idx = 0) => { const list = Array.isArray(imgs) ? imgs : []; if (!list.length) return; setImageViewerList(list); setImageViewerIndex(idx); setImageViewerOpen(true); };

  /* ------------------------------ Columnas ------------------------------ */
  const columns = [
    { title: 'N°', key: 'n', width: 60, render: (_, __, i) => (currentPage - 1) * pageSize + i + 1 },
    // COLUMNAS REORDENADAS: FECHA -> HORA -> AREA
    { 
      title: 'FECHA', 
      dataIndex: 'measured_at', 
      width: 120, sorter: (a, b) => dayjs(a.measured_at).unix() - dayjs(b.measured_at).unix(), 
      defaultSortOrder: 'descend', render: (v) => formatFechaUTC(v) 
    },
    { 
      title: 'HORA', 
      dataIndex: 'measured_at', 
      sorter: (a, b) => dayjs(a.measured_at).unix() - dayjs(b.measured_at).unix(),
      width: 70,render: (v) => formatHoraUTC(v),
    },
    { title: 'ÁREA DE TRABAJO', dataIndex: 'area_trabajo', key: 'area_trabajo', width: 160, ellipsis: true },
    { title: 'PUESTO DE TRABAJO', dataIndex: 'puesto_trabajo', key: 'puesto_trabajo', width: 160, ellipsis: true },
    { title: 'TRABAJADOR EVALUADO', dataIndex: 'trabajador_evaluado', key: 'trabajador_evaluado', width: 160, ellipsis: true },
    { title: 'MÁQUINA / EQUIPO', dataIndex: 'maquina_equipo', key: 'maquina_equipo', width: 160, ellipsis: true },
    { title: 'JORNADA (h)', dataIndex: 'duracion_jornada_h', key: 'duracion_jornada_h', width: 110 },
    { title: 'TE (h)', dataIndex: 'tiempo_expos_h', key: 'tiempo_expos_h', width: 90 },
    { title: 'POSTURA', key: 'postura', width: 140, render: (_, r) => posturaDisplay(r.postura, r.postura_otro) },
    { title: 'PRUEBA (min)', dataIndex: 'duracion_prueba_min', key: 'duracion_prueba_min', width: 120 },
    { title: 'TIPO', dataIndex: 'tipo', key: 'tipo', width: 130 },
    { title: 'CUERPO ENTERO', children: [ { title: 'Ubicación', dataIndex: 'ub_acelerometro', width: 160 }, { title: 'AeqX', dataIndex: 'aeqx_ce', width: 90 }, { title: 'AeqY', dataIndex: 'aeqy_ce', width: 90 }, { title: 'AeqZ', dataIndex: 'aeqz_ce', width: 90 } ] },
    { title: 'MANO-BRAZO', children: [ { title: 'Mano', dataIndex: 'mano_afectada', width: 110 }, { title: 'AeqX', dataIndex: 'aeqx_mb', width: 90 }, { title: 'AeqY', dataIndex: 'aeqy_mb', width: 90 }, { title: 'AeqZ', dataIndex: 'aeqz_mb', width: 90 } ] },
    { title: 'COORDENADAS UTM', dataIndex: 'location', key: 'location', width: 240, render: (v) => renderLocation(v) },
    { title: 'IMÁGENES', dataIndex: 'image_urls', key: 'image_urls', width: 140, render: (imgs) => { const list = Array.isArray(imgs) ? imgs : []; if (!list.length) return <Text type="secondary">Ninguna</Text>; return ( <Button type="link" icon={<EyeOutlined />} onClick={() => openImageViewer(list, 0)} size="small"> Ver imagen </Button> ); } },
    { title: 'OBSERVACIÓN', dataIndex: 'observaciones', key: 'observaciones', width: 240, ellipsis: true },
    { title: 'Registrado por', dataIndex: 'created_by', key: 'created_by', width: 190, fixed: 'right', render: (v) => usersById[v] || v },
    { title: 'Acciones', key: 'acciones', fixed: 'right', width: 120, render: (_, record) => ( <Space size="small"> <Tooltip title="Editar"> <Button icon={<EditOutlined />} onClick={() => handleEdit(record)} /> </Tooltip> <Tooltip title="Eliminar"> <Button danger icon={<DeleteOutlined />} onClick={() => handleDelete(record)} /> </Tooltip> </Space> ) },
  ];

  /* --------- DESCARGAR TODAS LAS IMÁGENES EN ZIP (NUEVO) --------- */
  const downloadAllImages = async () => {
    try {
      // Reunir todas las URLs de todas las filas
      const allUrls = [];
      rows.forEach((r) => {
        const imgs = getImagesArray(r);
        imgs.forEach((u) => allUrls.push(u));
      });

      if (!allUrls.length) {
        message.warning('No hay imágenes registradas en este monitoreo.');
        return;
      }

      message.loading({
        content: 'Preparando descarga de imágenes...',
        key: 'zipVibracion',
        duration: 0
      });

      const uniqueUrls = Array.from(new Set(allUrls.filter(Boolean)));
      const zip = new JSZip();
      const folder = zip.folder('vibracion');

      const downloadPromises = uniqueUrls.map(async (url, index) => {
        try {
          const resp = await fetch(url);
          if (!resp.ok) {
            console.warn('No se pudo descargar', url);
            return;
          }
          const blob = await resp.blob();
          let fileName = url.split('/').pop() || `imagen_${index + 1}.jpg`;
          fileName = fileName.split('?')[0];
          folder.file(fileName, blob);
        } catch (err) {
          console.error('Error descargando', url, err);
        }
      });

      await Promise.all(downloadPromises);
      const content = await zip.generateAsync({ type: 'blob' });

      const empresaSafe = (headerInfo.empresa || 'empresa')
        .replace(/[^\w\-]+/g, '_')
        .substring(0, 40);
      const fechaSafe = (headerInfo.fecha || '').replace(/[^\d]/g, '');
      const zipName = `vibracion_imagenes_${empresaSafe}_${fechaSafe || 'monitoreo'}.zip`;

      saveAs(content, zipName);

      message.success({
        content: 'Descarga lista.',
        key: 'zipVibracion'
      });
    } catch (err) {
      console.error(err);
      message.error({
        content: 'No se pudieron descargar las imágenes.',
        key: 'zipVibracion'
      });
    }
  };

  return (
    <>
      <Breadcrumb style={{ margin: '16px 0' }}>
        <Breadcrumb.Item><Link to="/"><HomeOutlined /></Link></Breadcrumb.Item>
        <Breadcrumb.Item><Link to="/proyectos">Proyectos</Link></Breadcrumb.Item>
        <Breadcrumb.Item><Link to={`/proyectos/${projectId}/monitoreo`}><DatabaseOutlined /> Monitoreos</Link></Breadcrumb.Item>
        <Breadcrumb.Item>Vibración</Breadcrumb.Item>
      </Breadcrumb>

      <Row justify="space-between" align="middle" style={{ marginBottom: 8 }}>
        <Col><Title level={2} style={{ color: PRIMARY_BLUE, marginBottom: 0 }}>Monitoreo de Vibraciones</Title></Col>
        <Col>
          <Space>
            <Button onClick={() => navigate(`/proyectos/${projectId}/monitoreo`)}><ArrowLeftOutlined /> Volver a Monitoreos</Button>
            {/* NUEVO: botón para descargar todas las imágenes en ZIP */}
            <Button onClick={downloadAllImages}>Descargar Imágenes</Button>
            <Button icon={<FileExcelOutlined />} onClick={() => exportToExcel(rows, headerInfo)}>Exportar a Excel</Button>
            <Button icon={<FilePdfOutlined />} onClick={handleOpenPdf} style={{ backgroundColor: '#ff4d4f', color: 'white', borderColor: '#ff4d4f' }}>Reporte Fotos</Button>
            <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>Agregar</Button>
          </Space>
        </Col>
      </Row>

      <Row justify="space-between" align="middle" style={{ marginBottom: 12, gap: 15 }}>
        <Col flex="0 0 520px"><Input.Search allowClear placeholder="Buscar..." value={searchText} onChange={(e) => { setSearchText(e.target.value); setCurrentPage(1); }} /></Col>
        <Col><Space><Text type="secondary">Ver:</Text><Select value={pageSize} onChange={(val) => { setPageSize(val); setCurrentPage(1); }} style={{ width: 90 }} ><Option value={5}>5</Option><Option value={10}>10</Option><Option value={20}>20</Option><Option value={50}>50</Option></Select><Text type="secondary">registros</Text></Space></Col>
      </Row>

      <Spin spinning={loadingHeader}>
        <Descriptions bordered size="small" column={2} style={{ marginBottom: 15 }}>
          <Descriptions.Item label="NOMBRE DE LA EMPRESA">{headerInfo.empresa}</Descriptions.Item>
          <Descriptions.Item label="FECHA DE MONITOREO">{headerInfo.fecha}</Descriptions.Item>
          <Descriptions.Item label="EQUIPO">{headerInfo.equipo}</Descriptions.Item>
          <Descriptions.Item label="MODELO DEL EQUIPO">{headerInfo.modelos}</Descriptions.Item>
          <Descriptions.Item label="SERIE DEL EQUIPO">{headerInfo.series}</Descriptions.Item>
        </Descriptions>
      </Spin>

      <Spin spinning={loading}>
        <div style={{ overflowX: 'auto' }}>
          <Table 
                className='tabla-general'
                size="small" 
                columns={columns} 
                dataSource={pageData} 
                rowKey="id" pagination={false} scroll={{ x: 'max-content' }} />
        </div>
      </Spin>

      <Row justify="space-between" align="middle" style={{ marginTop: 12 }}>
        <Col>{(() => { const mostrados = Math.min(currentPage * pageSize, totalFiltered); return <Text type="secondary">Registros {mostrados} de {totalFiltered}</Text>; })()}</Col>
        <Col><Pagination current={currentPage} pageSize={pageSize} total={totalFiltered} onChange={(p) => setCurrentPage(p)} size="small" showSizeChanger={false} /></Col>
      </Row>

      {/* Modal formulario */}
      <Modal title={selected ? 'Editar registro de Vibración' : 'Agregar registro de Vibración'} open={isFormOpen} onOk={onOkForm} onCancel={onCancelForm} confirmLoading={saving} destroyOnClose width={980}>
        <Form form={form} layout="vertical" key={selected ? `edit-${selected.id}` : 'add'} preserve={false}
          initialValues={selected ? { ...selected, horario: selected?.measured_at ? dayjs(selected.measured_at).utc() : null, image_urls: Array.isArray(selected.image_urls) ? selected.image_urls.join(', ') : (selected.image_urls || ''), location: selected.location || '' } : {}}
        >
          <Row gutter={12}>
            <Col span={6}><Form.Item name="horario" label="Hora de medición" rules={[{ required: true }]}><TimePicker format="HH:mm" style={{ width: '100%' }} /></Form.Item></Col>
            <Col span={9}><Form.Item name="area_trabajo" label="Área de trabajo" rules={[{ required: true }]}><Input /></Form.Item></Col>
            <Col span={9}><Form.Item name="puesto_trabajo" label="Puesto de trabajo" rules={[{ required: true }]}><Input /></Form.Item></Col>
          </Row>
          {/* ... Resto de campos igual que antes (omitido para brevedad) ... */}
          {/* Asegurate de incluir los campos: trabajador_evaluado, maquina_equipo, duracion_jornada_h, tiempo_expos_h, postura, duracion_prueba_min, tipo, ub_acelerometro, aeq..., mano_afectada, image_urls, location, observaciones */}
          <Row gutter={12}><Col span={8}><Form.Item name="trabajador_evaluado" label="Trabajador evaluado"><Input /></Form.Item></Col><Col span={8}><Form.Item name="maquina_equipo" label="Máquina / Equipo"><Input /></Form.Item></Col><Col span={4}><Form.Item name="duracion_jornada_h" label="Jornada (h)"><InputNumber step={0.1} min={0} style={{ width: '100%' }} /></Form.Item></Col><Col span={4}><Form.Item name="tiempo_expos_h" label="TE (h)"><InputNumber step={0.1} min={0} style={{ width: '100%' }} /></Form.Item></Col></Row>
          <Row gutter={12}><Col span={8}><Form.Item name="postura" label="Postura del evaluado" rules={[{ required: true }]}><Select placeholder="Seleccione"><Option value="Sentado">Sentado</Option><Option value="De pie">De pie</Option><Option value="Otro">Otro</Option></Select></Form.Item></Col><Col span={8}><Form.Item name="postura_otro" label="Postura (Otro)"><Input placeholder="Si seleccionó 'Otro', especifique" /></Form.Item></Col><Col span={8}><Form.Item name="duracion_prueba_min" label="Duración de la prueba (min)"><InputNumber step={1} min={0} style={{ width: '100%' }} /></Form.Item></Col></Row>
          <Row gutter={12}><Col span={8}><Form.Item name="tipo" label="Tipo de monitoreo" rules={[{ required: true }]}><Select placeholder="Seleccione"><Option value="cuerpo_entero">Cuerpo entero</Option><Option value="mano_brazo">Mano-brazo</Option></Select></Form.Item></Col><Col span={8}><Form.Item name="ub_acelerometro" label="Ubicación del acelerómetro"><Select placeholder="Seleccione o escriba" allowClear showSearch><Option value="base_asiento">Base asiento</Option><Option value="espaldar_asiento">Espaldar asiento</Option><Option value="volante">Volante</Option><Option value="maneral">Maneral</Option></Select></Form.Item></Col><Col span={8}><Form.Item name="mano_afectada" label="Mano más afectada"><Select allowClear placeholder="Seleccione"><Option value="Derecha">Derecha</Option><Option value="Izquierda">Izquierda</Option><Option value="Ambas">Ambas</Option></Select></Form.Item></Col></Row>
          <Row gutter={12}><Col span={8}><Form.Item name="aeqx_ce" label="AeqX Cuerpo entero (m/s²)"><InputNumber step={0.01} min={0} style={{ width: '100%' }} /></Form.Item></Col><Col span={8}><Form.Item name="aeqy_ce" label="AeqY Cuerpo entero (m/s²)"><InputNumber step={0.01} min={0} style={{ width: '100%' }} /></Form.Item></Col><Col span={8}><Form.Item name="aeqz_ce" label="AeqZ Cuerpo entero (m/s²)"><InputNumber step={0.01} min={0} style={{ width: '100%' }} /></Form.Item></Col></Row>
          <Row gutter={12}><Col span={8}><Form.Item name="aeqx_mb" label="AeqX Mano-brazo (m/s²)"><InputNumber step={0.01} min={0} style={{ width: '100%' }} /></Form.Item></Col><Col span={8}><Form.Item name="aeqy_mb" label="AeqY Mano-brazo (m/s²)"><InputNumber step={0.01} min={0} style={{ width: '100%' }} /></Form.Item></Col><Col span={8}><Form.Item name="aeqz_mb" label="AeqZ Mano-brazo (m/s²)"><InputNumber step={0.01} min={0} style={{ width: '100%' }} /></Form.Item></Col></Row>
          <Form.Item name="image_urls" label="Imagen(es) URL (separadas por coma)"><Input.TextArea rows={2} /></Form.Item>
          <Form.Item name="location" label="COORDENADAS UTM (texto/JSON)"><Input /></Form.Item>
          <Form.Item name="observaciones" label="Observaciones"><Input.TextArea rows={3} /></Form.Item>
        </Form>
      </Modal>

      <Modal open={imageViewerOpen} onCancel={() => setImageViewerOpen(false)} footer={imageViewerList.length > 1 ? [<Button key="prev" onClick={() => setImageViewerIndex((prev) => (prev - 1 + imageViewerList.length) % imageViewerList.length)}>Anterior</Button>,<Button key="next" type="primary" onClick={() => setImageViewerIndex((prev) => (prev + 1) % imageViewerList.length)}>Siguiente</Button>] : null} width={720} title="Imagen del registro">
        {imageViewerList.length ? (<div style={{ textAlign: 'center' }}><img src={imageViewerList[imageViewerIndex]} alt="registro" style={{ maxWidth: '100%', maxHeight: '60vh', objectFit: 'contain' }} /><div style={{ marginTop: 8 }}>{imageViewerIndex + 1} / {imageViewerList.length}</div></div>) : (<Text type="secondary">Sin imagen.</Text>)}
      </Modal>

      {/* === MODAL DE PDF (NUEVO) === */}
      <Modal title={pdfStep === 'selection' ? "Seleccionar Imágenes" : "Vista Previa PDF"} open={isPdfModalVisible} onCancel={() => setIsPdfModalVisible(false)} width={1000} style={{ top: 20 }}
          footer={ pdfStep === 'selection' ? (
                <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Text strong>Distribución:</Text>
                        <Select defaultValue="2x4" style={{ width: 120 }} onChange={setPdfLayout}>
                            <Option value="2x4">2 x 4</Option><Option value="2x3">2 x 3</Option><Option value="3x3">3 x 3</Option><Option value="3x4">3 x 4</Option>
                        </Select>
                    </div>
                    <Button type="primary" icon={<SaveOutlined />} onClick={handleSaveAndGenerate} loading={isSavingSelection}>Guardar y Generar PDF</Button>
                </div>
            ) : (<Button onClick={() => setPdfStep('selection')}><ArrowLeftOutlined /> Volver a Monitoreos</Button>) }
      >
          <div style={{ height: '75vh', overflowY: 'auto', overflowX: 'hidden' }}>
              {pdfStep === 'selection' && (
                  <>
                    <div style={{ marginBottom: 16, paddingBottom: 16, borderBottom: '1px solid #f0f0f0', display: 'flex', justifyContent: 'center', gap: 16 }}>
                        <Button size="small" onClick={handleSelectAllRecords}>Seleccionar Todos</Button>
                        <Button size="small" onClick={handleDeselectAllRecords}>Deseleccionar Todos</Button>
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', justifyContent: 'center' }}>
                      {rows.filter(r => getImagesArray(r).length > 0).map((r) => {
                          const imgs = getImagesArray(r);
                          const currentIdx = tempSelections[r.id] || 0;
                          const isSelected = recordSelections[r.id] === true;
                          return (
                              <div key={r.id} style={{ width: '23%', border: isSelected ? '1px solid #ddd' : '1px dashed #999', opacity: isSelected ? 1 : 0.5, padding: '8px', borderRadius: '8px', display: 'flex', flexDirection: 'column', alignItems: 'center', backgroundColor: '#fafafa', position: 'relative' }}>
                                  <Checkbox checked={isSelected} onChange={() => handleRecordSelectionToggle(r.id)} style={{ position: 'absolute', top: 5, right: 5, zIndex: 20 }} />
                                  <Text strong style={{ fontSize: 12 }}>{headerInfo.tipo_monitoreo}</Text>
                                  <div style={{ position: 'relative', width: '100%', height: '150px', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff', border: '1px solid #eee', marginTop: 5 }}>
                                      {imgs.length > 1 && <Button shape="circle" icon={<LeftOutlined />} size="small" style={{ position: 'absolute', left: 5 }} onClick={() => handlePrevImage(r.id, imgs.length)} />}
                                      <img src={imgs[currentIdx]} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
                                      {imgs.length > 1 && <Button shape="circle" icon={<RightOutlined />} size="small" style={{ position: 'absolute', right: 5 }} onClick={() => handleNextImage(r.id, imgs.length)} />}
                                      {imgs.length > 1 && <span style={{ position: 'absolute', bottom: 2, right: 5, fontSize: 10, background: 'rgba(255,255,255,0.7)' }}>{currentIdx + 1}/{imgs.length}</span>}
                                  </div>
                                  <Text style={{ fontSize: 11, marginTop: 5 }}>{r.puesto_trabajo}</Text>
                              </div>
                          );
                      })}
                    </div>
                  </>
              )}
              {pdfStep === 'view' && (
                  <PDFViewer width="100%" height="100%" showToolbar={true}>
                      <ReporteFotografico 
                          data={pdfData} 
                          empresa={headerInfo.descripcion_proyecto || 'SIN DESCRIPCIÓN'} 
                          layout={pdfLayout}
                          tituloMonitoreo={headerInfo.tipo_monitoreo || 'Vibración'} 
                          descripcionProyecto={''}
                      />
                  </PDFViewer>
              )}
          </div>
      </Modal>
    </>
  );
};

export default VibracionPage;
