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
} from '@ant-design/icons';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient.js';
import dayjs from 'dayjs';
import 'dayjs/locale/es';
import utc from 'dayjs/plugin/utc';
import XLSX from 'xlsx-js-style';

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



const VentilacionPage = () => {
  const { projectId, monitoreoId: mId, id } = useParams();
  const monitoreoId = mId || id;
  const navigate = useNavigate();
  const [form] = Form.useForm();

  const [monitoreoInfo, setMonitoreoInfo] = useState(null);
  const [proyectoInfo, setProyectoInfo] = useState(null);
  const [equiposInfo, setEquiposInfo] = useState([]);
  const [registros, setRegistros] = useState([]);

  const [loadingHeader, setLoadingHeader] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isFormModalVisible, setIsFormModalVisible] = useState(false);
  const [selectedRegistro, setSelectedRegistro] = useState(null);
  const [lastRtMsg, setLastRtMsg] = useState('');

  // visor de imágenes
  const [imageViewerOpen, setImageViewerOpen] = useState(false);
  const [imageViewerList, setImageViewerList] = useState([]);
  const [imageViewerIndex, setImageViewerIndex] = useState(0);

  // búsqueda + paginación
  const [searchText, setSearchText] = useState('');
  const [pageSize, setPageSize] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);

  // diccionario de usuarios {id: nombre}
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
        return (
          <span>
            lat: {lat ?? ''}
            {lat !== undefined && lng !== undefined ? ', ' : ''}
            {lng !== undefined ? `lng: ${lng}` : ''}
          </span>
        );
      }
      if (v.easting || v.northing || v.utm_zone) {
        return (
          <span>
            E: {v.easting ?? ''} | N: {v.northing ?? ''} | Z: {v.utm_zone ?? ''}
          </span>
        );
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

  /* ========================= CABECERA ========================= */
  const fetchProyectoInfo = async (pId) => {
    if (!pId) return;
    try {
      const { data, error } = await supabase
        .from('proyectos')
        .select('id, nombre, created_at, estado')
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
    if (!equipoIds) {
      setEquiposInfo([]);
      return;
    }
    if (typeof equipoIds === 'string') {
      try {
        equipoIds = JSON.parse(equipoIds);
      } catch {
        equipoIds = [];
      }
    }
    if (!Array.isArray(equipoIds) || equipoIds.length === 0) {
      setEquiposInfo([]);
      return;
    }
    try {
      const { data, error } = await supabase
        .from('equipos')
        .select('id, nombre_equipo, modelo, serie')
        .in('id', equipoIds);
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

      if (error) {
        console.warn('No se pudieron cargar usuarios:', error.message);
        return;
      }

      const dict = {};
      (data || []).forEach((u) => {
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
    } catch (err) {
      console.error('Error trayendo usuarios:', err);
    }
  };

  /* ========================= REGISTROS ========================= */
  const fetchRegistros = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from(VENTILACION_TABLE_NAME)
        .select('*')
        .order('created_at', { ascending: true });

      if (monitoreoId) {
        query = query.eq('monitoreo_id', monitoreoId);
      } else if (projectId) {
        query = query.eq('proyecto_id', projectId);
      }

      let { data, error } = await query;
      if (error) throw error;

      if ((!data || data.length === 0) && projectId) {
        const { data: dataByProj, error: errProj } = await supabase
          .from(VENTILACION_TABLE_NAME)
          .select('*')
          .eq('proyecto_id', projectId)
          .order('created_at', { ascending: true });

        if (!errProj && dataByProj && dataByProj.length > 0) {
          data = dataByProj;
        }
      }

      const mapped = (data || []).map((r) => {
        let imgs = [];
        if (Array.isArray(r.image_urls)) {
          imgs = r.image_urls;
        } else if (typeof r.image_urls === 'string' && r.image_urls.trim() !== '') {
          try {
            const parsed = JSON.parse(r.image_urls);
            if (Array.isArray(parsed)) {
              imgs = parsed;
            } else {
              imgs = [r.image_urls];
            }
          } catch {
            imgs = r.image_urls.split(',').map((s) => s.trim());
          }
        }

        let loc = r.location;
        if (typeof r.location === 'string' && r.location.trim() !== '') {
          try {
            loc = JSON.parse(r.location);
          } catch {
            // se queda como string
          }
        }

        return {
          ...r,
          image_urls: imgs,
          location: loc,
        };
      });

      setRegistros(mapped);
      setCurrentPage(1);

      // traer usuarios de created_by
      const createdByIds = Array.from(
        new Set(
          (mapped || [])
            .map((m) => m.created_by)
            .filter((v) => v && typeof v === 'string')
        )
      );
      if (createdByIds.length > 0) {
        await fetchUsersByIds(createdByIds);
      } else {
        setUsersById({});
      }
    } catch (e) {
      console.error('Error ventilación:', e);
      message.error('No se pudieron cargar los datos de ventilación.');
      setRegistros([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRegistros();

    const channel = supabase
      .channel('rt-ventilacion-all')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: VENTILACION_TABLE_NAME,
        },
        (payload) => {
          console.log('RT ventilacion', payload);
          setLastRtMsg(
            `Cambio ${payload.eventType} en ID ${payload.new?.id || payload.old?.id || '—'}`
          );
          fetchRegistros();
        }
      )
      .subscribe();

  return () => {
      supabase.removeChannel(channel);
    };
  }, [monitoreoId, projectId]);

  /* ========================= CRUD ========================= */
  const handleAdd = () => {
    setSelectedRegistro(null);
    setIsFormModalVisible(true);
  };

  const handleEdit = (record) => {
    setSelectedRegistro(record);
    setIsFormModalVisible(true);
  };

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
          const { error } = await supabase
            .from(VENTILACION_TABLE_NAME)
            .delete()
            .eq('id', record.id);
          if (error) throw error;
          message.success('Registro eliminado.');
        } catch (err) {
          console.error(err);
          message.error('No se pudo eliminar.');
        }
      },
    });
  };

  const handleFormOk = () => {
    selectedRegistro ? handleEditOk() : handleAddOk();
  };

  const handleFormCancel = () => {
    setIsFormModalVisible(false);
  };

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
        image_urls:
          values.image_urls && values.image_urls.trim() !== ''
            ? values.image_urls.split(',').map((s) => s.trim())
            : null,
        location: values.location || null,
      };

      const { error } = await supabase.from(VENTILACION_TABLE_NAME).insert(payload);
      if (error) throw error;

      message.success('Registro agregado.');
      setIsFormModalVisible(false);
    } catch (err) {
      console.error('Error al agregar:', err);
      message.error('No se pudo agregar.');
    } finally {
      setSaving(false);
    }
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
        image_urls:
          values.image_urls && values.image_urls.trim() !== ''
            ? values.image_urls.split(',').map((s) => s.trim())
            : null,
        location: values.location || null,
      };

      const { error } = await supabase
        .from(VENTILACION_TABLE_NAME)
        .update(updateData)
        .eq('id', selectedRegistro.id);
      if (error) throw error;

      message.success('Registro actualizado.');
      setIsFormModalVisible(false);
    } catch (err) {
      console.error('Error al actualizar:', err);
      message.error('No se pudo actualizar.');
    } finally {
      setSaving(false);
    }
  };

  /* ========================= EXPORTAR A EXCEL ========================= */
  const exportToExcel = () => {
    try {
      const headerBg = 'D9D9D9';
      const titleStyle = {
        font: { bold: true },
        alignment: { vertical: 'center', horizontal: 'left' },
      };
      const headerStyle = {
        font: { bold: true },
        alignment: { vertical: 'center', horizontal: 'center', wrapText: true },
        fill: { fgColor: { rgb: headerBg } },
        border: {
          top: { style: 'thin', color: { rgb: '000000' } },
          bottom: { style: 'thin', color: { rgb: '000000' } },
          left: { style: 'thin', color: { rgb: '000000' } },
          right: { style: 'thin', color: { rgb: '000000' } },
        },
      };
      const cellStyle = {
        alignment: { vertical: 'center', horizontal: 'center', wrapText: true },
        border: {
          top: { style: 'thin', color: { rgb: '000000' } },
          bottom: { style: 'thin', color: { rgb: '000000' } },
          left: { style: 'thin', color: { rgb: '000000' } },
          right: { style: 'thin', color: { rgb: '000000' } },
        },
      };
      const dataStyle = {
        ...cellStyle,
        fill: { fgColor: { rgb: 'FFF2CC' } },
      };

      const empresa = proyectoInfo?.nombre || '';
      const fechaInicio =
        registros.length && registros[0].created_at
          ? dayjs(registros[0].created_at).format('DD/MM/YYYY')
          : proyectoInfo?.created_at
          ? dayjs(proyectoInfo.created_at).format('DD/MM/YYYY')
          : '';
      const fechaFin = '';
      const equipos =
        Array.isArray(equiposInfo) && equiposInfo.length
          ? equiposInfo.map((e) => e.nombre_equipo || 's/n').join(', ')
          : '';
      const modelos =
        Array.isArray(equiposInfo) && equiposInfo.length
          ? equiposInfo.map((e) => e.modelo || 's/n').join(', ')
          : '';
      const series =
        Array.isArray(equiposInfo) && equiposInfo.length
          ? equiposInfo.map((e) => e.serie || 's/n').join(', ')
          : '';

      const wsData = [];

      wsData.push([
        {
          v: 'PLANILLA DE MEDICIÓN Y EVALUACIÓN DE VENTILACIÓN',
          s: {
            font: { bold: true, sz: 14 },
            alignment: { vertical: 'center', horizontal: 'center' },
          },
        },
      ]);

      wsData.push([
        { v: 'INSTALACIÓN:', s: titleStyle },
        { v: empresa, s: cellStyle },
        '',
        { v: 'EQUIPO:', s: titleStyle },
        { v: equipos, s: cellStyle },
      ]);
      wsData.push([
        { v: 'FECHA DE INICIO DEL MONITOREO:', s: titleStyle },
        { v: fechaInicio, s: cellStyle },
        '',
        { v: 'MODELO:', s: titleStyle },
        { v: modelos, s: cellStyle },
      ]);
      wsData.push([
        { v: 'FECHA DE FINALIZACIÓN DEL MONITOREO:', s: titleStyle },
        { v: fechaFin, s: cellStyle },
        '',
        { v: 'SERIE:', s: titleStyle },
        { v: series, s: cellStyle },
      ]);
      wsData.push([
        { v: 'TIPO DE MONITOREO:', s: titleStyle },
        { v: monitoreoInfo?.tipo_monitoreo || 'SEGUIMIENTO', s: cellStyle },
      ]);

      wsData.push(['', '', '', '', '']);

      wsData.push([{ v: 'EVALUACIÓN DE RIESGOS', s: headerStyle }]);

      wsData.push([
        { v: 'Nro.', s: headerStyle },
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

      ws['!merges'] = [
        { s: { r: 0, c: 0 }, e: { r: 0, c: 13 } },
        { s: { r: 1, c: 1 }, e: { r: 1, c: 2 } },
        { s: { r: 2, c: 1 }, e: { r: 2, c: 2 } },
        { s: { r: 3, c: 1 }, e: { r: 3, c: 2 } },
        { s: { r: 4, c: 1 }, e: { r: 4, c: 2 } },
        { s: { r: 6, c: 0 }, e: { r: 6, c: 13 } },
        { s: { r: 7, c: 0 }, e: { r: 8, c: 0 } },
        { s: { r: 7, c: 1 }, e: { r: 8, c: 1 } },
        { s: { r: 7, c: 2 }, e: { r: 8, c: 2 } },
        { s: { r: 7, c: 3 }, e: { r: 8, c: 3 } },
        { s: { r: 7, c: 4 }, e: { r: 8, c: 4 } },
        { s: { r: 7, c: 5 }, e: { r: 8, c: 5 } },
        { s: { r: 7, c: 6 }, e: { r: 8, c: 6 } },
        { s: { r: 7, c: 7 }, e: { r: 8, c: 7 } },
        { s: { r: 7, c: 8 }, e: { r: 7, c: 10 } },
        { s: { r: 7, c: 11 }, e: { r: 8, c: 11 } },
        { s: { r: 7, c: 12 }, e: { r: 8, c: 12 } },
        { s: { r: 7, c: 13 }, e: { r: 8, c: 13 } },
      ];

      ws['!cols'] = [
        { wch: 4 },
        { wch: 20 },
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

  /* ========================= FILTRO + PAGINACIÓN ========================= */
  const filteredRegistros = useMemo(() => {
    if (!searchText) return registros;
    const s = searchText.toLowerCase();
    return registros.filter((r) => {
      return (
        (r.local_trabajo && r.local_trabajo.toLowerCase().includes(s)) ||
        (r.tipo_ventilacion && r.tipo_ventilacion.toLowerCase().includes(s)) ||
        (r.caudal_m3h && String(r.caudal_m3h).toLowerCase().includes(s)) ||
        (r.volumen_m3 && String(r.volumen_m3).toLowerCase().includes(s)) ||
        (r.renovaciones_h && String(r.renovaciones_h).toLowerCase().includes(s))
      );
    });
  }, [searchText, registros]);

  const totalFiltered = filteredRegistros.length;

  const paginatedRegistros = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredRegistros.slice(start, start + pageSize);
  }, [filteredRegistros, currentPage, pageSize]);

  /* ========================= COLUMNAS TABLA ========================= */
  const columns = [
    {
      title: 'N°',
      key: 'numero',
      render: (_, __, i) => (currentPage - 1) * pageSize + i + 1,
      width: 60,
      fixed: 'left',
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
                  width: 100, 
                  render: (t) => formatHoraUTC(t),
                },

    {
      title: 'Local de trabajo',
      dataIndex: 'local_trabajo',
      key: 'local_trabajo',
      width: 160,
      ellipsis: true,
    },
    {
      title: 'Tipo de ventilación',
      dataIndex: 'tipo_ventilacion',
      key: 'tipo_ventilacion',
      width: 160,
      ellipsis: true,
    },
    {
      title: 'Temperatura seca (°C)',
      dataIndex: 'temperatura_seca_c',
      key: 'temperatura_seca_c',
      width: 150,
    },
    {
      title: 'Velocidad aire (m/s)',
      dataIndex: 'vel_aire_ms',
      key: 'vel_aire_ms',
      width: 140,
    },
    {
      title: 'Velocidad aire (m/h)',
      dataIndex: 'vel_aire_mh',
      key: 'vel_aire_mh',
      width: 140,
    },
    {
      title: 'Área de ventilación (m²)',
      dataIndex: 'area_ventilacion_m2',
      key: 'area_ventilacion_m2',
      width: 150,
    },
    {
      title: 'Caudal (m³/h)',
      dataIndex: 'caudal_m3h',
      key: 'caudal_m3h',
      width: 140,
    },
    {
      title: 'Volumen del ambiente (m³)',
      dataIndex: 'volumen_m3',
      key: 'volumen_m3',
      width: 160,
    },
    {
      title: 'N° renovación por hora',
      dataIndex: 'renovaciones_h',
      key: 'renovaciones_h',
      width: 160,
    },
    {
      title: 'Imágenes',
      dataIndex: 'image_urls',
      key: 'image_urls',
      width: 130,
      render: (imgs) => {
        const list = Array.isArray(imgs) ? imgs : [];
        if (!list.length) return <Text type="secondary">Ninguna</Text>;
        return (
          <Button
            type="link"
            size="small"
            icon={<EyeOutlined />}
            onClick={() => openImageViewer(list, 0)}
          >
            Ver imagen
          </Button>
        );
      },
    },
    {
      title: 'Ubicación',
      dataIndex: 'location',
      key: 'location',
      width: 210,
      render: (v) => renderLocation(v),
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
      width: 120,
      fixed: 'right',
      render: (_, record) => (
        <Space size="small">
          <Tooltip title="Editar">
            <Button shape="circle" icon={<EditOutlined />} onClick={() => handleEdit(record)} />
          </Tooltip>
          <Tooltip title="Eliminar">
            <Button
              danger
              shape="circle"
              icon={<DeleteOutlined />}
              onClick={() => handleDelete(record)}
            />
          </Tooltip>
        </Space>
      ),
    },
  ];

  const safeEquipos = Array.isArray(equiposInfo) ? equiposInfo : [];
  const firstRegistro = registros && registros.length > 0 ? registros[0] : null;

  const headerNombreEmpresa = proyectoInfo?.nombre || 'Cargando...';
  const headerFechaInicio = firstRegistro?.created_at
    ? dayjs(firstRegistro.created_at).format('DD/MM/YYYY')
    : proyectoInfo?.created_at
    ? dayjs(proyectoInfo.created_at).format('DD/MM/YYYY')
    : 'N/A';
  const headerFechaFin = '';
  const headerEquipos =
    safeEquipos.length > 0
      ? safeEquipos.map((eq) => eq.nombre_equipo || 's/n').join(', ')
      : 'Ninguno';
  const headerModelos =
    safeEquipos.length > 0 ? safeEquipos.map((eq) => eq.modelo || 's/n').join(', ') : 'N/A';
  const headerSeries =
    safeEquipos.length > 0 ? safeEquipos.map((eq) => eq.serie || 's/n').join(', ') : 'N/A';

  return (
    <>
      <Breadcrumb style={{ margin: '16px 0' }}>
        <Breadcrumb.Item>
          <Link to="/">
            <HomeOutlined />
          </Link>
        </Breadcrumb.Item>
        <Breadcrumb.Item>
          <Link to="/proyectos">Proyectos</Link>
        </Breadcrumb.Item>
        <Breadcrumb.Item>
          <Link to={`/proyectos/${projectId}/monitoreo`}>
            <DatabaseOutlined /> Monitoreos
          </Link>
        </Breadcrumb.Item>
        <Breadcrumb.Item>{monitoreoInfo?.tipo_monitoreo || 'Ventilación'}</Breadcrumb.Item>
      </Breadcrumb>

      <Row justify="space-between" align="middle" style={{ marginBottom: 8 }}>
        <Col>
          <Title level={2} style={{ color: PRIMARY_BLUE, marginBottom: 0 }}>
            <LineChartOutlined /> Monitoreo de Ventilación
          </Title>
          
          {lastRtMsg && <div style={{ fontSize: 11, color: '#999' }}>Realtime: {lastRtMsg}</div>}
        </Col>
        <Col>
          <Space>
            <Button onClick={() => navigate(`/proyectos/${projectId}/monitoreo`)}>
              <ArrowLeftOutlined /> Volver a Monitoreos
            </Button>
            <Button icon={<FileExcelOutlined />} onClick={exportToExcel}>
              Exportar a Excel
            </Button>
            <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>
              Agregar Registro
            </Button>
          </Space>
        </Col>
      </Row>

      {/* buscador + selector */}
      <Row justify="space-between" align="middle" style={{ marginBottom: 16, gap: 15 }}>
        <Col flex="0 0 590px">
          <Input.Search
            allowClear
            placeholder="Buscar por local, tipo, caudal..."
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
          <Descriptions.Item label="NOMBRE DE LA EMPRESA">
            {headerNombreEmpresa}
          </Descriptions.Item>
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
            dataSource={paginatedRegistros}
            rowKey="id"
            pagination={false}
            scroll={{ x: 1400 }}
          />
        </div>
      </Spin>

      {/* pie dinámico */}
      <Row justify="space-between" align="middle" style={{ marginTop: 12 }}>
        <Col>
          {(() => {
            const mostradosHastaAqui = Math.min(currentPage * pageSize, totalFiltered);
            return (
              <Text type="secondary">
                Registros {mostradosHastaAqui} de {totalFiltered}
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

      {/* MODAL FORM */}
      <Modal
        title={
          selectedRegistro ? 'Editar Registro de Ventilación' : 'Agregar Registro de Ventilación'
        }
        open={isFormModalVisible}
        onOk={handleFormOk}
        onCancel={handleFormCancel}
        confirmLoading={saving}
        destroyOnClose
        width={650}
      >
        <Form
          form={form}
          layout="vertical"
          name="ventilacionForm"
          key={selectedRegistro ? `edit-${selectedRegistro.id}` : 'add'}
          initialValues={
            selectedRegistro
              ? {
                  local_trabajo: selectedRegistro.local_trabajo,
                  tipo_ventilacion: selectedRegistro.tipo_ventilacion,
                  temperatura_seca_c: selectedRegistro.temperatura_seca_c,
                  vel_aire_ms: selectedRegistro.vel_aire_ms,
                  vel_aire_mh: selectedRegistro.vel_aire_mh,
                  area_ventilacion_m2: selectedRegistro.area_ventilacion_m2,
                  area_alto_m: selectedRegistro.area_alto_m,
                  area_ancho_m: selectedRegistro.area_ancho_m,
                  caudal_m3h: selectedRegistro.caudal_m3h,
                  vol_largo_m: selectedRegistro.vol_largo_m,
                  vol_ancho_m: selectedRegistro.vol_ancho_m,
                  vol_alto_m: selectedRegistro.vol_alto_m,
                  volumen_m3: selectedRegistro.volumen_m3,
                  renovaciones_h: selectedRegistro.renovaciones_h,
                  image_urls: Array.isArray(selectedRegistro.image_urls)
                    ? selectedRegistro.image_urls.join(', ')
                    : selectedRegistro.image_urls || '',
                  location:
                    typeof selectedRegistro.location === 'object'
                      ? JSON.stringify(selectedRegistro.location)
                      : selectedRegistro.location || '',
                }
              : {}
          }
          preserve={false}
        >
          <Form.Item
            name="local_trabajo"
            label="Local de trabajo"
            rules={[{ required: true, message: 'Campo obligatorio' }]}
          >
            <Input />
          </Form.Item>
          <Form.Item
            name="tipo_ventilacion"
            label="Tipo de ventilación"
            rules={[{ required: true, message: 'Campo obligatorio' }]}
          >
            <Select placeholder="Selecciona un tipo">
              {TIPOS_VENTILACION.map((t) => (
                <Option key={t} value={t}>
                  {t}
                </Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item
            name="temperatura_seca_c"
            label="Temperatura seca (°C)"
            rules={[{ required: true, message: 'Campo obligatorio' }]}
          >
            <InputNumber min={-20} max={60} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item
            name="vel_aire_ms"
            label="Velocidad aire (m/s)"
            rules={[{ required: true, message: 'Campo obligatorio' }]}
          >
            <InputNumber min={0} step={0.01} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="vel_aire_mh" label="Velocidad aire (m/h)">
            <InputNumber min={0} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item
            name="area_ventilacion_m2"
            label="Área de ventilación (m²)"
            rules={[{ required: true, message: 'Campo obligatorio' }]}
          >
            <InputNumber min={0} step={0.01} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="area_alto_m" label="Área ALTO (m)">
            <InputNumber min={0} step={0.01} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="area_ancho_m" label="Área ANCHO (m)">
            <InputNumber min={0} step={0.01} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item
            name="caudal_m3h"
            label="Caudal de extracción o inyección de aire (m³/h)"
            rules={[{ required: true, message: 'Campo obligatorio' }]}
          >
            <InputNumber min={0} step={0.01} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="vol_largo_m" label="Cálculo auxiliar - Largo (m)">
            <InputNumber min={0} step={0.01} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="vol_ancho_m" label="Cálculo auxiliar - Ancho (m)">
            <InputNumber min={0} step={0.01} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="vol_alto_m" label="Cálculo auxiliar - Altura (m)">
            <InputNumber min={0} step={0.01} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item
            name="volumen_m3"
            label="Volumen del ambiente (m³)"
            rules={[{ required: true, message: 'Campo obligatorio' }]}
          >
            <InputNumber min={0} step={0.01} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item
            name="renovaciones_h"
            label="N° renovación por hora"
            rules={[{ required: true, message: 'Campo obligatorio' }]}
          >
            <InputNumber min={0} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="image_urls" label="URLs de imágenes (separadas por coma)">
            <Input.TextArea rows={2} placeholder="https://... , https://..." />
          </Form.Item>
          <Form.Item name="location" label="Ubicación (texto o JSON)">
            <Input placeholder='Ej: {"lat": -16.5, "lng": -68.1} ó texto' />
          </Form.Item>
        </Form>
      </Modal>

      {/* MODAL VER IMÁGENES */}
      <Modal
        open={imageViewerOpen}
        onCancel={() => setImageViewerOpen(false)}
        footer={
          imageViewerList.length > 1
            ? [
                <Button
                  key="prev"
                  onClick={() =>
                    setImageViewerIndex(
                      (prev) => (prev - 1 + imageViewerList.length) % imageViewerList.length
                    )
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
              alt="ventilación"
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

export default VentilacionPage;
