// src/pages/VentilacionPage.jsx

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
  Breadcrumb,
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
  LineChartOutlined,
  ExclamationCircleOutlined,
  ArrowLeftOutlined,
  FileExcelOutlined,
  EyeOutlined,
  DeleteOutlined as DeleteIcon,
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
import * as XLSX from 'xlsx';          // (tu versión nueva de Excel)

// IMPORTS DEL REPORTE FOTOGRÁFICO
import { PDFViewer } from '@react-pdf/renderer';
import { ReporteFotografico } from '../components/ReporteFotografico';

dayjs.extend(utc);
dayjs.locale('es');

const { Title, Text } = Typography;
const { Option } = Select;

const PRIMARY_BLUE = '#2a8bb6';
const VENTILACION_TABLE_NAME = 'ventilacion';
const TIPOS_VENTILACION = [
  'Ventilación natural',
  'Ventilación forzada',
  'Ventilación mecánica',
  'Mixta',
];

// --- HELPERS ---
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


const VentilacionPage = () => {
  const { projectId, monitoreoId: mId, id } = useParams();
  const monitoreoId = mId || id;
  const navigate = useNavigate();
  const [form] = Form.useForm();

  // --- Estados de Datos ---
  const [monitoreoInfo, setMonitoreoInfo] = useState(null);
  const [proyectoInfo, setProyectoInfo] = useState(null);
  const [equiposInfo, setEquiposInfo] = useState([]);
  const [registros, setRegistros] = useState([]);

  // --- Estados de UI ---
  const [loadingHeader, setLoadingHeader] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isFormModalVisible, setIsFormModalVisible] = useState(false);
  const [selectedRegistro, setSelectedRegistro] = useState(null);
  const [lastRtMsg, setLastRtMsg] = useState('');

  // --- Estados Visor Imágenes ---
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

  // --- Estados Búsqueda/Paginación ---
  const [searchText, setSearchText] = useState('');
  const [pageSize, setPageSize] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);

  const [usersById, setUsersById] = useState({});

  /* ========== helpers UI ========== */
  const openImageViewer = (imgs, idx = 0) => {
    if (!imgs || imgs.length === 0) return;
    setImageViewerList(imgs);
    setImageViewerIndex(idx);
    setImageViewerOpen(true);
  };

  const renderLocation = (v) => {
    if (!v) return <Text type="secondary">N/A</Text>;
    if (typeof v === 'object') {
      const lat = v.lat ?? v.latitude;
      const lng = v.lng ?? v.longitude;
      if (lat !== undefined || lng !== undefined) {
        return (<span>lat: {lat ?? ''}{lat !== undefined && lng !== undefined ? ', ' : ''}{lng !== undefined ? `lng: ${lng}` : ''}</span>);
      }
      if (v.easting || v.northing || v.utm_zone) {
        return (<span>E: {v.easting ?? ''} | N: {v.northing ?? ''} | Z: {v.utm_zone ?? ''}</span>);
      }
      return <span>{JSON.stringify(v)}</span>;
    }
    try {
      const parsed = JSON.parse(v);
      return renderLocation(parsed);
    } catch {
      return <span>{v}</span>;
    }
  };

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
    registros.filter(r => getImagesArray(r).length > 0).forEach(r => { allSelected[r.id] = true; });
    setRecordSelections(allSelected);
  };

  const handleDeselectAllRecords = () => {
    const allDeselected = {};
    registros.filter(r => getImagesArray(r).length > 0).forEach(r => { allDeselected[r.id] = false; });
    setRecordSelections(allDeselected);
  };

  const handleOpenPdf = () => {
    const registrosConFotos = registros.filter(r => getImagesArray(r).length > 0);
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

  const handleSaveAndGenerate = async () => {
    setIsSavingSelection(true);
    const loadingMsg = message.loading("Generando reporte...", 0);
    try {
        const registrosConFotos = registros.filter(r => getImagesArray(r).length > 0);
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
            const codigo = `VEN-${String(i + 1).padStart(2, '0')}`;

            dataForPdf.push({
                imageUrl: originalUrl, 
                area: r.area || 'N/A', // Ahora usamos el campo 'area' de la BD
                puesto: r.local_trabajo, 
                codigo: codigo,
                fechaHora: `${formatFechaUTC(r.created_at)} - ${formatHoraUTC(r.created_at)}`
            });

            supabaseTasks.push(
                supabase.from(VENTILACION_TABLE_NAME).update({ selected_image_index: finalIdx }).eq('id', r.id)
            );
            i++;
        }

        await Promise.all(supabaseTasks);
        fetchRegistros(); 
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
    if (!equipoIds) { setEquiposInfo([]); return; }
    let list = equipoIds;
    if (typeof list === 'string') { try { list = JSON.parse(list); } catch { list = []; } }
    if (!Array.isArray(list) || list.length === 0) { setEquiposInfo([]); return; }
    try {
      const { data, error } = await supabase
        .from('equipos')
        .select('id, nombre_equipo, modelo, serie')
        .in('id', list);
      if (error) throw error;
      setEquiposInfo(data || []);
    } catch (error) {
      console.error('Error cargando equipos:', error);
      setEquiposInfo([]);
    }
  };

  useEffect(() => {
    const fetchHeaderData = async () => {
      if (!monitoreoId) {
        if (projectId) await fetchProyectoInfo(projectId);
        setLoadingHeader(false);
        return;
      }
      setLoadingHeader(true);
      try {
        const { data, error } = await supabase
          .from('monitoreos')
          .select('id, tipo_monitoreo, proyecto_id, equipos_asignados')
          .eq('id', monitoreoId)
          .single();

        if (error) {
          console.warn('Monitoreo no encontrado:', error.message);
          setMonitoreoInfo(null);
        } else {
          setMonitoreoInfo(data);
          await Promise.all([
            fetchProyectoInfo(data.proyecto_id),
            fetchEquiposInfo(data.equipos_asignados),
          ]);
        }
      } catch (err) {
        console.error('Error cabecera:', err);
      } finally {
        setLoadingHeader(false);
      }
    };
    fetchHeaderData();
  }, [monitoreoId, projectId]);

  /* ========================= USERS ========================= */
  const fetchUsersByIds = async (ids) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, username, nombre_completo, email, descripcion, rol, estado')
        .in('id', ids);
      if (error) return;
      const dict = {};
      (data || []).forEach((u) => {
        const display = (u.nombre_completo && u.nombre_completo.trim()) || (u.username && u.username.trim()) || u.id;
        dict[u.id] = display;
      });
      setUsersById(dict);
    } catch (err) { console.error('Error trayendo usuarios:', err); }
  };

  /* ========================= REGISTROS ========================= */
  const fetchRegistros = async (isBackground = false) => {
    if (!isBackground) setLoading(true);
    try {
      let query = supabase
        .from(VENTILACION_TABLE_NAME)
        .select('*')
        .order('created_at', { ascending: true });

      if (monitoreoId) query = query.eq('monitoreo_id', monitoreoId);
      else if (projectId) query = query.eq('proyecto_id', projectId);

      let { data, error } = await query;
      if (error) throw error;

      const mapped = (data || []).map((r) => {
        let imgs = [];
        if (Array.isArray(r.image_urls)) {
          imgs = r.image_urls;
        } else if (typeof r.image_urls === 'string' && r.image_urls.trim() !== '') {
          try {
            const parsed = JSON.parse(r.image_urls);
            if (Array.isArray(parsed)) imgs = parsed;
            else imgs = [r.image_urls];
          } catch {
            imgs = r.image_urls.split(',').map((s) => s.trim());
          }
        }
        
        let loc = r.location;
        if (typeof r.location === 'string' && r.location.trim() !== '') {
          try { loc = JSON.parse(r.location); } catch {}
        }

        return { ...r, image_urls: imgs, location: loc };
      });

      setRegistros(mapped);
      setCurrentPage(1);

      const createdByIds = Array.from(new Set((mapped || []).map((m) => m.created_by).filter((v) => v && typeof v === 'string')));
      if (createdByIds.length > 0) await fetchUsersByIds(createdByIds);
      else setUsersById({});
    } catch (e) {
      console.error('Error ventilación:', e);
      message.error('No se pudieron cargar los datos de ventilación.');
      setRegistros([]);
    } finally {
      if (!isBackground) setLoading(false);
    }
  };

  useEffect(() => {
    fetchRegistros();
    const channel = supabase
      .channel('rt-ventilacion-all')
      .on('postgres_changes', { event: '*', schema: 'public', table: VENTILACION_TABLE_NAME }, () => fetchRegistros(true))
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [monitoreoId, projectId]);

  /* ========================= CRUD ========================= */
  const handleAdd = () => { setSelectedRegistro(null); setIsFormModalVisible(true); };
  const handleEdit = (record) => { setSelectedRegistro(record); setIsFormModalVisible(true); };
  const handleDelete = (record) => {
    Modal.confirm({
      title: '¿Confirmar eliminación?',
      icon: <ExclamationCircleOutlined />,
      content: `Se eliminará el registro del local "${record.local_trabajo || record.id}".`,
      okText: 'Eliminar',
      okType: 'danger',
      cancelText: 'Cancelar',
      onOk: async () => {
        try {
          const { error } = await supabase.from(VENTILACION_TABLE_NAME).delete().eq('id', record.id);
          if (error) throw error;
          message.success('Registro eliminado.');
        } catch (err) { message.error('No se pudo eliminar.'); }
      },
    });
  };

  const handleFormOk = () => { selectedRegistro ? handleEditOk() : handleAddOk(); };
  const handleFormCancel = () => { setIsFormModalVisible(false); };

  const handleAddOk = async () => {
    setSaving(true);
    try {
      const values = await form.validateFields();
      let velMh = values.vel_aire_mh;
      if ((values.vel_aire_ms || values.vel_aire_ms === 0) && !velMh) {
        velMh = Number(values.vel_aire_ms) * 3600;
      }
      const payload = {
        proyecto_id: projectId || null,
        monitoreo_id: monitoreoId || null,
        // Guardamos el campo area
        area: values.area,
        local_trabajo: values.local_trabajo,
        tipo_ventilacion: values.tipo_ventilacion,
        temperatura_seca_c: values.temperatura_seca_c,
        vel_aire_ms: values.vel_aire_ms,
        vel_aire_mh: velMh,
        area_ventilacion_m2: values.area_ventilacion_m2,
        area_alto_m: values.area_alto_m,
        area_ancho_m: values.area_ancho_m,
        caudal_m3h: values.caudal_m3h,
        vol_largo_m: values.vol_largo_m,
        vol_ancho_m: values.vol_ancho_m,
        vol_alto_m: values.vol_alto_m,
        volumen_m3: values.volumen_m3,
        renovaciones_h: values.renovaciones_h,
        image_urls: values.image_urls && values.image_urls.trim() !== '' ? values.image_urls.split(',').map((s) => s.trim()) : null,
        location: values.location || null,
      };
      const { error } = await supabase.from(VENTILACION_TABLE_NAME).insert(payload);
      if (error) throw error;
      message.success('Registro agregado.');
      setIsFormModalVisible(false);
    } catch (err) { message.error('No se pudo agregar.'); } finally { setSaving(false); }
  };

  const handleEditOk = async () => {
    if (!selectedRegistro) return;
    setSaving(true);
    try {
      const values = await form.validateFields();
      let velMh = values.vel_aire_mh;
      if ((values.vel_aire_ms || values.vel_aire_ms === 0) && !velMh) {
        velMh = Number(values.vel_aire_ms) * 3600;
      }
      const updateData = {
        // Actualizamos area
        area: values.area,
        local_trabajo: values.local_trabajo,
        tipo_ventilacion: values.tipo_ventilacion,
        temperatura_seca_c: values.temperatura_seca_c,
        vel_aire_ms: values.vel_aire_ms,
        vel_aire_mh: velMh,
        area_ventilacion_m2: values.area_ventilacion_m2,
        area_alto_m: values.area_alto_m,
        area_ancho_m: values.area_ancho_m,
        caudal_m3h: values.caudal_m3h,
        vol_largo_m: values.vol_largo_m,
        vol_ancho_m: values.vol_ancho_m,
        vol_alto_m: values.vol_alto_m,
        volumen_m3: values.volumen_m3,
        renovaciones_h: values.renovaciones_h,
        image_urls: values.image_urls && values.image_urls.trim() !== '' ? values.image_urls.split(',').map((s) => s.trim()) : null,
        location: values.location || null,
      };
      const { error } = await supabase.from(VENTILACION_TABLE_NAME).update(updateData).eq('id', selectedRegistro.id);
      if (error) throw error;
      message.success('Registro actualizado.');
      setIsFormModalVisible(false);
    } catch (err) { message.error('No se pudo actualizar.'); } finally { setSaving(false); }
  };

  /* ========================= EXPORTAR A EXCEL ========================= */
  const exportToExcel = () => {
    try {
      const headerBg = 'D9D9D9';
      const titleStyle = { font: { bold: true }, alignment: { vertical: 'center', horizontal: 'left' } };
      const headerStyle = { font: { bold: true }, alignment: { vertical: 'center', horizontal: 'center', wrapText: true }, fill: { fgColor: { rgb: headerBg } }, border: { top: { style: 'thin', color: { rgb: '000000' } }, bottom: { style: 'thin', color: { rgb: '000000' } }, left: { style: 'thin', color: { rgb: '000000' } }, right: { style: 'thin', color: { rgb: '000000' } } } };
      const cellStyle = { alignment: { vertical: 'center', horizontal: 'center', wrapText: true }, border: { top: { style: 'thin', color: { rgb: '000000' } }, bottom: { style: 'thin', color: { rgb: '000000' } }, left: { style: 'thin', color: { rgb: '000000' } }, right: { style: 'thin', color: { rgb: '000000' } } } };
      const dataStyle = { ...cellStyle, fill: { fgColor: { rgb: 'FFF2CC' } } };

      const empresa = proyectoInfo?.nombre || '';
      const fechaInicio = registros.length && registros[0].created_at ? dayjs(registros[0].created_at).format('DD/MM/YYYY') : (proyectoInfo?.created_at ? dayjs(proyectoInfo.created_at).format('DD/MM/YYYY') : '');
      const fechaFin = '';
      const equipos = Array.isArray(equiposInfo) && equiposInfo.length ? equiposInfo.map((e) => e.nombre_equipo || 's/n').join(', ') : '';
      const modelos = Array.isArray(equiposInfo) && equiposInfo.length ? equiposInfo.map((e) => e.modelo || 's/n').join(', ') : '';
      const series = Array.isArray(equiposInfo) && equiposInfo.length ? equiposInfo.map((e) => e.serie || 's/n').join(', ') : '';

      const wsData = [];
      wsData.push([{ v: 'PLANILLA DE MEDICIÓN Y EVALUACIÓN DE VENTILACIÓN', s: { font: { bold: true, sz: 14 }, alignment: { vertical: 'center', horizontal: 'center' } } }]);
      wsData.push([{ v: 'INSTALACIÓN:', s: titleStyle }, { v: empresa, s: cellStyle }, '', { v: 'EQUIPO:', s: titleStyle }, { v: equipos, s: cellStyle }]);
      wsData.push([{ v: 'FECHA DE INICIO DEL MONITOREO:', s: titleStyle }, { v: fechaInicio, s: cellStyle }, '', { v: 'MODELO:', s: titleStyle }, { v: modelos, s: cellStyle }]);
      wsData.push([{ v: 'FECHA DE FINALIZACIÓN DEL MONITOREO:', s: titleStyle }, { v: fechaFin, s: cellStyle }, '', { v: 'SERIE:', s: titleStyle }, { v: series, s: cellStyle }]);
      wsData.push([{ v: 'TIPO DE MONITOREO:', s: titleStyle }, { v: monitoreoInfo?.tipo_monitoreo || 'SEGUIMIENTO', s: cellStyle }]);
      wsData.push(['', '', '', '', '']);
      wsData.push([{ v: 'EVALUACIÓN DE RIESGOS', s: headerStyle }]);

      // HEADERS ACTUALIZADOS
      wsData.push([
        { v: 'Nro.', s: headerStyle },
        { v: 'Área', s: headerStyle }, // NUEVA COLUMNA EN EXCEL
        { v: 'Local de trabajo', s: headerStyle },
        { v: 'Tipo de ventilacion', s: headerStyle },
        { v: 'Temperatura seca (°c)', s: headerStyle },
        { v: 'velocidad aire (m/s)', s: headerStyle },
        { v: 'velocidad aire (m/h)', s: headerStyle },
        { v: 'Área de ventilación (m2)', s: headerStyle },
        { v: 'Cauda de extraccion o inyeccion de aire (m3/h)', s: headerStyle },
        { v: 'CÁLCULOS AUXILIARES', s: headerStyle },
        { v: '', s: headerStyle },
        { v: '', s: headerStyle },
        { v: 'Volumen del ambiente (m3)', s: headerStyle },
        { v: 'N° renovacion por hora', s: headerStyle },
        { v: 'Limite Permisible Según NB – 51001-1 (Renovaciones por hora)', s: headerStyle },
      ]);

      wsData.push([
        { v: '', s: headerStyle },
        { v: '', s: headerStyle }, // Espacio para Área
        { v: '', s: headerStyle },
        { v: '', s: headerStyle },
        { v: '', s: headerStyle },
        { v: '', s: headerStyle },
        { v: '', s: headerStyle },
        { v: '', s: headerStyle },
        { v: '', s: headerStyle },
        { v: 'LARGO (m)', s: headerStyle },
        { v: 'ANCHO (m)', s: headerStyle },
        { v: 'ALTURA (m)', s: headerStyle },
        { v: '', s: headerStyle },
        { v: '', s: headerStyle },
        { v: '', s: headerStyle },
      ]);

      registros.forEach((r, idx) => {
        wsData.push([
          { v: idx + 1, s: dataStyle },
          { v: r.area || '', s: dataStyle }, // DATO DE AREA
          { v: r.local_trabajo || '', s: dataStyle },
          { v: r.tipo_ventilacion || '', s: dataStyle },
          { v: r.temperatura_seca_c ?? '', s: dataStyle },
          { v: r.vel_aire_ms ?? '', s: dataStyle },
          { v: r.vel_aire_mh ?? '', s: dataStyle },
          { v: r.area_ventilacion_m2 ?? '', s: dataStyle },
          { v: r.caudal_m3h ?? '', s: dataStyle },
          { v: r.vol_largo_m ?? '', s: dataStyle },
          { v: r.vol_ancho_m ?? '', s: dataStyle },
          { v: r.vol_alto_m ?? '', s: dataStyle },
          { v: r.volumen_m3 ?? '', s: dataStyle },
          { v: r.renovaciones_h ?? '', s: dataStyle },
          { v: '5 - 8', s: dataStyle },
        ]);
      });

      const ws = XLSX.utils.aoa_to_sheet(wsData);

      // MERGES RECALCULADOS (Todo movido 1 a la derecha desde col 1)
      ws['!merges'] = [
        { s: { r: 0, c: 0 }, e: { r: 0, c: 14 } },
        { s: { r: 1, c: 1 }, e: { r: 1, c: 2 } },
        { s: { r: 2, c: 1 }, e: { r: 2, c: 2 } },
        { s: { r: 3, c: 1 }, e: { r: 3, c: 2 } },
        { s: { r: 4, c: 1 }, e: { r: 4, c: 2 } },
        { s: { r: 6, c: 0 }, e: { r: 6, c: 14 } },
        // Columnas simples (row 7-8 merged)
        { s: { r: 7, c: 0 }, e: { r: 8, c: 0 } }, // Nro
        { s: { r: 7, c: 1 }, e: { r: 8, c: 1 } }, // Area (NUEVO)
        { s: { r: 7, c: 2 }, e: { r: 8, c: 2 } }, // Local
        { s: { r: 7, c: 3 }, e: { r: 8, c: 3 } }, // Tipo
        { s: { r: 7, c: 4 }, e: { r: 8, c: 4 } }, // Temp
        { s: { r: 7, c: 5 }, e: { r: 8, c: 5 } }, // Vel ms
        { s: { r: 7, c: 6 }, e: { r: 8, c: 6 } }, // Vel mh
        { s: { r: 7, c: 7 }, e: { r: 8, c: 7 } }, // Area vent
        { s: { r: 7, c: 8 }, e: { r: 8, c: 8 } }, // Caudal
        // Cálculos auxiliares (Header r7 spans 3 cols)
        { s: { r: 7, c: 9 }, e: { r: 7, c: 11 } }, // MERGE DE CALCULOS (Largo, Ancho, Alto)
        { s: { r: 7, c: 12 }, e: { r: 8, c: 12 } }, // Volumen
        { s: { r: 7, c: 13 }, e: { r: 8, c: 13 } }, // Renovacion
        { s: { r: 7, c: 14 }, e: { r: 8, c: 14 } }, // Limite
      ];

      ws['!cols'] = [
        { wch: 4 },
        { wch: 20 }, // Area
        { wch: 20 }, // Local
        { wch: 20 },
        { wch: 16 },
        { wch: 16 },
        { wch: 16 },
        { wch: 18 },
        { wch: 26 },
        { wch: 12 },
        { wch: 12 },
        { wch: 12 },
        { wch: 18 },
        { wch: 18 },
        { wch: 30 },
      ];

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Ventilación');
      XLSX.writeFile(wb, 'reporte_ventilacion.xlsx');
    } catch (err) {
      console.error('Error exportar ventilación:', err);
      message.error('No se pudo exportar el reporte.');
    }
  };

  /* ========================= FILTROS Y COLUMNAS ========================= */
  const filteredRegistros = useMemo(() => {
    if (!searchText) return registros;
    const s = searchText.toLowerCase();
    return registros.filter((r) => (
      (r.local_trabajo && r.local_trabajo.toLowerCase().includes(s)) ||
      (r.area && r.area.toLowerCase().includes(s)) || // Buscar por Area
      (r.tipo_ventilacion && r.tipo_ventilacion.toLowerCase().includes(s))
    ));
  }, [searchText, registros]);

  const totalFiltered = filteredRegistros.length;
  const paginatedRegistros = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredRegistros.slice(start, start + pageSize);
  }, [filteredRegistros, currentPage, pageSize]);

  const columns = [
    { title: 'N°', width: 60, fixed: 'left', render: (_, __, i) => (currentPage - 1) * pageSize + i + 1 },
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
               width: 70,
               render: (t) => formatHoraUTC(t),
           },
    // NUEVA COLUMNA EN TABLA UI
    { title: 'Área', dataIndex: 'area', width: 150, ellipsis: true },
    { title: 'Local de trabajo', dataIndex: 'local_trabajo', width: 160, ellipsis: true },
    { title: 'Tipo', dataIndex: 'tipo_ventilacion', width: 160, ellipsis: true },
    { title: 'Temp °C', dataIndex: 'temperatura_seca_c', width: 100 },
    { title: 'Vel (m/s)', dataIndex: 'vel_aire_ms', width: 100 },
    { title: 'Caudal', dataIndex: 'caudal_m3h', width: 100 },
    { title: 'Renovaciones/h', dataIndex: 'renovaciones_h', width: 140 },
    { title: 'Imágenes', dataIndex: 'image_urls', width: 130, render: (imgs) => {
        const list = Array.isArray(imgs) ? imgs : [];
        if (!list.length) return <Text type="secondary">Ninguna</Text>;
        return <Button type="link" icon={<EyeOutlined />} onClick={() => openImageViewer(list, 0)} size="small">Ver imagen</Button>;
    }},
    { title: 'Ubicación', dataIndex: 'location', width: 210, render: renderLocation },
    { title: 'Registrado por', dataIndex: 'created_by', width: 150, render: (v) => usersById[v] || v.slice(0,8) },
    { title: 'Acciones', width: 120, fixed: 'right', render: (_, r) => (
        <Space size="small">
          <Tooltip title="Editar"><Button shape="circle" icon={<EditOutlined />} onClick={() => handleEdit(r)} /></Tooltip>
          <Tooltip title="Eliminar"><Button danger shape="circle" icon={<DeleteOutlined />} onClick={() => handleDelete(r)} /></Tooltip>
        </Space>
    )}
  ];

  const safeEquipos = Array.isArray(equiposInfo) ? equiposInfo : [];
  const firstReg = registros[0];
  const headerNombreEmpresa = proyectoInfo?.nombre || 'Cargando...';
  const headerFechaInicio = firstReg?.created_at ? formatFechaUTC(firstReg.created_at) : (proyectoInfo?.created_at ? formatFechaUTC(proyectoInfo.created_at) : 'N/A');
  const headerEquipos = safeEquipos.map(e => e.nombre_equipo).join(', ');
  const headerModelos = safeEquipos.map(e => e.modelo).join(', ');
  const headerSeries = safeEquipos.map(e => e.serie).join(', ');

  return (
    <>
      <Breadcrumb style={{ margin: '16px 0' }}>
        <Breadcrumb.Item><Link to="/"><HomeOutlined /></Link></Breadcrumb.Item>
        <Breadcrumb.Item><Link to="/proyectos">Proyectos</Link></Breadcrumb.Item>
        <Breadcrumb.Item><Link to={`/proyectos/${projectId}/monitoreo`}><DatabaseOutlined /> Monitoreos</Link></Breadcrumb.Item>
        <Breadcrumb.Item>{monitoreoInfo?.tipo_monitoreo || 'Ventilación'}</Breadcrumb.Item>
      </Breadcrumb>

      <Row justify="space-between" align="middle" style={{ marginBottom: 8 }}>
        <Col>
          <Title level={2} style={{ color: PRIMARY_BLUE, marginBottom: 0 }}><LineChartOutlined /> Monitoreo de Ventilación</Title>
        </Col>
        <Col>
          <Space>
            <Button onClick={() => navigate(`/proyectos/${projectId}/monitoreo`)}><ArrowLeftOutlined /> Volver a Monitoreos</Button>
            <Button icon={<FileExcelOutlined />} onClick={exportToExcel}>Exportar a Excel</Button>
            <Button 
               icon={<FilePdfOutlined />} 
               onClick={handleOpenPdf}
               style={{ backgroundColor: '#ff4d4f', color: 'white', borderColor: '#ff4d4f' }}
            >
               Reporte Fotos
            </Button>
            <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>Agregar Registro</Button>
          </Space>
        </Col>
      </Row>

      <Row justify="space-between" style={{marginBottom: 16, gap: 15}}>
         <Col flex="1"><Input.Search placeholder="Buscar..." value={searchText} onChange={e => setSearchText(e.target.value)} /></Col>
         <Col>
            <Space><Text type="secondary">Ver:</Text><Select value={pageSize} onChange={setPageSize} options={[{value:10},{value:20},{value:50}]} /></Space>
         </Col>
      </Row>

      <Spin spinning={loadingHeader}>
        <Descriptions bordered size="small" column={2} style={{ marginBottom: 15 }}>
          <Descriptions.Item label="EMPRESA">{headerNombreEmpresa}</Descriptions.Item>
          <Descriptions.Item label="FECHA">{headerFechaInicio}</Descriptions.Item>
          <Descriptions.Item label="EQUIPO">{headerEquipos}</Descriptions.Item>
          <Descriptions.Item label="MODELO">{headerModelos}</Descriptions.Item>
          <Descriptions.Item label="SERIE">{headerSeries}</Descriptions.Item>
        </Descriptions>
      </Spin>

      <Spin spinning={loading}>
        <Table className="tabla-general" size="small" columns={columns} dataSource={paginatedRegistros} rowKey="id" pagination={false} scroll={{ x: 1400 }} />
      </Spin>

      <Row justify="space-between" style={{ marginTop: 12 }}>
         <Col><Text type="secondary">Registros {Math.min(currentPage * pageSize, totalFiltered)} de {totalFiltered}</Text></Col>
         <Col><Pagination current={currentPage} pageSize={pageSize} total={totalFiltered} onChange={setCurrentPage} size="small" showSizeChanger={false} /></Col>
      </Row>

      {/* Modales */}
      <Modal open={isFormModalVisible} onOk={handleFormOk} onCancel={handleFormCancel} title={selectedRegistro ? 'Editar' : 'Agregar'} destroyOnClose width={650}>
          <Form form={form} layout="vertical" preserve={false} key={selectedRegistro ? selectedRegistro.id : 'new'}>
              {/* CAMPO AREA NUEVO */}
              <Form.Item name="area" label="Área" rules={[{required:true}]}><Input /></Form.Item>
              <Form.Item name="local_trabajo" label="Local de trabajo" rules={[{required:true}]}><Input /></Form.Item>
              <Form.Item name="tipo_ventilacion" label="Tipo de ventilación" rules={[{ required: true }]}><Select placeholder="Selecciona tipo">{TIPOS_VENTILACION.map(t=><Option key={t} value={t}>{t}</Option>)}</Select></Form.Item>
              <Form.Item name="temperatura_seca_c" label="Temperatura seca (°C)" rules={[{ required: true }]}><InputNumber min={-20} max={60} style={{width:'100%'}} /></Form.Item>
              <Form.Item name="vel_aire_ms" label="Velocidad aire (m/s)" rules={[{ required: true }]}><InputNumber min={0} step={0.01} style={{width:'100%'}} /></Form.Item>
              <Form.Item name="vel_aire_mh" label="Velocidad aire (m/h)"><InputNumber min={0} style={{width:'100%'}} /></Form.Item>
              <Form.Item name="area_ventilacion_m2" label="Área de ventilación (m²)" rules={[{ required: true }]}><InputNumber min={0} step={0.01} style={{width:'100%'}} /></Form.Item>
              <Form.Item name="area_alto_m" label="Área ALTO (m)"><InputNumber min={0} step={0.01} style={{width:'100%'}} /></Form.Item>
              <Form.Item name="area_ancho_m" label="Área ANCHO (m)"><InputNumber min={0} step={0.01} style={{width:'100%'}} /></Form.Item>
              <Form.Item name="caudal_m3h" label="Caudal (m³/h)" rules={[{ required: true }]}><InputNumber min={0} step={0.01} style={{width:'100%'}} /></Form.Item>
              <Form.Item name="vol_largo_m" label="Aux: Largo (m)"><InputNumber min={0} step={0.01} style={{width:'100%'}} /></Form.Item>
              <Form.Item name="vol_ancho_m" label="Aux: Ancho (m)"><InputNumber min={0} step={0.01} style={{width:'100%'}} /></Form.Item>
              <Form.Item name="vol_alto_m" label="Aux: Altura (m)"><InputNumber min={0} step={0.01} style={{width:'100%'}} /></Form.Item>
              <Form.Item name="volumen_m3" label="Volumen (m³)" rules={[{ required: true }]}><InputNumber min={0} step={0.01} style={{width:'100%'}} /></Form.Item>
              <Form.Item name="renovaciones_h" label="Renovaciones/h" rules={[{ required: true }]}><InputNumber min={0} style={{width:'100%'}} /></Form.Item>
              <Form.Item name="image_urls" label="URLs de imágenes"><Input.TextArea rows={2} /></Form.Item>
              <Form.Item name="location" label="Ubicación (texto/JSON)"><Input /></Form.Item>
          </Form>
      </Modal>
      
      <Modal open={imageViewerOpen} onCancel={() => setImageViewerOpen(false)} footer={null} width={720}>
         {imageViewerList.length > 0 && <img src={imageViewerList[imageViewerIndex]} style={{width:'100%'}} />}
      </Modal>

      {/* === MODAL DE PDF === */}
      <Modal
          title={pdfStep === 'selection' ? "Seleccionar Imágenes" : "Vista Previa PDF"}
          open={isPdfModalVisible}
          onCancel={() => setIsPdfModalVisible(false)}
          width={1000}
          style={{ top: 20 }}
          footer={
            pdfStep === 'selection' ? (
                <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Text strong>Distribución:</Text>
                        <Select defaultValue="2x4" style={{ width: 120 }} onChange={setPdfLayout}>
                            <Option value="2x4">2 x 4</Option><Option value="2x3">2 x 3</Option>
                            <Option value="3x3">3 x 3</Option><Option value="3x4">3 x 4</Option>
                        </Select>
                    </div>
                    <Button type="primary" icon={<SaveOutlined />} onClick={handleSaveAndGenerate} loading={isSavingSelection}>
                        Guardar y Generar PDF
                    </Button>
                </div>
            ) : (
                <Button onClick={() => setPdfStep('selection')}>
                  <ArrowLeftOutlined /> Volver a Monitoreos
                </Button>
            )
          }
      >
          <div style={{ height: '75vh', overflowY: 'auto', overflowX: 'hidden' }}>
              {pdfStep === 'selection' && (
                  <>
                    <div style={{ marginBottom: 16, paddingBottom: 16, borderBottom: '1px solid #f0f0f0', display: 'flex', justifyContent: 'center', gap: 16 }}>
                        <Button size="small" onClick={handleSelectAllRecords}>Seleccionar Todos</Button>
                        <Button size="small" onClick={handleDeselectAllRecords}>Deseleccionar Todos</Button>
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', justifyContent: 'center' }}>
                      {registros.filter(r => getImagesArray(r).length > 0).map((r) => {
                          const imgs = getImagesArray(r);
                          const currentIdx = tempSelections[r.id] || 0;
                          const isSelected = recordSelections[r.id] === true;
                          return (
                              <div key={r.id} style={{ 
                                  width: '23%', 
                                  border: isSelected ? '1px solid #ddd' : '1px dashed #999', 
                                  opacity: isSelected ? 1 : 0.5,
                                  padding: '8px', borderRadius: '8px', display: 'flex', flexDirection: 'column', alignItems: 'center', backgroundColor: '#fafafa', position: 'relative'
                              }}>
                                  <Checkbox checked={isSelected} onChange={() => handleRecordSelectionToggle(r.id)} style={{ position: 'absolute', top: 5, right: 5, zIndex: 20 }} />
                                  <Text strong style={{ fontSize: 12 }}>{monitoreoInfo?.tipo_monitoreo}</Text>
                                  <div style={{ position: 'relative', width: '100%', height: '150px', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff', border: '1px solid #eee', marginTop: 5 }}>
                                      {imgs.length > 1 && <Button shape="circle" icon={<LeftOutlined />} size="small" style={{ position: 'absolute', left: 5 }} onClick={() => handlePrevImage(r.id, imgs.length)} />}
                                      <img src={imgs[currentIdx]} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
                                      {imgs.length > 1 && <Button shape="circle" icon={<RightOutlined />} size="small" style={{ position: 'absolute', right: 5 }} onClick={() => handleNextImage(r.id, imgs.length)} />}
                                      {imgs.length > 1 && <span style={{ position: 'absolute', bottom: 2, right: 5, fontSize: 10, background: 'rgba(255,255,255,0.7)' }}>{currentIdx + 1}/{imgs.length}</span>}
                                  </div>
                                  <Text style={{ fontSize: 11, marginTop: 5 }}>{r.local_trabajo}</Text>
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
                          empresa={proyectoInfo?.descripcion || 'SIN DESC'} 
                          layout={pdfLayout}
                          tituloMonitoreo={monitoreoInfo?.tipo_monitoreo || 'Ventilación'} 
                          descripcionProyecto={''}
                      />
                  </PDFViewer>
              )}
          </div>
      </Modal>
    </>
  );
};

export default VentilacionPage;