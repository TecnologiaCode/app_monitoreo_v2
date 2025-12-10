// src/pages/RuidoPage.jsx

import React, { useState, useEffect, useMemo } from 'react';
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
  Popover,
  Tag,
  Breadcrumb,
  TimePicker,
  Row,
  Col,
  Descriptions,
  Pagination,
  Switch,
  Checkbox,
  Divider
} from 'antd';

import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  HomeOutlined,
  DatabaseOutlined,
  LineChartOutlined,
  ExclamationCircleOutlined,
  ArrowLeftOutlined,
  ClockCircleOutlined,
  EyeOutlined,
  DeleteOutlined as DeleteIcon,
  FileExcelOutlined,
  FilePdfOutlined,
  SaveOutlined,
  LeftOutlined,
  RightOutlined
} from '@ant-design/icons';

import { useParams, Link, useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient.js';
import dayjs from 'dayjs';
import 'dayjs/locale/es';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import * as XLSX from 'xlsx';

// ► NUEVO: librerías para descargar todas las imágenes en ZIP
import JSZip from 'jszip';
import { saveAs } from 'file-saver';

// IMPORTS DEL REPORTE
import { PDFViewer } from '@react-pdf/renderer';
import { ReporteFotografico } from '../components/ReporteFotografico';

dayjs.locale('es');
dayjs.extend(utc);
dayjs.extend(timezone);

const { Title, Text } = Typography;
const { Option } = Select;

const MEDICIONES_TABLE_NAME = 'ruido';
const PRIMARY_BLUE = '#2a8bb6';

/* =========================================================
   Helpers
   ========================================================= */

const formatHoraUTC = (v) => {
  if (!v) return '';
  try {
    return dayjs(v).utc().format('HH:mm');
  } catch {
    return String(v);
  }
};

const formatFechaUTC = (v) => {
  if (!v) return '';
  try {
    return dayjs(v).utc().format('DD/MM/YYYY');
  } catch {
    return String(v);
  }
};
/* ========================= HELPERS ========================= */

const calculateAverage = (arr) => {
  const nums = (arr || [])
    .map((v) => (v === null || v === undefined || v === '' ? null : Number(String(v).replace(',', '.'))))
    .filter((n) => typeof n === 'number' && !Number.isNaN(n));
  if (!nums.length) return 0;
  const sum = nums.reduce((a, b) => a + b, 0);
  return (sum / nums.length).toFixed(1);
};

const parseFlexibleArray = (val) => {
  if (!val) return [];
  if (Array.isArray(val)) return val;
  if (typeof val === 'string') {
    const s = val.trim();
    if (s.startsWith('[') && s.endsWith(']')) {
      try {
        const arr = JSON.parse(s);
        return Array.isArray(arr) ? arr : [];
      } catch {
        return [];
      }
    }
    if (s.startsWith('{') && s.endsWith('}')) {
      const inner = s.slice(1, -1).trim();
      if (!inner) return [];
      return inner
        .split(',')
        .map((p) =>
          p
            .trim()
            .replace(/^"(.*)"$/, '$1')
            .replace(/^'(.*)'$/, '$1')
        );
    }
    return s.split(',').map((p) => p.trim());
  }
  return [];
};

const formatHoraExactaUTC = (value) => {
  if (!value) return '';
  const d = dayjs(value).utc();
  return d.isValid() ? d.format('HH:mm') : String(value);
};
const formatFechaExactaUTC = (value) => {
  if (!value) return '';
  const d = dayjs(value).utc();
  return d.isValid() ? d.format('DD/MM/YYYY') : String(value);
};

const renderLocation = (v) => {
  if (!v) return <Text type="secondary">N/A</Text>;
  if (typeof v === 'object') {
    const lat = v.lat ?? v.latitude ?? '';
    const lng = v.lng ?? v.longitude ?? '';
    if (lat !== '' || lng !== '') return <span>lat: {lat} {lng !== '' ? `, lng: ${lng}` : ''}</span>;
    const e = v.easting ?? '';
    const n = v.northing ?? '';
    const z = v.utm_zone ?? '';
    if (e !== '' || n !== '' || z !== '') return <span>{`E: ${e}${n !== '' ? `, N: ${n}` : ''}${z ? `, Z: ${z}` : ''}`}</span>;
    if (Array.isArray(v)) return v.join(', ');
    return JSON.stringify(v);
  }
  try {
    const parsed = JSON.parse(v);
    return renderLocation(parsed);
  } catch {
    return <span>{String(v)}</span>;
  }
};

// Helper para obtener array de imagenes limpio
const getImagesArray = (reg) => {
  if (Array.isArray(reg.image_urls)) return reg.image_urls;
  if (typeof reg.image_urls === 'string' && reg.image_urls.trim() !== '') {
    try {
      const parsed = JSON.parse(reg.image_urls);
      if (Array.isArray(parsed)) return parsed;
      return [reg.image_urls];
    } catch {
      return reg.image_urls.split(',').map(s => s.trim());
    }
  }
  return [];
};

/* ========================= PÁGINA ========================= */
const RuidoPage = () => {
  const { projectId, monitoreoId: mId, id } = useParams();
  const monitoreoId = mId || id;
  const navigate = useNavigate();
  const [form] = Form.useForm();

  // --- Estados de Datos ---
  const [monitoreoInfo, setMonitoreoInfo] = useState(null);
  const [proyectoInfo, setProyectoInfo] = useState(null);
  const [equiposInfo, setEquiposInfo] = useState([]);
  const [mediciones, setMediciones] = useState([]);

  // --- Estados de UI ---
  const [loadingHeader, setLoadingHeader] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isFormModalVisible, setIsFormModalVisible] = useState(false);
  const [selectedMedicion, setSelectedMedicion] = useState(null);

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

  const [searchText, setSearchText] = useState('');
  const [pageSize, setPageSize] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);
  const [usersById, setUsersById] = useState({});

  /* ================ LÓGICA PDF Y SELECCIÓN ================ */

  const handlePrevImage = (regId, total) => {
    setTempSelections(prev => ({ ...prev, [regId]: (prev[regId] - 1 + total) % total }));
  };

  const handleNextImage = (regId, total) => {
    setTempSelections(prev => ({ ...prev, [regId]: (prev[regId] + 1) % total }));
  };

  const handleRecordSelectionToggle = (recordId) => {
    setRecordSelections(prev => ({ ...prev, [recordId]: !prev[recordId] }));
  };

  const handleSelectAllRecords = () => {
    const allSelected = {};
    mediciones.filter(r => getImagesArray(r).length > 0).forEach(r => { allSelected[r.id] = true; });
    setRecordSelections(allSelected);
  };

  const handleDeselectAllRecords = () => {
    const allDeselected = {};
    mediciones.filter(r => getImagesArray(r).length > 0).forEach(r => { allDeselected[r.id] = false; });
    setRecordSelections(allDeselected);
  };

  const handleOpenPdf = () => {
    const registrosConFotos = mediciones.filter(r => getImagesArray(r).length > 0);
    if (registrosConFotos.length === 0) {
      message.warning("No hay registros con imágenes.");
      return;
    }
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

  // GUARDAR Y GENERAR (Versión Rápida)
  const handleSaveAndGenerate = async () => {
    setIsSavingSelection(true);
    const loadingMsg = message.loading("Generando reporte...", 0);

    try {
      const registrosConFotos = mediciones.filter(r => getImagesArray(r).length > 0);
      const registrosSeleccionados = registrosConFotos.filter(r => recordSelections[r.id] === true);

      if (registrosSeleccionados.length === 0) {
        message.warning("No ha seleccionado ningún registro.");
        setIsSavingSelection(false);
        loadingMsg();
        return;
      }

      const supabaseTasks = [];
      const dataForPdf = [];
      let i = 0;

      for (const r of registrosSeleccionados) {
        const imgs = getImagesArray(r);
        const selectedIdx = tempSelections[r.id] !== undefined ? tempSelections[r.id] : 0;
        const finalIdx = selectedIdx < imgs.length ? selectedIdx : 0;
        const originalUrl = imgs[finalIdx];

        // Código secuencial RUI-01, RUI-02 (RUIDO)
        const codigo = `RUI-${String(i + 1).padStart(2, '0')}`;

        dataForPdf.push({
          imageUrl: originalUrl,
          area: r.area || 'N/A', // Usamos el campo 'area'
          puesto: r.punto_medicion,
          codigo: codigo,
          fechaHora: `${r.fecha_medicion} - ${r.hora_medicion}`
        });

        // Guardar selección en BD (tabla ruido)
        supabaseTasks.push(
          supabase.from(MEDICIONES_TABLE_NAME).update({ selected_image_index: finalIdx }).eq('id', r.id)
        );
        i++;
      }

      await Promise.all(supabaseTasks);
      fetchMediciones(true); // Refrescar silencioso

      setPdfData(dataForPdf);
      setPdfStep('view');
      message.success("Reporte generado");

    } catch (error) {
      console.error("Error generando PDF:", error);
      message.error("Ocurrió un error inesperado.");
    } finally {
      loadingMsg();
      setIsSavingSelection(false);
    }
  };

  /* ========================= CABECERA ========================= */
  const fetchProyectoInfo = async (pId) => {
    if (!pId) return;
    try {
      // AGREGAMOS 'descripcion' AL SELECT
      const { data, error } = await supabase
        .from('proyectos')
        .select('id, nombre, created_at, estado, descripcion')
        .eq('id', pId)
        .single();
      if (error) throw error;
      setProyectoInfo(data);
    } catch (error) {
      console.error('Error cargando info del proyecto:', error);
      setProyectoInfo(null);
    }
  };

  const fetchEquiposInfo = async (equipoIds) => {
    if (!equipoIds) return setEquiposInfo([]);
    let ids = equipoIds;
    if (typeof ids === 'string') {
      try {
        ids = JSON.parse(ids);
      } catch {
        ids = [];
      }
    }
    if (!Array.isArray(ids) || !ids.length) return setEquiposInfo([]);
    try {
      const { data, error } = await supabase.from('equipos').select('id, nombre_equipo, modelo, serie').in('id', ids);
      if (error) throw error;
      setEquiposInfo(data || []);
    } catch (error) {
      console.error('Error cargando equipos:', error);
      setEquiposInfo([]);
    }
  };

  useEffect(() => {
    const fetchHeaderData = async () => {
      if (!monitoreoId) { setLoadingHeader(false); return; }
      setLoadingHeader(true);
      try {
        const { data, error } = await supabase.from('monitoreos').select('id, tipo_monitoreo, proyecto_id, equipos_asignados').eq('id', monitoreoId).single();
        if (error) { setMonitoreoInfo(null); }
        else {
          setMonitoreoInfo(data);
          await Promise.all([fetchProyectoInfo(data.proyecto_id), fetchEquiposInfo(data.equipos_asignados)]);
        }
      } catch (err) { console.error('Error cabecera:', err); } finally { setLoadingHeader(false); }
    };
    fetchHeaderData();
  }, [monitoreoId, projectId]);

  /* ========================= MEDICIONES ========================= */
  const fetchUsersByIds = async (ids) => {
    try {
      const { data } = await supabase.from('profiles').select('id, username, nombre_completo, email').in('id', ids);
      const dict = {};
      (data || []).forEach((u) => {
        const display =
          (u.nombre_completo && u.nombre_completo.trim()) ||
          (u.username && u.username.trim()) ||
          (u.email && u.email.trim()) ||
          u.id;
        dict[u.id] = display;
      });
      setUsersById(dict);
    } catch (err) { console.error('Error trayendo usuarios:', err); }
  };

  const fetchMediciones = async (isBackground = false) => {
    if (!isBackground) setLoading(true);
    try {
      // AGREGAMOS 'area' y 'selected_image_index' AL SELECT
      let query = supabase.from(MEDICIONES_TABLE_NAME).select('*').order('inserted_at', { ascending: true });

      if (monitoreoId) query = query.eq('monitoreo_id', monitoreoId);
      else if (projectId) query = query.eq('proyecto_id', projectId);

      let { data, error } = await query;
      if (error) throw error;

      const mapped = (data || []).map((r) => {
        const arr = parseFlexibleArray(r.mediciones_db);
        let imageUrls = [];
        if (Array.isArray(r.image_urls)) imageUrls = r.image_urls;
        else if (typeof r.image_urls === 'string' && r.image_urls.trim() !== '') {
          imageUrls = r.image_urls.split(',').map((s) => s.trim());
        }
        return {
          ...r,
          lecturas_db: arr,
          fecha_medicion: formatFechaExactaUTC(r.measured_at),
          hora_medicion: formatHoraExactaUTC(r.measured_at),
        };
      });

      setMediciones(mapped);
      setCurrentPage(1);

      const createdByIds = Array.from(new Set((mapped || []).map((m) => m.created_by).filter(Boolean)));
      if (createdByIds.length) await fetchUsersByIds(createdByIds);
      else setUsersById({});
    } catch (e) {
      console.error('Error mediciones ruido:', e);
      message.error('No se pudieron cargar las mediciones de ruido.');
      setMediciones([]);
    } finally {
      if (!isBackground) setLoading(false);
    }
  };

  useEffect(() => {
    fetchMediciones();
    const channel = supabase.channel('rt-ruido-all').on(
      'postgres_changes',
      { event: '*', schema: 'public', table: MEDICIONES_TABLE_NAME },
      () => fetchMediciones(true)
    ).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [monitoreoId, projectId]);

  /* ========================= CRUD ========================= */
  const handleAdd = () => { setSelectedMedicion(null); setIsFormModalVisible(true); };
  const handleEdit = (record) => { setSelectedMedicion(record); setIsFormModalVisible(true); };

  const handleDelete = (record) => {
    Modal.confirm({
      title: '¿Confirmar eliminación?',
      icon: <ExclamationCircleOutlined />,
      content: `Se eliminará la medición del punto "${record.punto_medicion || record.id}".`,
      okText: 'Eliminar',
      okType: 'danger',
      cancelText: 'Cancelar',
      onOk: async () => {
        try {
          const { error } = await supabase.from(MEDICIONES_TABLE_NAME).delete().eq('id', record.id);
          if (error) throw error;
          message.success('Medición eliminada.');
        } catch (err) { console.error(err); message.error('No se pudo eliminar.'); }
      },
    });
  };

  const handleFormOk = () => { selectedMedicion ? handleEditOk() : handleAddOk(); };
  const handleFormCancel = () => setIsFormModalVisible(false);

  const handleAddOk = async () => {
    setSaving(true);
    try {
      const values = await form.validateFields();

      let measuredAt = null;
      if (values.horario_medicion) {
        const h = values.horario_medicion.hour();
        const m = values.horario_medicion.minute();
        measuredAt = dayjs.utc().hour(h).minute(m).second(0).millisecond(0).toISOString();
      }

      let imageUrlsToSave = null;
      if (values.image_urls && values.image_urls.trim() !== '') {
        imageUrlsToSave = values.image_urls.split(',').map((s) => s.trim()).filter(Boolean);
      }

      const payload = {
        proyecto_id: projectId || null,
        monitoreo_id: monitoreoId || null,
        measured_at: measuredAt,
        area: values.area, // <-- CAMPO AREA GUARDADO
        punto_medicion: values.punto_medicion,
        tiempo_expos_h: values.tiempo_expos_h,
        ponderacion: values.ponderacion,
        respuesta: values.respuesta,
        mediciones_db: (values.lecturas_db || []).filter((l) => l != null),
        uso_protectores: values.uso_protectores || false,
        tipo_protector: values.tipo_protector || null,
        observaciones: values.observaciones || null,
        image_urls: imageUrlsToSave,
        location: values.location || null,
      };

      const { error } = await supabase.from(MEDICIONES_TABLE_NAME).insert(payload);
      if (error) throw error;

      message.success('Medición agregada.');
      setIsFormModalVisible(false);
    } catch (err) { console.error('Error al agregar:', err); message.error('No se pudo agregar.'); } finally { setSaving(false); }
  };

  const handleEditOk = async () => {
    if (!selectedMedicion) return;
    setSaving(true);
    try {
      const values = await form.validateFields();

      let measuredAt = null;
      if (values.horario_medicion) {
        const h = values.horario_medicion.hour();
        const m = values.horario_medicion.minute();
        measuredAt = dayjs.utc().hour(h).minute(m).second(0).millisecond(0).toISOString();
      }

      let imageUrlsToSave = null;
      if (values.image_urls && values.image_urls.trim() !== '') {
        imageUrlsToSave = values.image_urls.split(',').map((s) => s.trim()).filter(Boolean);
      }

      const updateData = {
        measured_at: measuredAt,
        area: values.area, // <-- CAMPO AREA ACTUALIZADO
        punto_medicion: values.punto_medicion,
        tiempo_expos_h: values.tiempo_expos_h,
        ponderacion: values.ponderacion,
        respuesta: values.respuesta,
        mediciones_db: (values.lecturas_db || []).filter((l) => l != null),
        uso_protectores: values.uso_protectores || false,
        tipo_protector: values.tipo_protector || null,
        observaciones: values.observaciones || null,
        image_urls: imageUrlsToSave,
        location: values.location || null,
      };

      const { error } = await supabase.from(MEDICIONES_TABLE_NAME).update(updateData).eq('id', selectedMedicion.id);
      if (error) throw error;

      message.success('Medición actualizada.');
      setIsFormModalVisible(false);
    } catch (err) { console.error('Error al actualizar:', err); message.error('No se pudo actualizar.'); } finally { setSaving(false); }
  };

  const setHoraActual = () => form.setFieldsValue({ horario_medicion: dayjs() });

  /* ========================= EXPORTAR A EXCEL (COMPLETO) ========================= */
  const exportToExcel = () => {
    try {
      // 1. Calcular el máximo número de lecturas para generar columnas dinámicas
      const maxLecturas = mediciones.reduce((max, m) => {
        const lects = Array.isArray(m.lecturas_db) ? m.lecturas_db : [];
        return Math.max(max, lects.length);
      }, 0);

      // 2. Estilos
      const headerBg = 'D9D9D9';
      const baseBorder = {
        top: { style: 'thin' },
        bottom: { style: 'thin' },
        left: { style: 'thin' },
        right: { style: 'thin' }
      };

      const titleStyle = {
        font: { bold: true },
        alignment: { vertical: 'center', horizontal: 'left' }
      };
      const headerCenterStyle = {
        font: { bold: true },
        alignment: { vertical: 'center', horizontal: 'center', wrapText: true },
        fill: { fgColor: { rgb: headerBg } },
        border: baseBorder
      };

      const cellCenter = {
        alignment: { vertical: 'center', horizontal: 'center', wrapText: true },
        border: baseBorder
      };
      const cellLeft = {
        alignment: { vertical: 'center', horizontal: 'left', wrapText: true },
        border: baseBorder
      };

      // 3. Datos de Cabecera (Metadatos)
      const headerInstalacion = proyectoInfo?.nombre || '';
      const first = mediciones && mediciones.length ? mediciones[0] : null;
      const headerFechaInicio = first?.measured_at
        ? formatFechaExactaUTC(first.measured_at)
        : (proyectoInfo?.created_at ? dayjs(proyectoInfo.created_at).format('DD/MM/YYYY') : '');

      const headerEquipos = (equiposInfo && equiposInfo.length) ? equiposInfo.map((e) => e.nombre_equipo || 's/n').join(', ') : '';
      const headerModelos = (equiposInfo && equiposInfo.length) ? equiposInfo.map((e) => e.modelo || 's/n').join(', ') : '';
      const headerSeries = (equiposInfo && equiposInfo.length) ? equiposInfo.map((e) => e.serie || 's/n').join(', ') : '';

      // 4. Construcción de filas
      const wsData = [];

      // --- Encabezado del Reporte ---
      wsData.push([
        {
          v: 'PLANILLA DE MEDICIÓN Y EVALUACIÓN DE RUIDO',
          s: {
            font: { bold: true, sz: 14 },
            alignment: { vertical: 'center', horizontal: 'center' }
          }
        }
      ]);

      // Filas de información del proyecto
      wsData.push([
        { v: 'NOMBRE DE LA EMPRESA', s: titleStyle },
        { v: headerInstalacion, s: cellLeft },
        { v: 'EQUIPO', s: titleStyle },
        { v: headerEquipos, s: cellLeft }
      ]);
      wsData.push([
        { v: 'FECHA DE INICIO', s: titleStyle },
        { v: headerFechaInicio, s: cellLeft },
        { v: 'MODELO DEL EQUIPO', s: titleStyle },
        { v: headerModelos, s: cellLeft }
      ]);
      wsData.push([
        { v: 'FECHA DE FINALIZACIÓN', s: titleStyle },
        { v: '', s: cellLeft },
        { v: 'SERIE DEL EQUIPO', s: titleStyle },
        { v: headerSeries, s: cellLeft }
      ]);
      wsData.push([
        { v: 'TIPO DE MONITOREO', s: titleStyle },
        { v: monitoreoInfo?.tipo_monitoreo || 'Ruido', s: cellLeft },
        { v: '', s: cellLeft },
        { v: '', s: cellLeft }
      ]);
      wsData.push(['']); // Espacio

      // --- Definición de Columnas (Headers) ---
      // Fijos al inicio
      const fixedHeaders = [
        { v: 'No.', s: headerCenterStyle },
        { v: 'Fecha', s: headerCenterStyle },
        { v: 'Hora', s: headerCenterStyle },
        { v: 'Área', s: headerCenterStyle }, // <--- AQUI ESTÁ EL ÁREA
        { v: 'Punto de medición', s: headerCenterStyle },
        { v: 'Tiempo Expos. (h)', s: headerCenterStyle },
        { v: 'Ponderación', s: headerCenterStyle },
        { v: 'Respuesta', s: headerCenterStyle },
      ];

      // Dinámicos (M1, M2...)
      const dynHeaders = [];
      for (let i = 1; i <= maxLecturas; i++) {
        dynHeaders.push({ v: `M${i} (dB)`, s: headerCenterStyle });
      }

      // Fijos al final (Resultados y Detalles completos)
      const tailHeaders = [
        { v: 'Min (dB)', s: headerCenterStyle },
        { v: 'Max (dB)', s: headerCenterStyle },
        { v: 'Promedio (dB)', s: headerCenterStyle },
        { v: 'Uso protectores', s: headerCenterStyle },
        { v: 'Tipo de protector', s: headerCenterStyle },
        { v: 'Ubicación', s: headerCenterStyle },     // <--- EXTRA
        { v: 'Registrado Por', s: headerCenterStyle },// <--- EXTRA
        { v: 'Observaciones', s: headerCenterStyle },
        { v: 'Imágenes (URLs)', s: headerCenterStyle } // <--- EXTRA
      ];

      // Insertar la fila de cabeceras
      wsData.push([...fixedHeaders, ...dynHeaders, ...tailHeaders]);

      // --- Llenado de Datos ---
      mediciones.forEach((m, i) => {
        // Preparar datos numéricos
        const lects = Array.isArray(m.lecturas_db) ? m.lecturas_db : [];
        const nums = lects.map((x) => Number(String(x).replace(',', '.'))).filter((n) => !Number.isNaN(n));

        // Cálculos
        const min = nums.length ? Math.min(...nums) : '';
        const max = nums.length ? Math.max(...nums) : '';
        const prom = nums.length ? (nums.reduce((a, b) => a + b, 0) / nums.length).toFixed(1) : '';

        // Preparar strings
        const usuarioNombre = usersById[m.created_by] || 'Desconocido';
        const ubicacionStr = typeof m.location === 'object' ? JSON.stringify(m.location) : (m.location || '');
        const imagenesStr = Array.isArray(m.image_urls) ? m.image_urls.join(', ') : (m.image_urls || '');

        // Construir fila
        const row = [
          { v: i + 1, s: cellCenter },
          { v: m.fecha_medicion || '', s: cellCenter },
          { v: m.hora_medicion || '', s: cellCenter },
          { v: m.area || '', s: cellLeft }, // <--- DATO AREA
          { v: m.punto_medicion || '', s: cellLeft },
          { v: m.tiempo_expos_h ?? '', s: cellCenter },
          { v: m.ponderacion || '', s: cellCenter },
          { v: m.respuesta || '', s: cellCenter },
        ];

        // Rellenar lecturas dinámicas
        for (let k = 0; k < maxLecturas; k++) {
          row.push({ v: lects[k] ?? '', s: cellCenter });
        }

        // Datos finales
        row.push({ v: min, s: cellCenter });
        row.push({ v: max, s: cellCenter });
        row.push({ v: prom, s: cellCenter });
        row.push({ v: m.uso_protectores ? 'Sí' : 'No', s: cellCenter });
        row.push({ v: m.tipo_protector || '', s: cellLeft });
        row.push({ v: ubicacionStr, s: cellLeft }); // Ubicación
        row.push({ v: usuarioNombre, s: cellLeft }); // Usuario
        row.push({ v: m.observaciones || '', s: cellLeft }); // Observaciones
        row.push({ v: imagenesStr, s: cellLeft }); // Imágenes

        wsData.push(row);
      });

      // 5. Crear Hoja y Ajustes Finales
      const ws = XLSX.utils.aoa_to_sheet(wsData);

      // Combinar celdas del título principal (ancho total de columnas)
      const totalCols = fixedHeaders.length + maxLecturas + tailHeaders.length;
      ws['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: totalCols - 1 } }];

      // Anchos de columna estimados
      const cols = [];
      // Llenamos un ancho por defecto para todas
      for (let c = 0; c < totalCols; c++) cols.push({ wch: 15 });

      // Ajustes específicos (índices basados en el orden de push arriba)
      cols[0] = { wch: 6 };  // N
      cols[1] = { wch: 12 }; // Fecha
      cols[2] = { wch: 10 }; // Hora
      cols[3] = { wch: 20 }; // Area
      cols[4] = { wch: 25 }; // Punto
      cols[totalCols - 2] = { wch: 30 }; // Observaciones (penúltima)
      cols[totalCols - 1] = { wch: 40 }; // Imágenes (última)

      ws['!cols'] = cols;

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Ruido');
      XLSX.writeFile(wb, 'reporte_ruido_completo.xlsx');

    } catch (err) {
      console.error('Error exportando a Excel:', err);
      message.error('No se pudo exportar el Excel.');
    }
  };

  /* ========================= FILTROS Y COLUMNAS ========================= */
  const filteredMediciones = useMemo(() => {
    if (!searchText) return mediciones;
    const s = searchText.toLowerCase();
    return mediciones.filter((m) =>
      (m.punto_medicion && m.punto_medicion.toLowerCase().includes(s)) ||
      (m.area && m.area.toLowerCase().includes(s)) ||
      (m.ponderacion && m.ponderacion.toLowerCase().includes(s))
    );
  }, [searchText, mediciones]);

  const totalFiltered = filteredMediciones.length;
  const paginatedMediciones = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredMediciones.slice(start, start + pageSize);
  }, [filteredMediciones, currentPage, pageSize]);

  const openImageViewer = (imgs, idx = 0) => {
    const list = Array.isArray(imgs) ? imgs : [];
    if (!list.length) return;
    setImageViewerList(list);
    setImageViewerIndex(idx);
    setImageViewerOpen(true);
  };

  /* --- COLUMNAS ORDENADAS: N -> Fecha -> Hora -> Area -> Punto --- */
  const columns = [
    { title: 'N°', key: 'n', width: 60, render: (_, __, i) => (currentPage - 1) * pageSize + i + 1 },
    // Nueva columna Fecha
    {
      title: 'FECHA',
      dataIndex: 'measured_at',
      key: 'measured_date',
      sorter: (a, b) => dayjs(a.measured_at).unix() - dayjs(b.measured_at).unix(),
      defaultSortOrder: 'descend',
      width: 100, render: (t) => formatFechaUTC(t),
    },
    // Columna Hora (se conserva)
    {
      title: 'HORA',
      dataIndex: 'measured_at',
      key: 'measured_time',
      sorter: (a, b) => dayjs(a.measured_at).unix() - dayjs(b.measured_at).unix(),
      width: 90,
      render: (t) => formatHoraUTC(t),
    },
    { title: 'Área', dataIndex: 'area', key: 'area', width: 150, ellipsis: true }, // <-- NUEVA COLUMNA AREA AQUÍ
    { title: 'Punto de Medición', dataIndex: 'punto_medicion', key: 'punto_medicion', ellipsis: true, width: 180 },
    { title: 'Tiempo Expos. (h)', dataIndex: 'tiempo_expos_h', key: 'tiempo_expos_h', width: 130 },
    { title: 'Ponderación', dataIndex: 'ponderacion', key: 'ponderacion', width: 110 },
    { title: 'Respuesta', dataIndex: 'respuesta', key: 'respuesta', width: 110 },
    {
      title: 'Mediciones (dB)',
      dataIndex: 'lecturas_db',
      key: 'lecturas_db',
      width: 200,
      render: (lecturas) => {
        const data = Array.isArray(lecturas) ? lecturas : [];
        if (!data.length) return <Tag>Sin lecturas</Tag>;
        const avg = calculateAverage(data);
        const content = (
          <div style={{ maxWidth: 220 }}>
            <Text strong>Lecturas:</Text>
            <ul style={{ paddingLeft: 18, margin: '8px 0 0' }}>{data.map((x, i) => (<li key={i}>{x} dB</li>))}</ul>
          </div>
        );
        return (
          <Popover content={content} title="Detalle de mediciones" trigger="hover">
            <Tag color="geekblue" style={{ cursor: 'pointer' }}>Promedio: {avg} dB ({data.length})</Tag>
          </Popover>
        );
      },
    },
    { title: 'Uso Protectores', dataIndex: 'uso_protectores', key: 'uso_protectores', width: 130, render: (v) => (v ? <Tag color="green">Sí</Tag> : <Tag color="red">No</Tag>) },
    { title: 'Tipo de Protector', dataIndex: 'tipo_protector', key: 'tipo_protector', width: 200, ellipsis: true },
    {
      title: 'Imágenes', dataIndex: 'image_urls', key: 'image_urls', width: 120, render: (imgs) => {
        const list = Array.isArray(imgs) ? imgs : [];
        if (!list.length) return <Text type="secondary">Ninguna</Text>;
        return <Button type="link" icon={<EyeOutlined />} onClick={() => openImageViewer(list, 0)} size="small">Ver imagen</Button>;
      }
    },
    { title: 'Ubicación', dataIndex: 'location', key: 'location', width: 200, render: (v) => renderLocation(v) },
    { title: 'Observaciones', dataIndex: 'observaciones', key: 'observaciones', ellipsis: true, width: 220 },
    { title: 'Registrado por', dataIndex: 'created_by', key: 'created_by', width: 190, fixed: 'right', render: (v) => usersById[v] || v },
    {
      title: 'Acciones', key: 'acciones', width: 120, fixed: 'right', render: (_, record) => (
        <Space size="small">
          <Tooltip title="Editar"><Button shape="circle" icon={<EditOutlined />} onClick={() => handleEdit(record)} /></Tooltip>
          <Tooltip title="Eliminar"><Button danger shape="circle" icon={<DeleteOutlined />} onClick={() => handleDelete(record)} /></Tooltip>
        </Space>
      )
    },
  ];

  const safeEquipos = Array.isArray(equiposInfo) ? equiposInfo : [];
  const firstMedicion = mediciones && mediciones.length > 0 ? mediciones[0] : null;

  const headerNombreEmpresa = proyectoInfo?.nombre || 'Cargando...';
  const headerFechaInicio = firstMedicion?.measured_at
    ? formatFechaExactaUTC(firstMedicion.measured_at)
    : (proyectoInfo?.created_at ? dayjs(proyectoInfo.created_at).format('DD/MM/YYYY') : 'N/A');
  const headerFechaFin = '';
  const headerEquipos = safeEquipos.length ? safeEquipos.map((eq) => eq.nombre_equipo || 's/n').join(', ') : 'Ninguno';
  const headerModelos = safeEquipos.length ? safeEquipos.map((eq) => eq.modelo || 's/n').join(', ') : 'N/A';
  const headerSeries = safeEquipos.length ? safeEquipos.map((eq) => eq.serie || 's/n').join(', ') : 'N/A';

  /* --------- DESCARGAR TODAS LAS IMÁGENES EN ZIP (NUEVO) --------- */
  const downloadAllImages = async () => {
    try {
      // Reunir todas las URLs de todas las mediciones
      const allUrls = [];
      mediciones.forEach((r) => {
        const imgs = getImagesArray(r);
        imgs.forEach((u) => allUrls.push(u));
      });

      if (!allUrls.length) {
        message.warning('No hay imágenes registradas en este monitoreo.');
        return;
      }

      message.loading({
        content: 'Preparando descarga de imágenes...',
        key: 'zipRuido',
        duration: 0
      });

      const uniqueUrls = Array.from(new Set(allUrls.filter(Boolean)));
      const zip = new JSZip();
      const folder = zip.folder('ruido');

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

      const empresaSafe = (headerNombreEmpresa || 'empresa')
        .replace(/[^\w\-]+/g, '_')
        .substring(0, 40);
      const fechaSafe = (headerFechaInicio || '').replace(/[^\d]/g, '');
      const zipName = `ruido_imagenes_${empresaSafe}_${fechaSafe || 'monitoreo'}.zip`;

      saveAs(content, zipName);

      message.success({
        content: 'Descarga lista.',
        key: 'zipRuido'
      });
    } catch (err) {
      console.error(err);
      message.error({
        content: 'No se pudieron descargar las imágenes.',
        key: 'zipRuido'
      });
    }
  };

  return (
    <>
      <Breadcrumb style={{ margin: '16px 0' }}>
        <Breadcrumb.Item><Link to="/"><HomeOutlined /></Link></Breadcrumb.Item>
        <Breadcrumb.Item><Link to="/proyectos">Proyectos</Link></Breadcrumb.Item>
        <Breadcrumb.Item><Link to={`/proyectos/${projectId}/monitoreo`}><DatabaseOutlined /> Monitoreos</Link></Breadcrumb.Item>
      </Breadcrumb>

      <Row justify="space-between" align="middle" style={{ marginBottom: 8 }}>
        <Col>
          <Title level={2} style={{ color: PRIMARY_BLUE, marginBottom: 0 }}>
            <LineChartOutlined /> Monitoreo de Ruido
          </Title>
        </Col>
        <Col>
          <Space>
            <Button onClick={() => navigate(`/proyectos/${projectId}/monitoreo`)}>
              <ArrowLeftOutlined /> Volver a Monitoreos
            </Button>
            {/* NUEVO: botón para descargar todas las imágenes en ZIP */}
            <Button onClick={downloadAllImages}>
              Descargar Imágenes
            </Button>
            <Button icon={<FileExcelOutlined />} onClick={exportToExcel}>
              Exportar a Excel
            </Button>
            <Button
              icon={<FilePdfOutlined />}
              onClick={handleOpenPdf}
              style={{ backgroundColor: '#ff4d4f', color: 'white', borderColor: '#ff4d4f' }}
            >
              Reporte Fotos
            </Button>
            <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>
              Agregar Medición
            </Button>
          </Space>
        </Col>
      </Row>

      <Row justify="space-between" align="middle" style={{ marginBottom: 16, gap: 15 }}>
        <Col flex="0 0 590px">
          <Input.Search
            allowClear
            placeholder="Buscar..."
            value={searchText}
            onChange={(e) => { setSearchText(e.target.value); setCurrentPage(1); }}
          />
        </Col>
        <Col>
          <Space>
            <Text type="secondary">Ver:</Text>
            <Select
              value={pageSize}
              onChange={(val) => { setPageSize(val); setCurrentPage(1); }}
              style={{ width: 90 }}
            >
              <Option value={5}>5</Option>
              <Option value={10}>10</Option>
              <Option value={20}>20</Option>
              <Option value={50}>50</Option>
            </Select>
            <Text type="secondary">registros</Text>
          </Space>
        </Col>
      </Row>

      <Spin spinning={loadingHeader}>
        <Descriptions bordered size="small" column={2} style={{ marginBottom: 15 }}>
          <Descriptions.Item label="NOMBRE DE LA EMPRESA">{headerNombreEmpresa}</Descriptions.Item>
          <Descriptions.Item label="FECHA DE INICIO">{headerFechaInicio}</Descriptions.Item>
          <Descriptions.Item label="FECHA DE FINALIZACION">{headerFechaFin}</Descriptions.Item>
          <Descriptions.Item label="EQUIPO">{headerEquipos}</Descriptions.Item>
          <Descriptions.Item label="MODELO DEL EQUIPO">{headerModelos}</Descriptions.Item>
          <Descriptions.Item label="SERIE DEL EQUIPO">{headerSeries}</Descriptions.Item>
        </Descriptions>
      </Spin>

      <Spin spinning={loading}>
        <div style={{ overflowX: 'auto' }}>
          <Table
            size="small"
            columns={columns}
            dataSource={paginatedMediciones}
            rowKey="id"
            pagination={false}
            scroll={{ x: 1600 }}
          />
        </div>
      </Spin>

      <Row justify="space-between" align="middle" style={{ marginTop: 12 }}>
        <Col>
          {(() => {
            const mostrados = Math.min(currentPage * pageSize, totalFiltered);
            return <Text type="secondary">Registros {mostrados} de {totalFiltered}</Text>;
          })()}
        </Col>
        <Col>
          <Pagination
            current={currentPage}
            pageSize={pageSize}
            total={totalFiltered}
            onChange={(p) => setCurrentPage(p)}
            size="small"
            showSizeChanger={false}
          />
        </Col>
      </Row>

      {/* MODAL FORM */}
      <Modal
        title={selectedMedicion ? 'Editar Medición' : 'Agregar Medición'}
        open={isFormModalVisible}
        onOk={handleFormOk}
        onCancel={() => setIsFormModalVisible(false)}
        confirmLoading={saving}
        destroyOnClose
        width={650}
      >
        <Form
          form={form}
          layout="vertical"
          name="medicionRuidoForm"
          key={selectedMedicion ? `edit-${selectedMedicion.id}` : 'add-ruido'}
          initialValues={
            selectedMedicion ? (() => {
              let timeVal = null;
              if (selectedMedicion.measured_at) {
                const raw = String(selectedMedicion.measured_at);
                const hhmm = raw.slice(11, 16);
                const [hh, mm] = hhmm.split(':');
                timeVal = dayjs().hour(Number(hh)).minute(Number(mm));
              }
              return {
                punto_medicion: selectedMedicion.punto_medicion,
                area: selectedMedicion.area, // <-- CAMPO AREA
                tiempo_expos_h: selectedMedicion.tiempo_expos_h,
                ponderacion: selectedMedicion.ponderacion,
                respuesta: selectedMedicion.respuesta,
                horario_medicion: timeVal,
                lecturas_db: Array.isArray(selectedMedicion.lecturas_db) && selectedMedicion.lecturas_db.length > 0 ? selectedMedicion.lecturas_db : [undefined],
                uso_protectores: !!selectedMedicion.uso_protectores,
                tipo_protector: selectedMedicion.tipo_protector || '',
                observaciones: selectedMedicion.observaciones || '',
                image_urls: Array.isArray(selectedMedicion.image_urls) ? selectedMedicion.image_urls.join(', ') : selectedMedicion.image_urls || '',
                location: typeof selectedMedicion.location === 'object' ? JSON.stringify(selectedMedicion.location) : (selectedMedicion.location || ''),
              };
            })() : { lecturas_db: [undefined], uso_protectores: false, ponderacion: 'A', respuesta: 'Rápido' }
          }
          preserve={false}
        >
          {/* CAMPO ÁREA PRIMERO */}
          <Form.Item
            name="area"
            label="Área"
            rules={[{ required: true }]}
          >
            <Input placeholder="Ej: Planta baja" />
          </Form.Item>

          {/* HORA SEGUNDO */}
          <Form.Item
            name="horario_medicion"
            label="Horario de Medición"
            rules={[{ required: true }]}
          >
            <Space.Compact style={{ width: '100%' }}>
              <TimePicker format="HH:mm" style={{ flex: 1 }} />
              <Tooltip title="Usar hora actual">
                <Button
                  icon={<ClockCircleOutlined />}
                  onClick={() => form.setFieldsValue({ horario_medicion: dayjs() })}
                />
              </Tooltip>
            </Space.Compact>
          </Form.Item>

          <Form.Item
            name="punto_medicion"
            label="Punto de Medición"
            rules={[{ required: true }]}
          >
            <Input placeholder="Ej: Puesto de trabajo" />
          </Form.Item>

          <Row gutter={12}>
            <Col span={8}>
              <Form.Item
                name="tiempo_expos_h"
                label="Tiempo Exposición (h)"
                rules={[{ required: true }]}
              >
                <InputNumber
                  min={0}
                  step={0.1}
                  style={{ width: '100%' }}
                  placeholder="Ej: 8"
                />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item
                name="ponderacion"
                label="Ponderación"
                rules={[{ required: true }]}
              >
                <Select>
                  <Option value="A">A</Option>
                  <Option value="C">C</Option>
                  <Option value="Z">Z</Option>
                </Select>
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item
                name="respuesta"
                label="Respuesta"
                rules={[{ required: true }]}
              >
                <Select>
                  <Option value="Rápido">Rápido</Option>
                  <Option value="Lento">Lento</Option>
                  <Option value="Impulso">Impulso</Option>
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <Form.List
            name="lecturas_db"
            rules={[
              {
                validator: async (_, lecturas) => {
                  if (!lecturas || lecturas.filter((l) => l != null).length === 0)
                    return Promise.reject(new Error('Agrega al menos una lectura'));
                }
              }
            ]}
          >
            {(fields, { add, remove }, { errors }) => (
              <>
                <Text strong>Lecturas (dB)</Text>
                {fields.map(({ key, name, ...rest }) => (
                  <Space key={key} style={{ display: 'flex', marginBottom: 8 }} align="baseline">
                    <Form.Item
                      {...rest}
                      name={name}
                      rules={[{ required: true, message: 'Falta valor' }]}
                    >
                      <InputNumber
                        min={0}
                        placeholder="Ej: 85"
                        style={{ width: '100%' }}
                      />
                    </Form.Item>
                    <DeleteIcon onClick={() => remove(name)} style={{ cursor: 'pointer' }} />
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

          <Row gutter={12}>
            <Col span={8}>
              <Form.Item
                name="uso_protectores"
                label="Uso de Protectores"
                valuePropName="checked"
              >
                <Switch checkedChildren="Sí" unCheckedChildren="No" />
              </Form.Item>
            </Col>
            <Col span={16}>
              <Form.Item
                name="tipo_protector"
                label="Tipo de Protector"
              >
                <Input placeholder="Ej: Orejeras Pasivas" />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item
            name="image_urls"
            label="URLs de imágenes"
          >
            <Input.TextArea rows={2} />
          </Form.Item>

          <Form.Item
            name="location"
            label="Ubicación"
          >
            <Input />
          </Form.Item>

          <Form.Item
            name="observaciones"
            label="Observaciones"
          >
            <Input.TextArea rows={2} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        open={imageViewerOpen}
        onCancel={() => setImageViewerOpen(false)}
        footer={imageViewerList.length > 1 ? [
          <Button
            key="prev"
            onClick={() =>
              setImageViewerIndex((prev) => (prev - 1 + imageViewerList.length) % imageViewerList.length)
            }
          >
            Anterior
          </Button>,
          <Button
            key="next"
            type="primary"
            onClick={() =>
              setImageViewerIndex((prev) => (prev + 1) % imageViewerList.length)
            }
          >
            Siguiente
          </Button>,
        ] : null}
        width={720}
        title="Imagen de la medición"
      >
        {imageViewerList.length ? (
          <div style={{ textAlign: 'center' }}>
            <img
              src={imageViewerList[imageViewerIndex]}
              alt="ruido"
              style={{ maxWidth: '100%', maxHeight: '60vh', objectFit: 'contain' }}
            />
            <div style={{ marginTop: 8 }}>
              {imageViewerIndex + 1} / {imageViewerList.length}
            </div>
          </div>
        ) : (
          <Text type="secondary">Sin imagen.</Text>
        )}
      </Modal>

      {/* === MODAL DE PDF === */}
      <Modal
        title={pdfStep === 'selection' ? "Seleccionar Imágenes" : "Vista Previa PDF"}
        open={isPdfModalVisible}
        onCancel={() => setIsPdfModalVisible(false)}
        width={1000}
        style={{ top: 20 }}
        footer={pdfStep === 'selection' ? (
          <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Text strong>Distribución:</Text>
              <Select
                defaultValue="2x4"
                style={{ width: 120 }}
                onChange={setPdfLayout}
              >
                <Option value="2x4">2 x 4</Option>
                <Option value="2x3">2 x 3</Option>
                <Option value="3x3">3 x 3</Option>
                <Option value="3x4">3 x 4</Option>
              </Select>
            </div>
            <Button
              type="primary"
              icon={<SaveOutlined />}
              onClick={handleSaveAndGenerate}
              loading={isSavingSelection}
            >
              Guardar y Generar PDF
            </Button>
          </div>
        ) : (
          <Button onClick={() => setPdfStep('selection')}>
            <ArrowLeftOutlined /> Volver
          </Button>
        )}
      >
        <div style={{ height: '75vh', overflowY: 'auto', overflowX: 'hidden' }}>
          {pdfStep === 'selection' && (
            <>
              <div
                style={{
                  marginBottom: 16,
                  paddingBottom: 16,
                  borderBottom: '1px solid #f0f0f0',
                  display: 'flex',
                  justifyContent: 'center',
                  gap: 16
                }}
              >
                <Button size="small" onClick={handleSelectAllRecords}>Seleccionar Todos</Button>
                <Button size="small" onClick={handleDeselectAllRecords}>Deseleccionar Todos</Button>
              </div>
              <div
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: '10px',
                  justifyContent: 'center'
                }}
              >
                {mediciones.filter(r => getImagesArray(r).length > 0).map((r) => {
                  const imgs = getImagesArray(r);
                  const currentIdx = tempSelections[r.id] || 0;
                  const isSelected = recordSelections[r.id] === true;
                  return (
                    <div
                      key={r.id}
                      style={{
                        width: '23%',
                        border: isSelected ? '1px solid #ddd' : '1px dashed #999',
                        opacity: isSelected ? 1 : 0.5,
                        padding: '8px',
                        borderRadius: '8px',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        backgroundColor: '#fafafa',
                        position: 'relative'
                      }}
                    >
                      <Checkbox
                        checked={isSelected}
                        onChange={() => handleRecordSelectionToggle(r.id)}
                        style={{ position: 'absolute', top: 5, right: 5, zIndex: 20 }}
                      />
                      <Text strong style={{ fontSize: 12 }}>{monitoreoInfo?.tipo_monitoreo}</Text>
                      <div
                        style={{
                          position: 'relative',
                          width: '100%',
                          height: '150px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          backgroundColor: '#fff',
                          border: '1px solid #eee',
                          marginTop: 5
                        }}
                      >
                        {imgs.length > 1 && (
                          <Button
                            shape="circle"
                            icon={<LeftOutlined />}
                            size="small"
                            style={{ position: 'absolute', left: 5 }}
                            onClick={() => handlePrevImage(r.id, imgs.length)}
                          />
                        )}
                        <img
                          src={imgs[currentIdx]}
                          style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
                        />
                        {imgs.length > 1 && (
                          <Button
                            shape="circle"
                            icon={<RightOutlined />}
                            size="small"
                            style={{ position: 'absolute', right: 5 }}
                            onClick={() => handleNextImage(r.id, imgs.length)}
                          />
                        )}
                        {imgs.length > 1 && (
                          <span
                            style={{
                              position: 'absolute',
                              bottom: 2,
                              right: 5,
                              fontSize: 10,
                              background: 'rgba(255,255,255,0.7)'
                            }}
                          >
                            {currentIdx + 1}/{imgs.length}
                          </span>
                        )}
                      </div>
                      <Text style={{ fontSize: 11, marginTop: 5 }}>{r.punto_medicion}</Text>
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
                empresa={proyectoInfo?.descripcion || 'SIN DESCRIPCIÓN'}
                layout={pdfLayout}
                tituloMonitoreo={monitoreoInfo?.tipo_monitoreo || 'Ruido'}
                descripcionProyecto={''}
              />
            </PDFViewer>
          )}
        </div>
      </Modal>
    </>
  );
};

export default RuidoPage;
