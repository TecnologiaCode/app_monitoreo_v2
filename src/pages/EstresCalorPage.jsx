// src/pages/EstresCalorPage.jsx
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

const { Title, Text } = Typography;
const { Option } = Select;
const PRIMARY_BLUE = '#2a8bb6';
const TABLE_NAME = 'estres_calor';



// =================================================================================
// HELPERS DE FORMATO DE FECHA/HORA (¡IMPORTANTE!)
// =================================================================================

/**
 * Parsea una entrada de hora/fecha (potencialmente solo HH:mm) desde la zona horaria local
 * y la convierte a un string ISO (UTC) para Supabase.
 * @param {string} input - El valor del formulario (ej: "09:15" o "2025-11-06 09:15")
 * @param {string | null} originalTimestamp - El timestamp (UTC) existente, si se está editando.
 * @returns {string | null} - Un string ISO (UTC) o null.
 */
const parseHoraLocalToUTC = (input, originalTimestamp = null) => {
  // Si no hay entrada, es nulo
  if (!input || typeof input !== 'string' || input.trim() === '') {
    return null;
  }

  // 1. Determinar la fecha base (en zona local)
  const baseDateLocal = originalTimestamp
    ? dayjs(originalTimestamp).utc() // Si editamos: Convierte el UTC de la DB a local para usar su *fecha*
    : dayjs().utc(); // Si creamos: Usa "hoy" en hora local

  let hora, minuto, segundo;
  let fechaConHoraLocal;

  // 2. Intentar parsear la entrada del usuario (que está en hora local)
  // Caso A: El usuario solo puso la hora (ej: "09:15" o "09:15:30")
  const timeMatch = input.match(/^(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?$/);
  if (timeMatch) {
    hora = parseInt(timeMatch[1], 10);
    minuto = parseInt(timeMatch[2], 10);
    segundo = timeMatch[3] ? parseInt(timeMatch[3], 10) : 0;
    
    // Combina la fecha base local con la nueva hora/minuto/segundo local
    fechaConHoraLocal = baseDateLocal.hour(hora).minute(minuto).second(segundo);
  }
  // Caso B: El usuario puso una fecha y hora completa (ej: "2025-11-06 09:15")
  else {
    // Dayjs parseará esta fecha-hora como local por defecto
    fechaConHoraLocal = dayjs(input);
    if (!fechaConHoraLocal.isValid()) {
      console.warn('Timestamp inválido en el formulario:', input);
      return null; // No es un formato válido
    }
  }

  // 3. Convertir el objeto dayjs (que está en zona local) a un string ISO (UTC)
  // .toISOString() SIEMPRE convierte a UTC (Z) para guardar en Supabase.
  return fechaConHoraLocal.toISOString();
};

/* =========================================================
   Helpers
   ========================================================= */

/**
 * MUESTRA la hora local.
 * Toma un timestamp UTC de la base de datos y lo formatea a la hora local del navegador.
 * @param {string} v - El timestamp UTC (ej: "2025-11-06T14:30:00+00:00")
 * @returns {string} - La hora en formato local (ej: "10:30")
 */


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

/* =========================================================
   Exportar a Excel
   - Ahora escribe separadamente FECHA y HORA (columnas distintas)
   ========================================================= */
const exportToExcel = (rows = [], header) => {
  try {
    const empresaNombre =
      typeof header === 'object' ? (header.empresa || '—') : (header || '—');
    const fechaMonitoreo =
      typeof header === 'object' ? (header.fecha || '') : '';

    const B = {
      top: { style: 'thin', color: { rgb: '000000' } },
      bottom: { style: 'thin', color: { rgb: '000000' } },
      left: { style: 'thin', color: { rgb: '000000' } },
      right: { style: 'thin', color: { rgb: '000000' } },
    };

    const th = {
      font: { bold: true },
      alignment: { vertical: 'center', horizontal: 'center', wrapText: true },
      fill: { fgColor: { rgb: 'FFFF00' } },
      border: B,
    };
    const tdC = {
      alignment: { vertical: 'center', horizontal: 'center', wrapText: true },
      border: B,
    };
    const thL = {
      font: { bold: true },
      alignment: { vertical: 'center', horizontal: 'left', wrapText: true },
      border: B,
    };
    const tdL = {
      alignment: { vertical: 'center', horizontal: 'left', wrapText: true },
      border: B,
    };

    const wsData = [];

    // Título (mergado a 19 columnas: ahora FECHA + HORA => contamos igual)
    wsData.push([
      {
        v: 'PLANILLA DE MEDICIÓN DE ESTRÉS POR CALOR',
        s: {
          font: { bold: true, sz: 14 },
          alignment: { vertical: 'center', horizontal: 'center' },
        },
      },
    ]);

    // Convierte boolean/strings booleanos a "Sí"/"No"
    const siNo = (v) =>
      (v === true || String(v) === 'true') ? 'Sí'
        : (v === false || String(v) === 'false') ? 'No'
          : '';

    // Meta (4 columnas por fila)
    wsData.push([
      { v: 'NOMBRE DE LA EMPRESA', s: thL },
      { v: empresaNombre, s: tdL },
      { v: 'FECHA DE MONITOREO', s: thL },
      { v: fechaMonitoreo, s: tdL },
    ]);
    wsData.push([
      { v: 'EQUIPO', s: thL },
      { v: header?.equipo || '', s: tdL },
      { v: 'MODELO DEL EQUIPO', s: thL },
      { v: header?.modelos || '', s: tdL },
    ]);
    wsData.push([
      { v: 'SERIE DEL EQUIPO', s: thL },
      { v: header?.series || '', s: tdL },
      { v: 'ÁREA DE TRABAJO', s: thL },
      { v: header?.area || '', s: tdL },
    ]);

    wsData.push(['']); // espacio

    // Encabezados de tabla (ahora FECHA y HORA por separado)
    wsData.push([
      { v: 'N°', s: th },
      { v: 'PUESTO DE TRABAJO', s: th },
      { v: 'INTERIOR/EXTERIOR', s: th },
      { v: 'ACLIMATADO', s: th },
      { v: 'FECHA', s: th },
      { v: 'HORA DE MEDICIÓN', s: th },
      { v: 'DESCRIPCIÓN DE ACTIVIDADES', s: th },
      { v: 'TIPO DE ROPA DE TRABAJO CAV °C', s: th },
      { v: 'CAPUCHA', s: th },
      { v: 'TASA METABÓLICA W', s: th },

      // Bloque resultados
      { v: '%HR', s: th },
      { v: 'VEL. VIENTO (m/s)', s: th },
      { v: 'P (mmHg)', s: th },
      { v: 'TEMP °C', s: th },
      { v: 'WBGT °C', s: th },
      { v: 'WB °C', s: th },
      { v: 'GT °C', s: th },

      // Finales en el orden solicitado
      { v: 'IMÁGENES', s: th },        // URLs de imagen
      { v: 'COORDENADAS UTM', s: th }, // location (JSON)
      { v: 'OBSERVACIÓN', s: th },     // observaciones
    ]);

    // Filas
    rows.forEach((r, i) => {
      const imgs = Array.isArray(r.image_urls)
        ? r.image_urls.join(', ')
        : (r.image_urls || '');

      const locText =
        typeof r.location === 'object'
          ? JSON.stringify(r.location)
          : (r.location || '');

      wsData.push([
        { v: i + 1, s: tdC },
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

        { v: imgs, s: tdL },     // IMÁGENES
        { v: locText, s: tdL },  // COORDENADAS UTM
        { v: r.observaciones || '', s: tdL }, // OBSERVACIÓN
      ]);
    });

    const ws = XLSX.utils.aoa_to_sheet(wsData);

    // Merge del título (fila 0, col 0 -> col 19) - ajustar a número de columnas (0..19 inclusive)
    ws['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 19 } }];

    // Ancho de columnas (incluyendo las 3 últimas)
    ws['!cols'] = [
      { wch: 6 },   // N°
      { wch: 40 },  // Puesto
      { wch: 16 },  // Int/Ext
      { wch: 12 },  // Aclimatado
      { wch: 12 },  // Fecha
      { wch: 10 },  // Hora
      { wch: 36 },  // Descripción
      { wch: 28 },  // Tipo ropa
      { wch: 12 },  // Capucha
      { wch: 24 },  // Tasa metabólica
      { wch: 10 },  // %HR
      { wch: 16 },  // Viento
      { wch: 12 },  // P
      { wch: 10 },  // Temp
      { wch: 10 },  // WBGT
      { wch: 10 },  // WB
      { wch: 10 },  // GT
      { wch: 42 },  // IMÁGENES
      { wch: 34 },  // COORDENADAS UTM
      { wch: 34 },  // OBSERVACIÓN
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

  /* ---------- Cabecera (proyecto/monitoreo/equipos) ---------- */
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

  /* ---------- Traer filas (corrige filtro para registros antiguos) ---------- */
  const fetchRows = async () => {
    setLoading(true);
    try {
      let q = supabase.from(TABLE_NAME).select('*').order('inserted_at', { ascending: true });

      // Si tienes filas con solo proyecto_id (antiguas) o solo monitoreo_id,
      // usa .or(...) para no excluirlas.
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
          hr_percent: toNumberOrString(r.hr_percent),
          vel_viento_ms: toNumberOrString(r.vel_viento_ms),
          presion_mmhg: toNumberOrString(r.presion_mmhg),
          temp_c: toNumberOrString(r.temp_c),
          wbgt_c: toNumberOrString(r.wbgt_c),
          wb_c: toNumberOrString(r.wb_c),
          gt_c: toNumberOrString(r.gt_c),
          image_urls: imageUrls,
        };
      });

      setRows(mapped);
      setCurrentPage(1);

      // Fecha cabecera con primera fila (usando measured_at)
      if (mapped.length && mapped[0].measured_at) {
        const raw = String(mapped[0].measured_at);
        const [yyyy, mm, dd] = raw.slice(0, 10).split('-');
        setHeaderInfo((h) => ({ ...h, fecha: `${dd}/${mm}/${yyyy}` }));
      }

      // Perfiles
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
      message.error('No se pudo cargar Estrés Calor.');
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRows();
    const ch = supabase
      .channel('rt-estres-calor')
      .on('postgres_changes', { event: '*', schema: 'public', table: TABLE_NAME }, fetchRows)
      .subscribe();
    return () => supabase.removeChannel(ch);
  }, [projectId, monitoreoId]);

  /* ---------- CRUD ---------- */
  const handleAdd = () => { setSelected(null); setIsFormOpen(true); };
  const handleEdit = (rec) => { setSelected(rec); setIsFormOpen(true); };

  const handleDelete = (rec) => {
    Modal.confirm({
      title: '¿Eliminar registro?',
      icon: <ExclamationCircleOutlined />,
      content: `Se eliminará el registro "${rec.puesto_trabajo}"`,
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
    // construir la hora en LOCAL y luego serializar a ISO (UTC)
    let measuredAt = null;
    if (values.horario) {
      const h = values.horario.hour();
      const m = values.horario.minute();

      // crear fecha local de hoy con la hora elegida
      const local = dayjs()
        .hour(h).minute(m).second(0).millisecond(0);
      measuredAt = local.toDate().toISOString(); // ISO en UTC equivalente
    } else if (selected?.measured_at) {
      measuredAt = selected.measured_at;
    }

    let imageUrls = null;
    if (values.image_urls && values.image_urls.trim() !== '') {
      imageUrls = values.image_urls.split(',').map(s => s.trim()).filter(Boolean);
    }

    return {
      proyecto_id: projectId || null,
      monitoreo_id: monitoreoId || null,
      measured_at: measuredAt,
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

  /* ---------- Filtro/Paginación y visor de imágenes ---------- */
  const filtered = useMemo(() => {
    if (!searchText) return rows;
    const s = searchText.toLowerCase();
    return rows.filter(r => {
      const imgs = Array.isArray(r.image_urls) ? r.image_urls.join(',') : (r.image_urls || '');
      return (
        (r.puesto_trabajo && r.puesto_trabajo.toLowerCase().includes(s)) ||
        (r.interior_exterior && r.interior_exterior.toLowerCase().includes(s)) ||
        (r.desc_actividades && r.desc_actividades.toLowerCase().includes(s)) ||
        (r.tipo_ropa_cav && r.tipo_ropa_cav.toLowerCase().includes(s)) ||
        (r.tasa_metabolica && String(r.tasa_metabolica).toLowerCase().includes(s)) ||
        (formatHoraUTC(r.measured_at) && formatHoraUTC(r.measured_at).includes(s)) ||
        (formatFechaUTC(r.measured_at) && formatFechaUTC(r.measured_at).includes(s)) ||
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

  /* ---------- Columnas (ahora Fecha + Hora separadas) ---------- */
  const columns = [
    { title: 'N°', 
      key: 'n', 
      fixed: 'left',
      width: 60, render: (_, __, i) => (currentPage - 1) * pageSize + i + 1 
    },
    
    // Nueva columna Fecha
    { title: 'FECHA', 
      dataIndex: 'measured_at', 
      key: 'measured_date', 
        // ✅ Permite ordenar ascendente/descendente por fecha
      sorter: (a, b) => dayjs(a.measured_at).unix() - dayjs(b.measured_at).unix(),
      defaultSortOrder: 'descend',
      width: 120, render: (t) => formatFechaUTC(t),
    },

    // Columna Hora (se conserva)
    { title: 'HORA', 
      dataIndex: 'measured_at', 
      key: 'measured_time', 
       // ✅ Permite ordenar ascendente/descendente por hora
      sorter: (a, b) => dayjs(a.measured_at).unix() - dayjs(b.measured_at).unix(),
      width: 90, 
      render: (t) => formatHoraUTC(t),
    },
    
    { title: 'PUESTO DE TRABAJO', 
      dataIndex: 'puesto_trabajo', 
      key: 'puesto_trabajo', 
      width: 90, 
      ellipsis: true 
    },
    
    { 
      title: 'INTERIOR/EXTERIOR', 
      dataIndex: 'interior_exterior', 
      key: 'interior_exterior', 
      width: 150 
    },
    { title: 'ACLIMATADO', 
      dataIndex: 'aclimatado', 
      key: 'aclimatado', 
      width: 110, render: (v) => (String(v) === 'true' ? 'Sí' : String(v) === 'false' ? 'No' : String(v ?? '')) 
    },

    { title: 'DESCRIPCIÓN DE ACTIVIDADES', dataIndex: 'desc_actividades', key: 'desc_actividades', width: 240, ellipsis: true },
    { title: 'TIPO DE ROPA DE TRABAJO CAV °C', dataIndex: 'tipo_ropa_cav', key: 'tipo_ropa_cav', width: 240, ellipsis: true },
    { title: 'CAPUCHA', dataIndex: 'capucha', key: 'capucha', width: 80, render: (v) => (String(v) === 'true' ? 'Sí' : String(v) === 'false' ? 'No' : String(v ?? '')) },
    { title: 'TASA METABÓLICA W', dataIndex: 'tasa_metabolica', key: 'tasa_metabolica', width: 200, ellipsis: true },

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

    { title: 'COORDENADAS UTM', dataIndex: 'location', key: 'location', width: 240, render: (v) => renderLocation(v) },

    {
      title: 'IMÁGENES',
      dataIndex: 'image_urls',
      key: 'image_urls',
      width: 120,
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
      width: 120,
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

  /* ---------- Render ---------- */
  return (
    <>
      <Breadcrumb style={{ margin: '16px 0' }}>
        <Breadcrumb.Item><Link to="/"><HomeOutlined /></Link></Breadcrumb.Item>
        <Breadcrumb.Item><Link to="/proyectos">Proyectos</Link></Breadcrumb.Item>
        <Breadcrumb.Item>
          <Link to={`/proyectos/${projectId}/monitoreo`}><DatabaseOutlined /> Monitoreos</Link>
        </Breadcrumb.Item>
        <Breadcrumb.Item>Estrés por Calor</Breadcrumb.Item>
      </Breadcrumb>

      <Row justify="space-between" align="middle" style={{ marginBottom: 8 }}>
        <Col>
          <Title level={2} style={{ color: PRIMARY_BLUE, marginBottom: 0 }}>Monitoreo de Estrés por Calor</Title>
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
            placeholder="Buscar por puesto, descripción, ropa, observación..."
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
            className="tabla-general" // <--- Clase personalizada para estilos de tabla cabecera fija
            size="small"
            columns={columns}
            dataSource={pageData}
            rowKey="id"
            pagination={false}
            scroll={{ x: 1500 }}
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
        title={selected ? 'Editar registro de Estrés Calor' : 'Agregar registro de Estrés Calor'}
        open={isFormOpen}
        onOk={onOkForm}
        onCancel={onCancelForm}
        confirmLoading={saving}
        destroyOnClose
        width={900}
      >
        <Form
          form={form}
          layout="vertical"
          key={selected ? `edit-${selected.id}` : 'add'}
          preserve={false}
          initialValues={
            selected
              ? {
                  puesto_trabajo: selected.puesto_trabajo,
                  interior_exterior: selected.interior_exterior,
                  aclimatado: String(selected.aclimatado) === 'true',
                  // Muestra la hora en LOCAL al editar (TimePicker)
                  horario: selected.measured_at ? dayjs(selected.measured_at).local() : null,
                  desc_actividades: selected.desc_actividades || '',
                  tipo_ropa_cav: selected.tipo_ropa_cav || '',
                  capucha: String(selected.capucha) === 'true',
                  tasa_metabolica: selected.tasa_metabolica || '',
                  hr_percent: selected.hr_percent,
                  vel_viento_ms: selected.vel_viento_ms,
                  presion_mmhg: selected.presion_mmhg,
                  temp_c: selected.temp_c,
                  wbgt_c: selected.wbgt_c,
                  wb_c: selected.wb_c,
                  gt_c: selected.gt_c,
                  observaciones: selected.observaciones || '',
                  image_urls: Array.isArray(selected.image_urls) ? selected.image_urls.join(', ') : (selected.image_urls || ''),
                  location: selected.location || '',
                }
              : {}
          }
        >
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="puesto_trabajo" label="Puesto de Trabajo" rules={[{ required: true }]}>
                <Input />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item name="interior_exterior" label="Interior/Exterior" rules={[{ required: true }]}>
                <Select placeholder="Seleccione">
                  <Option value="Interior">Interior</Option>
                  <Option value="Exterior">Exterior</Option>
                </Select>
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item name="aclimatado" label="Aclimatado" rules={[{ required: true }]}>
                <Select placeholder="Seleccione">
                  <Option value={true}>Sí</Option>
                  <Option value={false}>No</Option>
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={12}>
            <Col span={8}>
              <Form.Item name="horario" label="Hora de medición" rules={[{ required: true }]}>
                <TimePicker format="HH:mm" style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={16}>
              <Form.Item name="desc_actividades" label="Descripción de actividades">
                <Input />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="tipo_ropa_cav" label="Tipo de ropa de trabajo CAV °C">
                <Input placeholder="Ej: Ropa de trabajo" />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item name="capucha" label="Capucha" rules={[{ required: true }]}>
                <Select placeholder="Seleccione">
                  <Option value={true}>Sí</Option>
                  <Option value={false}>No</Option>
                </Select>
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item name="tasa_metabolica" label="Tasa metabólica (W)">
                <Input placeholder="Ej: Clase 2 / Índice metabólico medio" />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={12}>
            <Col span={6}><Form.Item name="hr_percent" label="%HR"><InputNumber step={0.1} min={0} style={{ width: '100%' }} /></Form.Item></Col>
            <Col span={6}><Form.Item name="vel_viento_ms" label="Vel. Viento (m/s)"><InputNumber step={0.1} min={0} style={{ width: '100%' }} /></Form.Item></Col>
            <Col span={6}><Form.Item name="presion_mmhg" label="P (mmHg)"><InputNumber step={0.1} min={0} style={{ width: '100%' }} /></Form.Item></Col>
            <Col span={6}><Form.Item name="temp_c" label="Temp (°C)"><InputNumber step={0.1} style={{ width: '100%' }} /></Form.Item></Col>
          </Row>

          <Row gutter={12}>
            <Col span={8}><Form.Item name="wbgt_c" label="WBGT (°C)"><InputNumber step={0.1} style={{ width: '100%' }} /></Form.Item></Col>
            <Col span={8}><Form.Item name="wb_c" label="WB (°C)"><InputNumber step={0.1} style={{ width: '100%' }} /></Form.Item></Col>
            <Col span={8}><Form.Item name="gt_c" label="GT (°C)"><InputNumber step={0.1} style={{ width: '100%' }} /></Form.Item></Col>
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

export default EstresCalorPage;
