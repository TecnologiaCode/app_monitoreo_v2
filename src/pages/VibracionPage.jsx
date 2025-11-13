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
} from '@ant-design/icons';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { supabase } from '../supabaseClient.js';

import dayjs from 'dayjs';
import 'dayjs/locale/es';
import utc from 'dayjs/plugin/utc';
import XLSX from 'xlsx-js-style';

dayjs.locale('es');
dayjs.extend(utc);
//dayjs.extend(timezone);

const { Title, Text } = Typography;
const { Option } = Select;
const PRIMARY_BLUE = '#2a8bb6';
const TABLE_NAME = 'vibracion';

const formatHoraUTC = (v) => {
  if (!v) return '';
  try {
    // .local() convierte el timestamp UTC a la zona horaria del navegador
    return dayjs(v).utc().format('HH:mm');
  } catch {
    return String(v);
  }
};

/**
 * MUESTRA la fecha local.
 * Toma un timestamp UTC de la base de datos y lo formatea a la fecha local del navegador.
 * @param {string} v - El timestamp UTC
 * @returns {string} - La fecha en formato local (ej: "06/11/2025")
 */
const formatFechaUTC = (v) => {
  if (!v) return '';
  try {
    // .local() convierte el timestamp UTC a la zona horaria del navegador
    return dayjs(v).utc().format('DD/MM/YYYY');
  } catch {
    return String(v);
  }
};


const renderLocation = (v) => {
  if (!v) return <Text type="secondary">N/A</Text>;
  if (typeof v === 'object') {
    const lat = v.lat ?? v.latitude ?? '';
    const lng = v.lng ?? v.longitude ?? '';
    if (lat !== '' || lng !== '') {
      return <span>lat: {lat}{lng !== '' ? `, lng: ${lng}` : ''}</span>;
    }
    const e = v.easting ?? '';
    const n = v.northing ?? '';
    const z = v.utm_zone ?? '';
    if (e !== '' || n !== '' || z !== '') {
      return <span>{`E: ${e}${n !== '' ? `, N: ${n}` : ''}${z ? `, Z: ${z}` : ''}`}</span>;
    }
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

const toNumberOrString = (v) => {
  if (v === null || v === undefined || v === '') return null;
  if (typeof v === 'number') return v;
  const s = String(v).replace(',', '.');
  const n = Number(s);
  return Number.isNaN(n) ? String(v) : n;
};

const posturaDisplay = (postura, otro) =>
  postura === 'Otro' && otro ? `${postura} (${otro})` : (postura || '');

/* ============================ Export a Excel ============================ */
/**
 * Exporta un libro por cada registro, en formato de hoja “formulario”
 * con secciones y estilos similares a la imagen:
 * - Encabezado gris para sección
 * - Etiquetas en amarillo
 * - Valores en celdas normales
 * Al final: IMÁGENES, COORDENADAS UTM, OBSERVACIONES
 */
const exportToExcel = (rows = [], header) => {
  try {
    const empresaNombre =
      typeof header === 'object' ? (header.empresa || '—') : (header || '—');
    const fechaMonitoreo =
      typeof header === 'object' ? (header.fecha || '') : '';

    // Bordes
    const B = {
      top: { style: 'thin', color: { rgb: '000000' } },
      bottom: { style: 'thin', color: { rgb: '000000' } },
      left: { style: 'thin', color: { rgb: '000000' } },
      right: { style: 'thin', color: { rgb: '000000' } },
    };

    const sec = { // Sección (gris)
      font: { bold: true },
      alignment: { vertical: 'center', horizontal: 'left' },
      fill: { fgColor: { rgb: 'D9D9D9' } },
      border: B,
    };
    const lab = { // Etiqueta (amarillo)
      font: { bold: true },
      alignment: { vertical: 'center', horizontal: 'left', wrapText: true },
      fill: { fgColor: { rgb: 'FFFF00' } },
      border: B,
    };
    const val = { // Valor
      alignment: { vertical: 'center', horizontal: 'left', wrapText: true },
      border: B,
    };
    const title = { // Título superior
      font: { bold: true, sz: 14 },
      alignment: { vertical: 'center', horizontal: 'center' },
      border: B,
    };

    const wb = XLSX.utils.book_new();

    rows.forEach((r, idx) => {
      const wsData = [];

      // Título hoja
      wsData.push([{ v: 'PLANILLA DE MONITOREO DE VIBRACIONES', s: title }]);
      // Meta empresa/fecha
      wsData.push([
        { v: 'NOMBRE DE LA EMPRESA', s: lab }, { v: empresaNombre, s: val },
        { v: 'FECHA DE MONITOREO', s: lab }, { v: fechaMonitoreo, s: val },
      ]);
      wsData.push(['']); // espacio

      // Sección: INFORMACIÓN GENERAL
      wsData.push([{ v: 'INFORMACION GENERAL', s: sec }]);
      wsData.push([{ v: 'Area de trabajo', s: lab }, { v: r.area_trabajo || '', s: val }]);
      wsData.push([{ v: 'Puesto de trabajo', s: lab }, { v: r.puesto_trabajo || '', s: val }]);
      wsData.push([{ v: 'Trabajador Evaluado', s: lab }, { v: r.trabajador_evaluado || '', s: val }]);
      wsData.push([{ v: 'Máquina / Equipo', s: lab }, { v: r.maquina_equipo || '', s: val }]);
      wsData.push([{ v: 'Duración de la Jornada (h)', s: lab }, { v: r.duracion_jornada_h ?? '', s: val }]);
      wsData.push([{ v: 'Tiempo de Exposición (TE) (h)', s: lab }, { v: r.tiempo_expos_h ?? '', s: val }]);
      wsData.push([{ v: 'Postura del evaluado', s: lab }, { v: posturaDisplay(r.postura, r.postura_otro), s: val }]);
      wsData.push([{ v: 'Duración de la prueba (min)', s: lab }, { v: r.duracion_prueba_min ?? '', s: val }]);
      wsData.push([{ v: 'Hora de medición', s: lab }, { v: formatHoraUTC(r.measured_at), s: val }]);

      wsData.push(['']); // espacio

      // Sección: CUERPO ENTERO
      wsData.push([{ v: 'MONITOREO CUERPO ENTERO', s: sec }]);
      wsData.push([{ v: 'Ubicación del acelerómetro', s: lab }, { v: r.ub_acelerometro || '', s: val }]);
      wsData.push([{ v: 'AeqX (m/s²)', s: lab }, { v: r.aeqx_ce ?? '', s: val }]);
      wsData.push([{ v: 'AeqY (m/s²)', s: lab }, { v: r.aeqy_ce ?? '', s: val }]);
      wsData.push([{ v: 'AeqZ (m/s²)', s: lab }, { v: r.aeqz_ce ?? '', s: val }]);

      wsData.push(['']); // espacio

      // Sección: MANO-BRAZO
      wsData.push([{ v: 'MONITOREO MANO-BRAZO', s: sec }]);
      wsData.push([{ v: 'Mano más afectada', s: lab }, { v: r.mano_afectada || '', s: val }]);
      wsData.push([{ v: 'AeqX (m/s²)', s: lab }, { v: r.aeqx_mb ?? '', s: val }]);
      wsData.push([{ v: 'AeqY (m/s²)', s: lab }, { v: r.aeqy_mb ?? '', s: val }]);
      wsData.push([{ v: 'AeqZ (m/s²)', s: lab }, { v: r.aeqz_mb ?? '', s: val }]);

      wsData.push(['']); // espacio

      // Extras: Imágenes / UTM / Observaciones
      const imgs = Array.isArray(r.image_urls) ? r.image_urls.join(', ') : (r.image_urls || '');
      const locText = typeof r.location === 'object' ? JSON.stringify(r.location) : (r.location || '');

      wsData.push([{ v: 'Imágenes', s: lab }, { v: imgs, s: val }]);
      wsData.push([{ v: 'Coordenadas UTM', s: lab }, { v: locText, s: val }]);
      wsData.push([{ v: 'Observaciones', s: lab }, { v: r.observaciones || '', s: val }]);

      const ws = XLSX.utils.aoa_to_sheet(wsData);

      // Anchos de columnas (formato de 2 columnas amplias)
      ws['!cols'] = [{ wch: 42 }, { wch: 60 }, { wch: 20 }, { wch: 20 }];

      // Merges del título y de encabezados de sección (col 0..1)
      const merges = [
        { s: { r: 0, c: 0 }, e: { r: 0, c: 1 } }, // título
      ];
      // Encuentra filas de secciones para mergearlas a 2 columnas
      wsData.forEach((row, rIndex) => {
        if (Array.isArray(row) && row.length === 1 && row[0]?.s === sec) {
          merges.push({ s: { r: rIndex, c: 0 }, e: { r: rIndex, c: 1 } });
        }
      });
      ws['!merges'] = merges;

      XLSX.utils.book_append_sheet(wb, ws, `Vibración ${idx + 1}`);
    });

    XLSX.writeFile(wb, 'reporte_vibracion.xlsx');
    //message.success('✅ Archivo Excel generado correctamente');

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

  /* --------- Cabecera (proyecto/monitoreo/equipos) --------- */
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
            .select('id, nombre, created_at')
            .eq('id', m.proyecto_id)
            .single();

          // Equipos
          let equipos = [];
          let ids = m.equipos_asignados;
          if (typeof ids === 'string') { try { ids = JSON.parse(ids); } catch { ids = []; } }
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
          }));
        } else if (projectId) {
          const { data: p } = await supabase
            .from('proyectos')
            .select('id, nombre, created_at')
            .eq('id', projectId)
            .single();

          setHeaderInfo((h) => ({
            ...h,
            empresa: p?.nombre || '—',
            fecha: p?.created_at ? dayjs(p.created_at).format('DD/MM/YYYY') : '—',
          }));
        }
      } catch (e) {
        console.error('Header error:', e);
      } finally {
        setLoadingHeader(false);
      }
    })();
  }, [projectId, monitoreoId]);

  /* --------- Traer filas (incluye registros antiguos) --------- */
  const fetchRows = async () => {
    setLoading(true);
    try {
      let q = supabase.from(TABLE_NAME).select('*').order('inserted_at', { ascending: true });

      // Incluir filas que tengan solo proyecto_id o solo monitoreo_id
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
        let imageUrls = [];
        if (Array.isArray(r.image_urls)) imageUrls = r.image_urls;
        else if (typeof r.image_urls === 'string' && r.image_urls.trim() !== '') {
          imageUrls = r.image_urls.split(',').map((s) => s.trim());
        }
        return {
          ...r,
          duracion_jornada_h: toNumberOrString(r.duracion_jornada_h),
          tiempo_expos_h: toNumberOrString(r.tiempo_expos_h),
          duracion_prueba_min: toNumberOrString(r.duracion_prueba_min),
          aeqx_ce: toNumberOrString(r.aeqx_ce),
          aeqy_ce: toNumberOrString(r.aeqy_ce),
          aeqz_ce: toNumberOrString(r.aeqz_ce),
          aeqx_mb: toNumberOrString(r.aeqx_mb),
          aeqy_mb: toNumberOrString(r.aeqy_mb),
          aeqz_mb: toNumberOrString(r.aeqz_mb),
          image_urls: imageUrls,
        };
      });

      setRows(mapped);
      setCurrentPage(1);

      // Fecha cabecera con primera fila
      if (mapped.length && mapped[0].measured_at) {
        const raw = String(mapped[0].measured_at);
        const [yyyy, mm, dd] = raw.slice(0, 10).split('-');
        setHeaderInfo((h) => ({ ...h, fecha: `${dd}/${mm}/${yyyy}` }));
      }

      // Perfiles (created_by)
      const ids = Array.from(new Set(mapped.map(m => m.created_by).filter(Boolean)));
      if (ids.length) {
        const { data: profs } = await supabase
          .from('profiles')
          .select('id, username, nombre_completo, email, descripcion, rol, estado')
          .in('id', ids);
        const dict = {};
        (profs || []).forEach((u) => {
          const display =
            (u.nombre_completo && u.nombre_completo.trim()) ||
            (u.username && u.username.trim()) ||
            (u.descripcion && u.descripcion.trim()) ||
            (u.rol && u.rol.trim()) ||
            (u.estado && u.estado.trim()) ||
            (u.email && u.email.trim()) ||
            u.id;
          dict[u.id] = display;
        });
        setUsersById(dict);
      } else {
        setUsersById({});
      }
    } catch (e) {
      console.error('Fetch error:', e);
      message.error('No se pudo cargar Vibración.');
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRows();
    const ch = supabase
      .channel('rt-vibracion')
      .on('postgres_changes', { event: '*', schema: 'public', table: TABLE_NAME }, fetchRows)
      .subscribe();
    return () => supabase.removeChannel(ch);
  }, [projectId, monitoreoId]);

  /* ------------------------------- CRUD ------------------------------- */
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
    // ================== HORA LOCAL SIN DESFASE ==================
    let measuredAt = null;
    if (values.horario) {
      const h = values.horario.hour();
      const m = values.horario.minute();
      // ✅ Base local: si el registro ya tenía fecha, la usamos; si no, hoy (local)
      const base = selected?.measured_at ? dayjs(selected.measured_at) : dayjs();
      const local = base.hour(h).minute(m).second(0).millisecond(0);
      // ✅ Guardar con offset local (NO usar .toISOString() que convierte a UTC)
      measuredAt = local.format('YYYY-MM-DD[T]HH:mm:ssZ'); // ej: 2025-11-03T01:31:00-04:00
    } else if (selected?.measured_at) {
      measuredAt = selected.measured_at;
    }
    // =============================================================

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
    } catch (e) {
      console.error(e);
      message.error('No se pudo agregar.');
    } finally { setSaving(false); }
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
    } catch (e) {
      console.error(e);
      message.error('No se pudo actualizar.');
    } finally { setSaving(false); }
  };

  /* --------- Filtro / Paginación y visor de imágenes --------- */
  const filtered = useMemo(() => {
    if (!searchText) return rows;
    const s = searchText.toLowerCase();
    return rows.filter(r => {
      const imgs = Array.isArray(r.image_urls) ? r.image_urls.join(',') : (r.image_urls || '');
      return (
        (r.area_trabajo && r.area_trabajo.toLowerCase().includes(s)) ||
        (r.puesto_trabajo && r.puesto_trabajo.toLowerCase().includes(s)) ||
        (r.trabajador_evaluado && r.trabajador_evaluado.toLowerCase().includes(s)) ||
        (r.maquina_equipo && r.maquina_equipo.toLowerCase().includes(s)) ||
        (posturaDisplay(r.postura, r.postura_otro).toLowerCase().includes(s)) ||
        (r.mano_afectada && r.mano_afectada.toLowerCase().includes(s)) ||
        (formatHoraUTC(r.measured_at) && formatHoraUTC(r.measured_at).includes(s)) ||
        (imgs && imgs.toLowerCase().includes(s)) ||
        (r.observaciones && r.observaciones.toLowerCase().includes(s))
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

  /* ------------------------------ Columnas ------------------------------ */
  const columns = [
    { title: 'N°', key: 'n', width: 60, render: (_, __, i) => (currentPage - 1) * pageSize + i + 1 },
    
    // Nueva columna Fecha
        {
          title: 'FECHA',
          dataIndex: 'measured_at',
          key: 'measured_date',
          // ✅ Permite ordenar ascendente/descendente por fecha
          sorter: (a, b) => dayjs(a.measured_at).unix() - dayjs(b.measured_at).unix(),
          defaultSortOrder: 'descend',
          width: 120, render: (t) => formatFechaUTC(t),
        },
    
     {
          title: 'HORA',
          dataIndex: 'measured_at',
          key: 'measured_at',
          // ✅ Permite ordenar ascendente/descendente por hora
          sorter: (a, b) => dayjs(a.measured_at).unix() - dayjs(b.measured_at).unix(),
          width: 110, render: (t) => formatHoraUTC(t) || <Text type="secondary">—</Text>
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

    {
      title: 'CUERPO ENTERO',
      children: [
        { title: 'Ubicación Acel.', dataIndex: 'ub_acelerometro', key: 'ub_acelerometro', width: 160 },
        { title: 'AeqX', dataIndex: 'aeqx_ce', key: 'aeqx_ce', width: 90 },
        { title: 'AeqY', dataIndex: 'aeqy_ce', key: 'aeqy_ce', width: 90 },
        { title: 'AeqZ', dataIndex: 'aeqz_ce', key: 'aeqz_ce', width: 90 },
      ],
    },

    {
      title: 'MANO-BRAZO',
      children: [
        { title: 'Mano', dataIndex: 'mano_afectada', key: 'mano_afectada', width: 110 },
        { title: 'AeqX', dataIndex: 'aeqx_mb', key: 'aeqx_mb', width: 90 },
        { title: 'AeqY', dataIndex: 'aeqy_mb', key: 'aeqy_mb', width: 90 },
        { title: 'AeqZ', dataIndex: 'aeqz_mb', key: 'aeqz_mb', width: 90 },
      ],
    },

    { title: 'COORDENADAS UTM', dataIndex: 'location', key: 'location', width: 240, render: (v) => renderLocation(v) },

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

    { title: 'OBSERVACIÓN', dataIndex: 'observaciones', key: 'observaciones', width: 240, ellipsis: true },

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

  /* ------------------------------- Render ------------------------------- */
  return (
    <>
      <Breadcrumb style={{ margin: '16px 0' }}>
        <Breadcrumb.Item><Link to="/"><HomeOutlined /></Link></Breadcrumb.Item>
        <Breadcrumb.Item><Link to="/proyectos">Proyectos</Link></Breadcrumb.Item>
        <Breadcrumb.Item>
          <Link to={`/proyectos/${projectId}/monitoreo`}><DatabaseOutlined /> Monitoreos</Link>
        </Breadcrumb.Item>
        <Breadcrumb.Item>Vibración</Breadcrumb.Item>
      </Breadcrumb>

      <Row justify="space-between" align="middle" style={{ marginBottom: 8 }}>
        <Col>
          <Title level={2} style={{ color: PRIMARY_BLUE, marginBottom: 0 }}>Monitoreo de Vibraciones</Title>
        </Col>
        <Col>
          <Space>
            <Button onClick={() => navigate(`/proyectos/${projectId}/monitoreo`)}>
              <ArrowLeftOutlined /> Volver a Monitoreos
            </Button>
            <Button icon={<FileExcelOutlined />} onClick={() => exportToExcel(rows, headerInfo)}>
              Exportar a Excel
            </Button>
            <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>
              Agregar
            </Button>
          </Space>
        </Col>
      </Row>

      {/* Buscador + tamaño de página */}
      <Row justify="space-between" align="middle" style={{ marginBottom: 12, gap: 15 }}>
        <Col flex="0 0 520px">
          <Input.Search
            allowClear
            placeholder="Buscar por área, puesto, trabajador, equipo, observación..."
            value={searchText}
            onChange={(e) => { setSearchText(e.target.value); setCurrentPage(1); }}
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
            size="small"
            columns={columns}
            dataSource={pageData}
            rowKey="id"
            pagination={false}
            /* Sin scroll vertical: solo horizontal */
            scroll={{ x: 'max-content' }}
          />
        </div>
      </Spin>

      {/* Pie paginación */}
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

      {/* Modal formulario */}
      <Modal
        title={selected ? 'Editar registro de Vibración' : 'Agregar registro de Vibración'}
        open={isFormOpen}
        onOk={onOkForm}
        onCancel={onCancelForm}
        confirmLoading={saving}
        destroyOnClose
        width={980}
      >
        <Form
          form={form}
          layout="vertical"
          key={selected ? `edit-${selected.id}` : 'add'}
          preserve={false}
          initialValues={
            selected
              ? {
                  // ✅ Mostrar hora en local al editar
                  horario: selected?.measured_at ? dayjs(selected.measured_at).utc() : null,

                  area_trabajo: selected.area_trabajo || '',
                  puesto_trabajo: selected.puesto_trabajo || '',
                  trabajador_evaluado: selected.trabajador_evaluado || '',
                  maquina_equipo: selected.maquina_equipo || '',
                  duracion_jornada_h: selected.duracion_jornada_h,
                  tiempo_expos_h: selected.tiempo_expos_h,
                  postura: selected.postura || undefined,
                  postura_otro: selected.postura_otro || '',
                  duracion_prueba_min: selected.duracion_prueba_min,
                  tipo: selected.tipo || undefined,
                  ub_acelerometro: selected.ub_acelerometro || '',
                  aeqx_ce: selected.aeqx_ce,
                  aeqy_ce: selected.aeqy_ce,
                  aeqz_ce: selected.aeqz_ce,
                  mano_afectada: selected.mano_afectada || '',
                  aeqx_mb: selected.aeqx_mb,
                  aeqy_mb: selected.aeqy_mb,
                  aeqz_mb: selected.aeqz_mb,
                  observaciones: selected.observaciones || '',
                  image_urls: Array.isArray(selected.image_urls) ? selected.image_urls.join(', ') : (selected.image_urls || ''),
                  location: selected.location || '',
                }
              : {}
          }
        >
          <Row gutter={12}>
            <Col span={6}>
              <Form.Item name="horario" label="Hora de medición" rules={[{ required: true }]}>
                <TimePicker format="HH:mm" style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={9}>
              <Form.Item name="area_trabajo" label="Área de trabajo" rules={[{ required: true }]}>
                <Input />
              </Form.Item>
            </Col>
            <Col span={9}>
              <Form.Item name="puesto_trabajo" label="Puesto de trabajo" rules={[{ required: true }]}>
                <Input />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={12}>
            <Col span={8}><Form.Item name="trabajador_evaluado" label="Trabajador evaluado"><Input /></Form.Item></Col>
            <Col span={8}><Form.Item name="maquina_equipo" label="Máquina / Equipo"><Input /></Form.Item></Col>
            <Col span={4}><Form.Item name="duracion_jornada_h" label="Jornada (h)"><InputNumber step={0.1} min={0} style={{ width: '100%' }} /></Form.Item></Col>
            <Col span={4}><Form.Item name="tiempo_expos_h" label="TE (h)"><InputNumber step={0.1} min={0} style={{ width: '100%' }} /></Form.Item></Col>
          </Row>

          <Row gutter={12}>
            <Col span={8}>
              <Form.Item name="postura" label="Postura del evaluado" rules={[{ required: true }]}>
                <Select placeholder="Seleccione">
                  <Option value="Sentado">Sentado</Option>
                  <Option value="De pie">De pie</Option>
                  <Option value="Otro">Otro</Option>
                </Select>
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="postura_otro" label="Postura (Otro)">
                <Input placeholder="Si seleccionó 'Otro', especifique" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="duracion_prueba_min" label="Duración de la prueba (min)">
                <InputNumber step={1} min={0} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={12}>
            <Col span={8}>
              <Form.Item name="tipo" label="Tipo de monitoreo" rules={[{ required: true }]}>
                <Select placeholder="Seleccione">
                  <Option value="cuerpo_entero">Cuerpo entero</Option>
                  <Option value="mano_brazo">Mano-brazo</Option>
                </Select>
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="ub_acelerometro" label="Ubicación del acelerómetro">
                <Select placeholder="Seleccione o escriba" allowClear showSearch>
                  <Option value="base_asiento">Base asiento</Option>
                  <Option value="espaldar_asiento">Espaldar asiento</Option>
                  <Option value="volante">Volante</Option>
                  <Option value="maneral">Maneral</Option>
                </Select>
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="mano_afectada" label="Mano más afectada">
                <Select allowClear placeholder="Seleccione">
                  <Option value="Derecha">Derecha</Option>
                  <Option value="Izquierda">Izquierda</Option>
                  <Option value="Ambas">Ambas</Option>
                </Select>
              </Form.Item>
            </Col>
          </Row>

          {/* CUERPO ENTERO Aeq */}
          <Row gutter={12}>
            <Col span={8}><Form.Item name="aeqx_ce" label="AeqX Cuerpo entero (m/s²)"><InputNumber step={0.01} min={0} style={{ width: '100%' }} /></Form.Item></Col>
            <Col span={8}><Form.Item name="aeqy_ce" label="AeqY Cuerpo entero (m/s²)"><InputNumber step={0.01} min={0} style={{ width: '100%' }} /></Form.Item></Col>
            <Col span={8}><Form.Item name="aeqz_ce" label="AeqZ Cuerpo entero (m/s²)"><InputNumber step={0.01} min={0} style={{ width: '100%' }} /></Form.Item></Col>
          </Row>

          {/* MANO-BRAZO Aeq */}
          <Row gutter={12}>
            <Col span={8}><Form.Item name="aeqx_mb" label="AeqX Mano-brazo (m/s²)"><InputNumber step={0.01} min={0} style={{ width: '100%' }} /></Form.Item></Col>
            <Col span={8}><Form.Item name="aeqy_mb" label="AeqY Mano-brazo (m/s²)"><InputNumber step={0.01} min={0} style={{ width: '100%' }} /></Form.Item></Col>
            <Col span={8}><Form.Item name="aeqz_mb" label="AeqZ Mano-brazo (m/s²)"><InputNumber step={0.01} min={0} style={{ width: '100%' }} /></Form.Item></Col>
          </Row>

          <Form.Item name="image_urls" label="Imagen(es) URL (separadas por coma)">
            <Input.TextArea rows={2} placeholder="https://..., https://..." />
          </Form.Item>

          <Form.Item name="location" label="COORDENADAS UTM (texto/JSON)">
            <Input placeholder='Ej: {"easting":585326.65,"northing":8169066.21,"utm_zone":"19K"} ó {"lat":-16.5,"lng":-68.1}' />
          </Form.Item>

          <Form.Item name="observaciones" label="Observaciones">
            <Input.TextArea rows={3} />
          </Form.Item>
        </Form>
      </Modal>

      {/* Visor de imágenes */}
      <Modal
        open={imageViewerOpen}
        onCancel={() => setImageViewerOpen(false)}
        footer={
          imageViewerList.length > 1
            ? [
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
              ]
            : null
        }
        width={720}
        title="Imagen del registro"
      >
        {imageViewerList.length ? (
          <div style={{ textAlign: 'center' }}>
            <img
              src={imageViewerList[imageViewerIndex]}
              alt="registro"
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
    </>
  );
};

export default VibracionPage; // ULTIMA SUBIDA A MI REPOSITORIO DE GITHUB
