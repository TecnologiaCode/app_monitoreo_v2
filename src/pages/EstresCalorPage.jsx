import React, { useEffect, useMemo, useState, useCallback } from 'react';
import {
  Table, Button, Form, Input, Modal, Select, Typography, Space, Tooltip,
  message, Spin, InputNumber, Breadcrumb, TimePicker, Row, Col, Descriptions,
  Pagination, Checkbox, Progress
} from 'antd';
import {
  PlusOutlined, EditOutlined, DeleteOutlined, HomeOutlined, DatabaseOutlined,
  ExclamationCircleOutlined, ArrowLeftOutlined, FileExcelOutlined, EyeOutlined,
  FilePdfOutlined, SaveOutlined, LeftOutlined, RightOutlined
} from '@ant-design/icons';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { supabase } from '../supabaseClient.js';
import dayjs from 'dayjs';
import 'dayjs/locale/es';
import utc from 'dayjs/plugin/utc';
import * as XLSX from 'xlsx';

// IMPORTS DEL REPORTE FOTOGRÁFICO
import { PDFViewer } from '@react-pdf/renderer';
import { ReporteFotografico } from '../components/ReporteFotografico';

dayjs.locale('es');
dayjs.extend(utc);

const { Title, Text } = Typography;
const { Option } = Select;
const PRIMARY_BLUE = '#2a8bb6';
const TABLE_NAME = 'estres_calor';

/* =========================================================
   Helpers & Utilidades
   ========================================================= */

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

/**
 * PROCESAMIENTO OPTIMIZADO PARA MUCHOS REGISTROS
 * - Reduce tamaño a 800px (Suficiente para PDF Carta)
 * - Calidad 0.6
 * - Evita colgar el navegador
 */
const processImageForPdf = (url) => {
  return new Promise((resolve) => {
    // Timeout de 4s por imagen
    const timeoutId = setTimeout(() => {
      resolve(url); 
    }, 4000); 

    const img = new Image();
    img.crossOrigin = 'Anonymous'; 
    img.src = url;

    img.onload = () => {
      clearTimeout(timeoutId);
      try {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        // OPTIMIZACIÓN: Max 800px para velocidad con 150 fotos
        const MAX_SIZE = 800;
        if (width > height) {
          if (width > MAX_SIZE) {
            height *= MAX_SIZE / width;
            width = MAX_SIZE;
          }
        } else {
          if (height > MAX_SIZE) {
            width *= MAX_SIZE / height;
            height = MAX_SIZE;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);

        // Calidad 0.6
        const dataUrl = canvas.toDataURL('image/jpeg', 0.6);
        resolve(dataUrl); 
      } catch (error) {
        resolve(url);
      }
    };

    img.onerror = () => {
      clearTimeout(timeoutId);
      resolve(url);
    };
  });
};

/* =========================================================
   Exportar a Excel
   ========================================================= */
const exportToExcel = (rows = [], header) => {
  try {
    const empresaNombre = typeof header === 'object' ? (header.empresa || '—') : (header || '—');
    const fechaMonitoreo = typeof header === 'object' ? (header.fecha || '') : '';

    const B = {
      top: { style: 'thin', color: { rgb: '000000' } },
      bottom: { style: 'thin', color: { rgb: '000000' } },
      left: { style: 'thin', color: { rgb: '000000' } },
      right: { style: 'thin', color: { rgb: '000000' } }
    };
    const th = {
      font: { bold: true },
      alignment: { vertical: 'center', horizontal: 'center', wrapText: true },
      fill: { fgColor: { rgb: 'FFFF00' } },
      border: B
    };
    const tdC = { alignment: { vertical: 'center', horizontal: 'center', wrapText: true }, border: B };
    const thL = { font: { bold: true }, alignment: { vertical: 'center', horizontal: 'left', wrapText: true }, border: B };
    const tdL = { alignment: { vertical: 'center', horizontal: 'left', wrapText: true }, border: B };

    const wsData = [];
    wsData.push([{
      v: 'PLANILLA DE MEDICIÓN DE ESTRÉS POR CALOR',
      s: { font: { bold: true, sz: 14 }, alignment: { vertical: 'center', horizontal: 'center' } }
    }]);

    const siNo = (v) =>
      (v === true || String(v) === 'true') ? 'Sí'
        : (v === false || String(v) === 'false') ? 'No'
          : '';

    wsData.push([
      { v: 'NOMBRE DE LA EMPRESA', s: thL }, { v: empresaNombre, s: tdL },
      { v: 'FECHA DE MONITOREO', s: thL }, { v: fechaMonitoreo, s: tdL }
    ]);
    wsData.push([
      { v: 'EQUIPO', s: thL }, { v: header?.equipo || '', s: tdL },
      { v: 'MODELO DEL EQUIPO', s: thL }, { v: header?.modelos || '', s: tdL }
    ]);
    wsData.push([
      { v: 'SERIE DEL EQUIPO', s: thL }, { v: header?.series || '', s: tdL },
      { v: 'ÁREA DE TRABAJO', s: thL }, { v: header?.area || '', s: tdL }
    ]);
    wsData.push(['']);

    wsData.push([
      { v: 'N°', s: th },
      { v: 'AREA DE TRABAJO', s: th },
      { v: 'PUESTO DE TRABAJO', s: th },
      { v: 'INTERIOR/EXTERIOR', s: th }, { v: 'ACLIMATADO', s: th },
      { v: 'FECHA', s: th }, { v: 'HORA DE MEDICIÓN', s: th },
      { v: 'DESCRIPCIÓN DE ACTIVIDADES', s: th }, { v: 'TIPO DE ROPA DE TRABAJO CAV °C', s: th },
      { v: 'CAPUCHA', s: th }, { v: 'TASA METABÓLICA W', s: th },
      { v: '%HR', s: th }, { v: 'VEL. VIENTO (m/s)', s: th }, { v: 'P (mmHg)', s: th }, { v: 'TEMP °C', s: th },
      { v: 'WBGT °C', s: th }, { v: 'WB °C', s: th }, { v: 'GT °C', s: th },
      { v: 'IMÁGENES', s: th }, { v: 'COORDENADAS UTM', s: th }, { v: 'OBSERVACIÓN', s: th },
    ]);

    rows.forEach((r, i) => {
      const imgs = Array.isArray(r.image_urls) ? r.image_urls.join(', ') : (r.image_urls || '');
      const locText = typeof r.location === 'object' ? JSON.stringify(r.location) : (r.location || '');

      wsData.push([
        { v: i + 1, s: tdC },
        { v: r.area || '', s: tdL },
        { v: r.puesto_trabajo || '', s: tdL },
        { v: r.interior_exterior || '', s: tdC },
        { v: siNo(r.aclimatado), s: tdC },
        { v: formatFechaUTC(r.measured_at), s: tdC },
        { v: formatHoraUTC(r.measured_at), s: tdC },
        { v: r.desc_actividades || '', s: tdL },
        { v: r.tipo_ropa_cav || '', s: tdL },
        { v: siNo(r.capucha), s: tdC },
        { v: r.tasa_metabolica ?? '', s: tdL },
        { v: r.hr_percent ?? '', s: tdC },
        { v: r.vel_viento_ms ?? '', s: tdC },
        { v: r.presion_mmhg ?? '', s: tdC },
        { v: r.temp_c ?? '', s: tdC },
        { v: r.wbgt_c ?? '', s: tdC },
        { v: r.wb_c ?? '', s: tdC },
        { v: r.gt_c ?? '', s: tdC },
        { v: imgs, s: tdL },
        { v: locText, s: tdL },
        { v: r.observaciones || '', s: tdL },
      ]);
    });

    const ws = XLSX.utils.aoa_to_sheet(wsData);
    ws['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 20 } }];
    ws['!cols'] = [
      { wch: 6 }, { wch: 30 }, { wch: 30 }, { wch: 16 }, { wch: 12 }, { wch: 12 },
      { wch: 10 }, { wch: 36 }, { wch: 28 }, { wch: 12 }, { wch: 24 }, { wch: 10 },
      { wch: 16 }, { wch: 12 }, { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 10 },
      { wch: 42 }, { wch: 34 }, { wch: 34 }
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Estrés Calor');
    XLSX.writeFile(wb, 'reporte_estres_calor.xlsx');
  } catch (err) {
    console.error('Excel error:', err);
    message.error('No se pudo exportar el Excel.');
  }
};

/* =========================================================
   Componente principal
   ========================================================= */
const EstresCalorPage = () => {
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
    tipo_monitoreo: 'Estrés',
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
  const [pdfLayout, setPdfLayout] = useState('2x4');
  
  // Estado para la barra de progreso
  const [progressPercent, setProgressPercent] = useState(0);
  const [processingStatus, setProcessingStatus] = useState('');

  /* ---------- Cabecera ---------- */
  useEffect(() => {
    (async () => {
      setLoadingHeader(true);
      try {
        if (monitoreoId) {
          const { data: m, error: em } = await supabase
            .from('monitoreos')
            .select('id, tipo_monitoreo, proyecto_id, equipos_asignados')
            .eq('id', monitoreoId)
            .single();
          if (em) throw em;

          const { data: p } = await supabase
            .from('proyectos')
            .select('id, nombre, created_at, descripcion')
            .eq('id', m.proyecto_id)
            .single();

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
      } finally {
        setLoadingHeader(false);
      }
    })();
  }, [projectId, monitoreoId]);

  /* --------- Traer filas (Optimizado con useCallback) --------- */
  const fetchRows = useCallback(async (isBackground = false) => {
    if (!isBackground) setLoading(true);
    try {
      let q = supabase
        .from(TABLE_NAME)
        .select('*')
        .order('measured_at', { ascending: true });

      if (monitoreoId && projectId) {
        q = q.or(`monitoreo_id.eq.${monitoreoId},proyecto_id.eq.${projectId}`);
      } else if (monitoreoId) {
        q = q.eq('monitoreo_id', monitoreoId);
      } else if (projectId) {
        q = q.eq('proyecto_id', projectId);
      }

      const { data, error } = await q;
      if (error) throw error;

      const mapped = (data || []).map((r) => {
        return { ...r, image_urls: getImagesArray(r) };
      });

      setRows(mapped);
      if(!isBackground) setCurrentPage(1);

      if (mapped.length && mapped[0].measured_at) {
        const raw = String(mapped[0].measured_at);
        const [yyyy, mm, dd] = raw.slice(0, 10).split('-');
        setHeaderInfo((h) => ({ ...h, fecha: `${dd}/${mm}/${yyyy}` }));
      }

      const ids = Array.from(new Set(mapped.map(m => m.created_by).filter(Boolean)));
      if (ids.length) {
        const { data: profs } = await supabase
          .from('profiles')
          .select('id, username, nombre_completo')
          .in('id', ids);
        const dict = {};
        (profs || []).forEach((u) => {
          dict[u.id] = u.nombre_completo || u.username || u.id;
        });
        setUsersById(dict);
      }
    } catch (e) {
      if(!isBackground) message.error('No se pudo cargar Estrés.');
    } finally {
      if (!isBackground) setLoading(false);
    }
  }, [monitoreoId, projectId]);

  useEffect(() => {
    fetchRows();
    const ch = supabase
      .channel('rt-estres-calor')
      .on('postgres_changes', { event: '*', schema: 'public', table: TABLE_NAME }, () => fetchRows(true))
      .subscribe();
    return () => supabase.removeChannel(ch);
  }, [fetchRows]);

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
    rows.filter(r => getImagesArray(r).length > 0).forEach(r => {
      allSelected[r.id] = true;
    });
    setRecordSelections(allSelected);
  };
  const handleDeselectAllRecords = () => {
    const allDeselected = {};
    rows.filter(r => getImagesArray(r).length > 0).forEach(r => {
      allDeselected[r.id] = false;
    });
    setRecordSelections(allDeselected);
  };

  const handleOpenPdf = () => {
    const registrosConFotos = rows.filter(r => getImagesArray(r).length > 0);
    if (registrosConFotos.length === 0) {
      message.warning("No hay registros con imágenes.");
      return;
    }
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

  /**
   * GENERACIÓN POR LOTES (BATCHING) + BARRA DE PROGRESO
   */
  const handleSaveAndGenerate = async () => {
    const selectedRows = rows.filter(r => recordSelections[r.id] === true && getImagesArray(r).length > 0);
    if (!selectedRows.length) return message.warning("Seleccione al menos un registro.");

    setPdfStep('processing'); // Cambiamos a vista de carga
    setProgressPercent(0);
    setProcessingStatus('Iniciando procesamiento de imágenes...');

    const BATCH_SIZE = 5; // Procesar 5 imágenes a la vez
    const total = selectedRows.length;
    const finalPdfData = [];
    
    // NOTA: No hacemos UPDATE a Supabase aquí para evitar bucle infinito.

    for (let i = 0; i < total; i += BATCH_SIZE) {
        const batch = selectedRows.slice(i, i + BATCH_SIZE);
        
        // Procesamos el lote en paralelo
        const batchPromises = batch.map(async (r, batchIndex) => {
            const globalIndex = i + batchIndex;
            const imgs = getImagesArray(r);
            const idx = tempSelections[r.id] !== undefined ? tempSelections[r.id] : 0;
            const finalIdx = (idx >= 0 && idx < imgs.length) ? idx : 0;
            const originalUrl = imgs[finalIdx];

            let processedUrl = originalUrl;
            try {
                // Resize y fix rotación (0.6 calidad)
                processedUrl = await processImageForPdf(originalUrl);
            } catch (err) {
                console.warn("Error img", err);
            }

            const codigo = `CAL-${String(globalIndex + 1).padStart(2, '0')}`;
            return {
                imageUrl: processedUrl,
                area: r.area || 'N/A',
                puesto: r.puesto_trabajo,
                codigo: codigo,
                fechaHora: `${formatFechaUTC(r.measured_at)} - ${formatHoraUTC(r.measured_at)}`
            };
        });

        const batchResults = await Promise.all(batchPromises);
        finalPdfData.push(...batchResults);

        // Actualizar progreso
        const currentCount = Math.min(i + BATCH_SIZE, total);
        const percent = Math.round((currentCount / total) * 100);
        setProgressPercent(percent);
        setProcessingStatus(`Procesando ${currentCount} de ${total} imágenes...`);
        
        // Pequeña pausa para el UI
        await new Promise(resolve => setTimeout(resolve, 50));
    }

    setPdfData(finalPdfData);
    setProcessingStatus('Generando documento PDF...');
    
    // Breve timeout final
    setTimeout(() => {
        setPdfStep('view');
    }, 500);
  };

  /* --------- CRUD --------- */
  const handleAdd = () => { setSelected(null); setIsFormOpen(true); };
  const handleEdit = (rec) => { setSelected(rec); setIsFormOpen(true); };
  const handleDelete = (rec) => { /* Tu lógica de delete */ };

  const onOkForm = () => (selected ? doEdit() : doAdd());
  const onCancelForm = () => setIsFormOpen(false);

  // ... Payload ...
  const payloadFromValues = (values) => {
    // ... Tu lógica de payload igual ...
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

    let imageUrls = null;
    if (values.image_urls && values.image_urls.trim() !== '') {
      imageUrls = values.image_urls
        .split(',')
        .map(s => s.trim())
        .filter(Boolean);
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
      tasa_metabolica: values.tasa_metabolica || null,
      hr_percent: toNumberOrString(values.hr_percent),
      vel_viento_ms: toNumberOrString(values.vel_viento_ms),
      presion_mmhg: toNumberOrString(values.presion_mmhg),
      temp_c: toNumberOrString(values.temp_c),
      wbgt_c: toNumberOrString(values.wbgt_c),
      wb_c: toNumberOrString(values.wb_c),
      gt_c: toNumberOrString(values.gt_c),
      observaciones: values.observaciones || null,
      image_urls: imageUrls,
      location: values.location || null,
    };
  };

  const doAdd = async () => { /* ... */ };
  const doEdit = async () => { /* ... */ };

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

  const openImageViewer = (imgs, idx = 0) => {
    const list = Array.isArray(imgs) ? imgs : [];
    if (!list.length) return;
    setImageViewerList(list);
    setImageViewerIndex(idx);
    setImageViewerOpen(true);
  };

  const breadcrumbItems = [
    { title: <Link to="/"><HomeOutlined /></Link> },
    { title: <Link to="/proyectos">Proyectos</Link> },
    { title: <Link to={`/proyectos/${projectId}/monitoreo`}><DatabaseOutlined /> Monitoreos</Link> },
    { title: 'Estrés por Calor' }
  ];

  /* ---------- Columnas ORIGINALES (Restauradas) ---------- */
  const columns = [
    {
      title: 'N°',
      key: 'n',
      width: 60,
      render: (_, __, i) => (currentPage - 1) * pageSize + i + 1
    },
    {
      title: 'FECHA',
      dataIndex: 'measured_at',
      width: 120,
      sorter: (a, b) => dayjs(a.measured_at).unix() - dayjs(b.measured_at).unix(),
      defaultSortOrder: 'ascend',
      render: (t) => formatFechaUTC(t)
    },
    {
      title: 'HORA',
      dataIndex: 'measured_at',
      key: 'measured_time',
      sorter: (a, b) => dayjs(a.measured_at).unix() - dayjs(b.measured_at).unix(),
      width: 90,
      render: (t) => formatHoraUTC(t),
    },
    { title: 'AREA DE TRABAJO', dataIndex: 'area', key: 'area', width: 250, ellipsis: true },
    { title: 'PUESTO DE TRABAJO', dataIndex: 'puesto_trabajo', key: 'puesto_trabajo', width: 250, ellipsis: true },
    { title: 'INTERIOR/EXTERIOR', dataIndex: 'interior_exterior', key: 'interior_exterior', width: 150 },
    {
      title: 'ACLIMATADO',
      dataIndex: 'aclimatado',
      key: 'aclimatado',
      width: 110,
      render: (v) =>
        (String(v) === 'true' ? 'Sí'
          : String(v) === 'false' ? 'No'
            : String(v ?? ''))
    },

    {
      title: 'DESCRIPCIÓN DE ACTIVIDADES',
      dataIndex: 'desc_actividades',
      key: 'desc_actividades',
      width: 260,
      ellipsis: true
    },
    {
      title: 'TIPO DE ROPA DE TRABAJO CAV °C',
      dataIndex: 'tipo_ropa_cav',
      key: 'tipo_ropa_cav',
      width: 240,
      ellipsis: true
    },
    {
      title: 'CAPUCHA',
      dataIndex: 'capucha',
      key: 'capucha',
      width: 80,
      render: (v) =>
        (String(v) === 'true' ? 'Sí'
          : String(v) === 'false' ? 'No'
            : String(v ?? ''))
    },
    {
      title: 'TASA METABÓLICA W',
      dataIndex: 'tasa_metabolica',
      key: 'tasa_metabolica',
      width: 200,
      ellipsis: true
    },

    {
      title: 'RESULTADOS DEL EQUIPO',
      children: [
        { title: '%HR', dataIndex: 'hr_percent', key: 'hr_percent', width: 90 },
        { title: 'VEL. VIENTO (m/s)', dataIndex: 'vel_viento_ms', key: 'vel_viento_ms', width: 140 },
        { title: 'P (mmHg)', dataIndex: 'presion_mmhg', key: 'presion_mmhg', width: 110 },
        { title: 'TEMP °C', dataIndex: 'temp_c', key: 'temp_c', width: 100 },
        { title: 'WBGT °C', dataIndex: 'wbgt_c', key: 'wbgt_c', width: 100 },
        { title: 'WB °C', dataIndex: 'wb_c', key: 'wb_c', width: 100 },
        { title: 'GT °C', dataIndex: 'gt_c', key: 'gt_c', width: 100 },
      ],
    },

    {
      title: 'COORDENADAS UTM',
      dataIndex: 'location',
      key: 'location',
      width: 240,
      render: (v) => renderLocation(v)
    },

      {
          title: 'IMÁGENES',
          dataIndex: 'image_urls',
          key: 'image_urls',
          width: 140,
          render: (imgs) => {
            const list = Array.isArray(imgs) ? imgs : [];
            if (!list.length) return <Text type="secondary">Ninguna</Text>;
            return (
              <Button type="link" icon={<EyeOutlined />} onClick={() => openImageViewer(list, 0)} size="small">
                Ver imagen
              </Button>
            );
          },
        },

    {
      title: 'OBSERVACIÓN',
      dataIndex: 'observaciones',
      key: 'observaciones',
      width: 240,
      ellipsis: true
    },

    {
      title: 'Registrado por',
      dataIndex: 'created_by',
      key: 'created_by',
      width: 190,
      fixed: 'right',
      render: (v) => {
        if (!v) return <Text type="secondary">N/A</Text>;
        const display = usersById[v];
        return display ? <Text>{display}</Text> : <Text type="secondary">{v}</Text>;
      },
    },
    {
      title: 'Acciones',
      key: 'acciones',
      fixed: 'right',
      width: 120,
      render: (_, record) => (
        <Space size="small">
          <Tooltip title="Editar">
            <Button icon={<EditOutlined />} onClick={() => handleEdit(record)} />
          </Tooltip>
          <Tooltip title="Eliminar">
            <Button danger icon={<DeleteOutlined />} onClick={() => handleDelete(record)} />
          </Tooltip>
        </Space>
      ),
    },
  ];

  return (
    <>
      <Breadcrumb items={breadcrumbItems} style={{ margin: '16px 0' }} />

      <Row justify="space-between" align="middle" style={{ marginBottom: 8 }}>
        <Col>
          <Title level={2} style={{ color: PRIMARY_BLUE, marginBottom: 0 }}>
            Monitoreo de Estrés por Calor
          </Title>
        </Col>
        <Col>
          <Space>
            <Button onClick={() => navigate(`/proyectos/${projectId}/monitoreo`)}>
              <ArrowLeftOutlined /> Volver a Monitoreos
            </Button>
            <Button
              icon={<FileExcelOutlined />}
              onClick={() => exportToExcel(rows, headerInfo)}
            >
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
              Agregar
            </Button>
          </Space>
        </Col>
      </Row>

      {/* Buscador */}
      <Row justify="space-between" align="middle" style={{ marginBottom: 12, gap: 15 }}>
        <Col flex="0 0 520px">
          <Input.Search
            allowClear
            placeholder="Buscar por puesto, actividades, metabolismo, aislamiento..."
            value={searchText}
            onChange={(e) => {
              setSearchText(e.target.value);
              setCurrentPage(1);
            }}
          />
        </Col>
        <Col>
          <Space>
            <Text type="secondary">Ver:</Text>
            <Select
              value={pageSize}
              onChange={(val) => {
                setPageSize(val);
                setCurrentPage(1);
              }}
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
          <Descriptions.Item label="NOMBRE DE LA EMPRESA">{headerInfo.empresa}</Descriptions.Item>
          <Descriptions.Item label="FECHA DE MONITOREO">{headerInfo.fecha}</Descriptions.Item>
          <Descriptions.Item label="AREA DE TRABAJO">{headerInfo.area}</Descriptions.Item>
          <Descriptions.Item label="EQUIPO">{headerInfo.equipo}</Descriptions.Item>
          <Descriptions.Item label="MODELO DEL EQUIPO">{headerInfo.modelos}</Descriptions.Item>
          <Descriptions.Item label="SERIE DEL EQUIPO">{headerInfo.series}</Descriptions.Item>
        </Descriptions>
      </Spin>

      <Spin spinning={loading}>
        <div style={{ overflowX: 'auto' }}>
          <Table
            className="tabla-general"
            size="small"
            columns={columns}
            dataSource={pageData}
            rowKey="id"
            pagination={false}
            scroll={{ x: 1800 }}
          />
        </div>
      </Spin>

      <Row justify="space-between" align="middle" style={{ marginTop: 12 }}>
        <Col>
          {(() => {
            const mostrados = Math.min(currentPage * pageSize, totalFiltered);
            return (
              <Text type="secondary">
                Registros {mostrados} de {totalFiltered}
              </Text>
            );
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

      <Modal
        title={selected ? 'Editar registro de Estrés Calor' : 'Agregar registro de Estrés Calor'}
        open={isFormOpen}
        onOk={onOkForm}
        onCancel={onCancelForm}
        confirmLoading={saving}
        //destroyOnClose={true} 
        destroyOnHidden={true}  
        width={900}
      >
        <Form form={form} layout="vertical" preserve={false} initialValues={selected ? { ...selected, horario: selected.measured_at ? dayjs(selected.measured_at).utc().local() : null } : {}}>
           {/* ...Campos del Formulario (Simplificado para el ejemplo, asegurate de tenerlos todos)... */}
           <Row gutter={12}>
            <Col span={12}><Form.Item name="area" label="Área de Trabajo" rules={[{ required: true }]}><Input /></Form.Item></Col>
            <Col span={12}><Form.Item name="puesto_trabajo" label="Puesto de Trabajo" rules={[{ required: true }]}><Input /></Form.Item></Col>
           </Row>
           {/* ...Resto de tus campos... */}
           <Form.Item name="image_urls" label="URLs Imágenes"><Input.TextArea /></Form.Item>
        </Form>
      </Modal>

      {/* --- MODAL PDF CON BARRA DE PROGRESO Y OPCIÓN 3x4 --- */}
      <Modal title="Vista Previa PDF" open={isPdfModalVisible} onCancel={() => setIsPdfModalVisible(false)} width={1000} style={{ top: 20 }}
        footer={null} // Controlado internamente
        //destroyOnClose={false}
        destroyOnHidden={false}
        maskClosable={pdfStep !== 'processing'}
      >
        
        {/* PASO 1: SELECCIÓN */}
        {pdfStep === 'selection' && (
           <div style={{display:'flex', flexDirection:'column', height: '70vh'}}>
              <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center', background:'#f5f5f5', padding: 10, borderRadius: 5 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Button size="small" onClick={handleSelectAllRecords}>Todos</Button>
                    <Button size="small" onClick={handleDeselectAllRecords}>Ninguno</Button>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Text strong>Distribución:</Text>
                    <Select value={pdfLayout} onChange={setPdfLayout} style={{ width: 120 }}>
                        <Option value="2x2">2 x 2</Option>
                        <Option value="2x3">2 x 3</Option>
                        <Option value="2x4">2 x 4</Option>
                        <Option value="3x3">3 x 3</Option>
                        <Option value="3x4">3 x 4</Option> {/* NUEVA OPCION */}
                    </Select>
                    <Button type="primary" icon={<SaveOutlined />} onClick={handleSaveAndGenerate}>Generar PDF</Button>
                  </div>
              </div>

              <div style={{ flex: 1, overflowY: 'auto', padding: 5 }}>
                 <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', justifyContent: 'center' }}>
                     {rows.filter(r => getImagesArray(r).length > 0).map(r => {
                         const imgs = getImagesArray(r);
                         const currentIdx = tempSelections[r.id] || 0;
                         const isSelected = recordSelections[r.id] === true;
                         return (
                             <div key={r.id} style={{ 
                                 width: '23%', // ESTILO ORIGINAL RESTAURADO
                                 border: isSelected ? '1px solid #ddd' : '1px dashed #999', 
                                 opacity: isSelected ? 1 : 0.5, 
                                 padding: 8, 
                                 position: 'relative',
                                 backgroundColor: isSelected ? '#fff' : 'transparent'
                             }}>
                                 <Checkbox checked={isSelected} onChange={() => handleRecordSelectionToggle(r.id)} style={{ position: 'absolute', top: 5, right: 5, zIndex: 20 }} />
                                 <div style={{ position: 'relative', width: '100%', height: 150, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#fff' }}>
                                     <img src={imgs[currentIdx]} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
                                     {imgs.length > 1 && (
                                         <>
                                             <Button icon={<LeftOutlined />} size="small" style={{ position: 'absolute', left: 0 }} onClick={() => handlePrevImage(r.id, imgs.length)} />
                                             <Button icon={<RightOutlined />} size="small" style={{ position: 'absolute', right: 0 }} onClick={() => handleNextImage(r.id, imgs.length)} />
                                         </>
                                     )}
                                 </div>
                                 <Text style={{ fontSize: 11 }}>{r.puesto_trabajo}</Text>
                             </div>
                         )
                     })}
                 </div>
              </div>
           </div>
        )}

        {/* PASO 2: PROCESANDO (Loading Bar) */}
        {pdfStep === 'processing' && (
            <div style={{
                height: '50vh', display: 'flex', flexDirection: 'column', 
                justifyContent: 'center', alignItems: 'center', padding: 40
            }}>
                <Spin size="large" />
                <div style={{ marginTop: 30, width: '80%' }}>
                    <Progress percent={progressPercent} status="active" />
                </div>
                <Text style={{ marginTop: 15, fontSize: 16 }}>{processingStatus}</Text>
            </div>
        )}

        {/* PASO 3: VISOR PDF */}
        {pdfStep === 'view' && (
            <div style={{height: '80vh', display:'flex', flexDirection:'column'}}>
                <Button onClick={() => setPdfStep('selection')} icon={<ArrowLeftOutlined/>} style={{marginBottom: 10, width: 'fit-content'}}>Volver</Button>
                {pdfData.length > 0 && (
                    <PDFViewer width="100%" height="100%" showToolbar={true}>
                        <ReporteFotografico data={pdfData} empresa={headerInfo.descripcion_proyecto || ''} layout={pdfLayout} tituloMonitoreo={headerInfo.tipo_monitoreo} />
                    </PDFViewer>
                )}
            </div>
        )}
      </Modal>

      {/* --- MODAL VISOR DE IMÁGENES (ACTUALIZADO) --- */}
      <Modal
        open={imageViewerOpen}
        onCancel={() => setImageViewerOpen(false)}
        centered // Centra el modal en la pantalla
        width={720}
        title="Imagen del registro"
        // LÓGICA DE BOTONES EN EL FOOTER (PIE DE PAGINA DEL MODAL)
        footer={
          imageViewerList.length > 1
            ? [
                // Botón Anterior (Estilo Default: Blanco con borde)
                <Button
                  key="prev"
                  onClick={() =>
                    setImageViewerIndex((prev) => (prev - 1 + imageViewerList.length) % imageViewerList.length)
                  }
                >
                  Anterior
                </Button>,
                // Botón Siguiente (Estilo Primary: Azul relleno)
                <Button
                  key="next"
                  type="primary"
                  onClick={() =>
                    setImageViewerIndex((prev) => (prev + 1) % imageViewerList.length)
                  }
                >
                  Siguiente
                </Button>,
              ]
            : null // Si solo hay 1 imagen, no muestra botones abajo
        }
      >
        {imageViewerList.length > 0 ? (
          <div style={{ textAlign: 'center' }}>
            <img
              src={imageViewerList[imageViewerIndex]}
              alt="registro"
              style={{ maxWidth: '100%', maxHeight: '80vh', objectFit: 'contain' }}
            />
            {/* Contador de imágenes (Ej: 1 / 2) */}
            <div style={{ marginTop: 15, fontSize: '15px' }}>
              {imageViewerIndex + 1} / {imageViewerList.length}
            </div>
          </div>
        ) : (
          <Text type="secondary">Sin imagen.</Text>
        )}
      </Modal>
    </>
  );
};

export default EstresCalorPage;