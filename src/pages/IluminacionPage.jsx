// src/pages/IluminacionPage.jsx
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
} from '@ant-design/icons';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient.js';
import dayjs from 'dayjs';
import 'dayjs/locale/es';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import XLSX from 'xlsx-js-style';

dayjs.locale('es');
dayjs.extend(utc);
dayjs.extend(timezone);

const { Title, Text } = Typography;
const { Option } = Select;

const TIPOS_ILUMINACION = ['Natural', 'LED', 'Fluorescente', 'Mixta', 'Artificial'];
const MEDICIONES_TABLE_NAME = 'iluminacion';
const PRIMARY_BLUE = '#2a8bb6';

const calculateAverage = (lecturas) => {
  if (!lecturas || lecturas.length === 0) return 0;
  const sum = lecturas.reduce((acc, val) => acc + (val || 0), 0);
  return (sum / lecturas.length).toFixed(1);
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


const IluminacionPage = () => {
  const { projectId, monitoreoId: mId, id } = useParams();
  const monitoreoId = mId || id;
  const navigate = useNavigate();
  const [form] = Form.useForm();

  const [monitoreoInfo, setMonitoreoInfo] = useState(null);
  const [proyectoInfo, setProyectoInfo] = useState(null);
  const [equiposInfo, setEquiposInfo] = useState([]);
  const [mediciones, setMediciones] = useState([]);

  const [loadingHeader, setLoadingHeader] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isFormModalVisible, setIsFormModalVisible] = useState(false);
  const [selectedMedicion, setSelectedMedicion] = useState(null);

  // modal ver imagen
  const [imageViewerOpen, setImageViewerOpen] = useState(false);
  const [imageViewerList, setImageViewerList] = useState([]);
  const [imageViewerIndex, setImageViewerIndex] = useState(0);

  // aviso realtime
  const [lastRtMsg, setLastRtMsg] = useState('');

  // búsqueda + paginación
  const [searchText, setSearchText] = useState('');
  const [pageSize, setPageSize] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);

  // diccionario de usuarios {id: nombre}
  const [usersById, setUsersById] = useState({});

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
          if (String(data.proyecto_id) !== String(projectId)) {
            message.warning('El monitoreo no pertenece al proyecto de la URL.');
          }
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

  /* ========================= MEDICIONES ========================= */
  const fetchMediciones = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from(MEDICIONES_TABLE_NAME)
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
        const { data: dataByProj } = await supabase
          .from(MEDICIONES_TABLE_NAME)
          .select('*')
          .eq('proyecto_id', projectId)
          .order('created_at', { ascending: true });
        data = dataByProj || [];
      }

      const mapped = (data || []).map((r) => {
        const lecturas = Array.isArray(r.mediciones_lux)
          ? r.mediciones_lux
          : r.mediciones_lux?.values
            ? r.mediciones_lux.values
            : [];

        let imageUrls = [];
        if (Array.isArray(r.image_urls)) {
          imageUrls = r.image_urls;
        } else if (typeof r.image_urls === 'string' && r.image_urls.trim() !== '') {
          imageUrls = r.image_urls.split(',').map((s) => s.trim());
        }

        let fecha_medicion = '';
        let hora_medicion = '';
        if (r.measured_at) {
          const raw = String(r.measured_at);
          const datePart = raw.slice(0, 10);
          const [yyyy, mm, dd] = datePart.split('-');
          fecha_medicion = `${dd}/${mm}/${yyyy}`;
          hora_medicion = raw.slice(11, 16);
        }

        return {
          ...r,
          descripcion: r.descripcion_actividad || '',
          lecturas,
          image_urls: imageUrls,
          fecha_medicion,
          hora_medicion,
        };
      });

      setMediciones(mapped);
      setCurrentPage(1);

      // traer perfiles de los created_by
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
      console.error('Error mediciones:', e);
      message.error('No se pudieron cargar las mediciones.');
      setMediciones([]);
    } finally {
      setLoading(false);
    }
  };

  // 👇 traer usuarios desde profiles
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

  useEffect(() => {
    fetchMediciones();

    const channel = supabase
      .channel('rt-iluminacion-all')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: MEDICIONES_TABLE_NAME,
        },
        (payload) => {
          console.log('RT: cambio en iluminacion', payload);
          setLastRtMsg(
            `Cambio ${payload.eventType} en ID ${payload.new?.id || payload.old?.id || '—'}`
          );
          fetchMediciones();
        }
      )
      .subscribe((status, err) => {
        console.log('RT status', status, err || '');
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [monitoreoId, projectId]);

  /* ========================= CRUD ========================= */
  const handleAdd = () => {
    setSelectedMedicion(null);
    setIsFormModalVisible(true);
  };

  const handleEdit = (record) => {
    setSelectedMedicion(record);
    setIsFormModalVisible(true);
  };

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
          const { error } = await supabase
            .from(MEDICIONES_TABLE_NAME)
            .delete()
            .eq('id', record.id);
          if (error) throw error;
          message.success('Medición eliminada.');
        } catch (err) {
          console.error(err);
          message.error('No se pudo eliminar.');
        }
      },
    });
  };

  const handleFormOk = () => {
    selectedMedicion ? handleEditOk() : handleAddOk();
  };

  const handleFormCancel = () => {
    setIsFormModalVisible(false);
  };

  // guardamos medidos sin restar 4 horas
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
        imageUrlsToSave = values.image_urls
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean);
      }

      const payload = {
        proyecto_id: projectId || null,
        monitoreo_id: monitoreoId || null,
        measured_at: measuredAt,
        area: values.area,
        puesto_trabajo: values.puesto_trabajo,
        punto_medicion: values.punto_medicion,
        descripcion_actividad: values.descripcion || null,
        tipo_iluminacion: values.tipo_iluminacion,
        nivel_requerido: values.nivel_requerido,
        mediciones_lux: (values.lecturas || []).filter((l) => l != null),
        k_index: values.k_index || null,
        k_params: values.k_params || null,
        observaciones: values.observaciones || null,
        image_urls: imageUrlsToSave,
        location: values.location || null,
      };

      const { error } = await supabase.from(MEDICIONES_TABLE_NAME).insert(payload);
      if (error) throw error;

      message.success('Medición agregada.');
      setIsFormModalVisible(false);
    } catch (err) {
      console.error('Error al agregar:', err);
      message.error('No se pudo agregar.');
    } finally {
      setSaving(false);
    }
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
        imageUrlsToSave = values.image_urls
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean);
      }

      const updateData = {
        area: values.area,
        puesto_trabajo: values.puesto_trabajo,
        punto_medicion: values.punto_medicion,
        descripcion_actividad: values.descripcion || null,
        measured_at: measuredAt,
        tipo_iluminacion: values.tipo_iluminacion,
        nivel_requerido: values.nivel_requerido,
        mediciones_lux: (values.lecturas || []).filter((l) => l != null),
        k_index: values.k_index || null,
        k_params: values.k_params || null,
        observaciones: values.observaciones || null,
        image_urls: imageUrlsToSave,
        location: values.location || null,
      };

      const { error } = await supabase
        .from(MEDICIONES_TABLE_NAME)
        .update(updateData)
        .eq('id', selectedMedicion.id);
      if (error) throw error;

      message.success('Medición actualizada.');
      setIsFormModalVisible(false);
    } catch (err) {
      console.error('Error al actualizar:', err);
      message.error('No se pudo actualizar.');
    } finally {
      setSaving(false);
    }
  };

  const setHoraActual = () => {
    form.setFieldsValue({ horario_medicion: dayjs() });
  };

  /* ========================= HELPERS UI ========================= */
  const openImageViewer = (imgs, idx = 0) => {
    if (!imgs || imgs.length === 0) return;
    setImageViewerList(imgs);
    setImageViewerIndex(idx);
    setImageViewerOpen(true);
  };

  const renderLocation = (v) => {
    if (!v) return <Text type="secondary">N/A</Text>;
    if (typeof v === 'object') {
      const lat = v.lat ?? v.latitude ?? '';
      const lng = v.lng ?? v.longitude ?? '';
      if (lat !== '' || lng !== '') {
        return (
          <span>
            lat: {lat}
            {lng !== '' ? `, lng: ${lng}` : ''}
          </span>
        );
      }
      if (Array.isArray(v)) return v.join(', ');
      return JSON.stringify(v);
    }
    try {
      const parsed = JSON.parse(v);
      return renderLocation(parsed);
    } catch {
      return v;
    }
  };

  /* ========================= EXPORTAR A EXCEL ========================= */
  const exportToExcel = () => {
    try {
      const maxLecturas = mediciones.reduce((max, m) => {
        const lects = Array.isArray(m.lecturas) ? m.lecturas : [];
        return Math.max(max, lects.length);
      }, 0);

      const firstMedicion = mediciones && mediciones.length > 0 ? mediciones[0] : null;

      const headerInstalacion = proyectoInfo?.nombre || '';
      const headerFechaInicio = firstMedicion?.measured_at
        ? (() => {
          const raw = String(firstMedicion.measured_at);
          const [yyyy, mm, dd] = raw.slice(0, 10).split('-');
          return `${dd}/${mm}/${yyyy}`;
        })()
        : proyectoInfo?.created_at
          ? dayjs(proyectoInfo.created_at).format('DD/MM/YYYY')
          : '';
      const headerFechaFin = '';
      const headerTipoMonitoreo = monitoreoInfo?.tipo_monitoreo || 'Iluminacion';

      const headerEquipos =
        equiposInfo && equiposInfo.length
          ? equiposInfo.map((eq) => eq.nombre_equipo || 's/n').join(', ')
          : '';
      const headerModelos =
        equiposInfo && equiposInfo.length
          ? equiposInfo.map((eq) => eq.modelo || 's/n').join(', ')
          : '';
      const headerSeries =
        equiposInfo && equiposInfo.length
          ? equiposInfo.map((eq) => eq.serie || 's/n').join(', ')
          : '';

      const baseBorder = {
        top: { style: 'thin', color: { rgb: '000000' } },
        bottom: { style: 'thin', color: { rgb: '000000' } },
        left: { style: 'thin', color: { rgb: '000000' } },
        right: { style: 'thin', color: { rgb: '000000' } },
      };

      const cellHeaderLeft = {
        font: { bold: true },
        alignment: { vertical: 'center', horizontal: 'left', wrapText: true },
        border: baseBorder,
      };

      const cellHeaderValue = {
        alignment: { vertical: 'center', horizontal: 'left', wrapText: true },
        border: baseBorder,
      };

      const headerTableStyle = {
        font: { bold: true },
        alignment: { vertical: 'center', horizontal: 'center', wrapText: true },
        fill: { fgColor: { rgb: 'D9D9D9' } },
        border: baseBorder,
      };

      const cellDataStyle = {
        alignment: { vertical: 'center', horizontal: 'left', wrapText: true },
        border: baseBorder,
      };

      const wsData = [];

      // título
      wsData.push([
        {
          v: 'PLANILLA DE MEDICIÓN Y EVALUACIÓN DE ILUMINACIÓN',
          s: {
            font: { bold: true, sz: 14 },
            alignment: { vertical: 'center', horizontal: 'center' },
          },
        },
      ]);

      // cabecera EXACTA en 4 columnas
      wsData.push([
        { v: 'NOMBRE DE LA EMPRESA', s: cellHeaderLeft },
        { v: headerInstalacion, s: cellHeaderValue },
        { v: 'EQUIPO', s: cellHeaderLeft },
        { v: headerEquipos, s: cellHeaderValue },
      ]);

      wsData.push([
        { v: 'FECHA DE INICIO', s: cellHeaderLeft },
        { v: headerFechaInicio, s: cellHeaderValue },
        { v: 'MODELO DEL EQUIPO', s: cellHeaderLeft },
        { v: headerModelos, s: cellHeaderValue },
      ]);

      wsData.push([
        { v: 'FECHA DE FINALIZACIÓN', s: cellHeaderLeft },
        { v: headerFechaFin, s: cellHeaderValue },
        { v: 'SERIE DEL EQUIPO', s: cellHeaderLeft },
        { v: headerSeries, s: cellHeaderValue },
      ]);

      wsData.push([
        { v: 'TIPO DE MONITOREO', s: cellHeaderLeft },
        { v: headerTipoMonitoreo, s: cellHeaderValue },
        { v: '', s: cellHeaderValue },
        { v: '', s: cellHeaderValue },
      ]);

      // fila vacía
      wsData.push(['']);

      // cabecera de datos
      const fixedHeaders = [
        { v: 'No.', s: headerTableStyle },
        { v: 'Área', s: headerTableStyle },
        { v: 'Puesto de Trabajo', s: headerTableStyle },
        { v: 'Punto de medición', s: headerTableStyle },
        { v: 'Descripción actividad', s: headerTableStyle },
        { v: 'Fecha de medición', s: headerTableStyle },
        { v: 'Hora de medición', s: headerTableStyle },
        { v: 'Tipo de iluminación', s: headerTableStyle },
        { v: 'Nivel iluminancia requerido (lux)', s: headerTableStyle },
      ];

      const dynamicMHeaders = [];
      for (let i = 1; i <= maxLecturas; i++) {
        dynamicMHeaders.push({ v: `M${i}`, s: headerTableStyle });
      }

      const resultHeaders = [
        { v: 'Min', s: headerTableStyle },
        { v: 'Max', s: headerTableStyle },
        { v: 'Promedio', s: headerTableStyle },
        { v: 'Observaciones', s: headerTableStyle },
      ];

      wsData.push([...fixedHeaders, ...dynamicMHeaders, ...resultHeaders]);

      mediciones.forEach((m, idx) => {
        const lects = Array.isArray(m.lecturas) ? m.lecturas : [];

        let fechaMedicion = '';
        let horaMedicion = '';
        if (m.measured_at) {
          const raw = String(m.measured_at);
          const [yyyy, mm, dd] = raw.slice(0, 10).split('-');
          fechaMedicion = `${dd}/${mm}/${yyyy}`;
          horaMedicion = raw.slice(11, 16);
        }

        const numLects = lects.filter((x) => typeof x === 'number');
        const min = numLects.length ? Math.min(...numLects) : '';
        const max = numLects.length ? Math.max(...numLects) : '';
        const prom = numLects.length
          ? (numLects.reduce((a, b) => a + b, 0) / numLects.length).toFixed(1)
          : '';

        const row = [
          { v: idx + 1, s: cellDataStyle },
          { v: m.area || '', s: cellDataStyle },
          { v: m.puesto_trabajo || '', s: cellDataStyle },
          { v: m.punto_medicion || '', s: cellDataStyle },
          { v: m.descripcion_actividad || '', s: cellDataStyle },
          { v: fechaMedicion, s: cellDataStyle },
          { v: horaMedicion, s: cellDataStyle },
          { v: m.tipo_iluminacion || '', s: cellDataStyle },
          { v: m.nivel_requerido ?? '', s: cellDataStyle },
        ];

        for (let i = 0; i < maxLecturas; i++) {
          row.push({ v: lects[i] ?? '', s: cellDataStyle });
        }

        row.push({ v: min, s: cellDataStyle });
        row.push({ v: max, s: cellDataStyle });
        row.push({ v: prom, s: cellDataStyle });
        row.push({ v: m.observaciones || '', s: cellDataStyle });

        wsData.push(row);
      });

      const ws = XLSX.utils.aoa_to_sheet(wsData);

      const totalCols = fixedHeaders.length + maxLecturas + resultHeaders.length;
      ws['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: totalCols - 1 } }];

      const cols = [];
      cols[0] = { wch: 22 };
      cols[1] = { wch: 25 };
      cols[2] = { wch: 18 };
      cols[3] = { wch: 25 };

      for (let i = 4; i < totalCols; i++) {
        if (i === 4) cols.push({ wch: 4 });
        else if (i === 5) cols.push({ wch: 16 });
        else if (i === 6) cols.push({ wch: 18 });
        else if (i === 8) cols.push({ wch: 25 });
        else cols.push({ wch: 11 });
      }
      ws['!cols'] = cols;

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Iluminación');
      XLSX.writeFile(wb, 'reporte_iluminacion.xlsx');
    } catch (err) {
      console.error('Error exportando a Excel:', err);
      message.error('No se pudo exportar el Excel.');
    }
  };

  /* ========================= FILTRO + PAGINACIÓN ========================= */
  const filteredMediciones = useMemo(() => {
    if (!searchText) return mediciones;
    const s = searchText.toLowerCase();
    return mediciones.filter((m) => {
      return (
        (m.area && m.area.toLowerCase().includes(s)) ||
        (m.puesto_trabajo && m.puesto_trabajo.toLowerCase().includes(s)) ||
        (m.punto_medicion && m.punto_medicion.toLowerCase().includes(s)) ||
        (m.tipo_iluminacion && m.tipo_iluminacion.toLowerCase().includes(s)) ||
        (m.descripcion_actividad && m.descripcion_actividad.toLowerCase().includes(s)) ||
        (m.observaciones && m.observaciones.toLowerCase().includes(s))
      );
    });
  }, [searchText, mediciones]);

  const totalFiltered = filteredMediciones.length;

  const paginatedMediciones = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredMediciones.slice(start, start + pageSize);
  }, [filteredMediciones, currentPage, pageSize]);

  /* ========================= COLUMNAS TABLA ========================= */
  const columns = [
    {
      title: 'N°',
      key: 'numero',
      width: 40,
      render: (_, __, i) => (currentPage - 1) * pageSize + i + 1,
    },

    // Nueva columna Fecha
        {
          title: 'FECHA',
          dataIndex: 'measured_at',
          key: 'measured_date',
          // ✅ Permite ordenar ascendente/descendente por fecha
          sorter: (a, b) => dayjs(a.measured_at).unix() - dayjs(b.measured_at).unix(),
          defaultSortOrder: 'descend',
          width:90, render: (t) => formatFechaUTC(t),
        },
    
        // Columna Hora (se conserva)
        {
          title: 'HORA',
          dataIndex: 'measured_at',
          key: 'measured_time',
          // ✅ Permite ordenar ascendente/descendente por hora
          sorter: (a, b) => dayjs(a.measured_at).unix() - dayjs(b.measured_at).unix(),
          width: 90,
          render: (t) => formatHoraUTC(t),
        },

    {
      title: 'Área',
      dataIndex: 'area',
      key: 'area',
      ellipsis: true,
      width: 130,
    },
    {
      title: 'Puesto de Trabajo',
      dataIndex: 'puesto_trabajo',
      key: 'puesto_trabajo',
      ellipsis: true,
      width: 150,
    },
    {
      title: 'Punto de Medición',
      dataIndex: 'punto_medicion',
      key: 'punto_medicion',
      ellipsis: true,
      width: 140,
    },
   
    {
      title: 'Tipo Iluminación',
      dataIndex: 'tipo_iluminacion',
      key: 'tipo_iluminacion',
      ellipsis: true,
      width: 125,
    },
    {
      title: 'Nivel Requerido (LUX)',
      dataIndex: 'nivel_requerido',
      key: 'nivel_requerido',
      width: 120,
    },
    {
      title: 'Mediciones (LUX)',
      dataIndex: 'lecturas',
      key: 'lecturas',
      width: 150,
      render: (lecturas) => {
        const data = Array.isArray(lecturas) ? lecturas : [];
        if (!data.length) return <Tag>Sin lecturas</Tag>;
        const avg = calculateAverage(data);
        const content = (
          <div style={{ maxWidth: 200 }}>
            <Text strong>Lecturas:</Text>
            <ul style={{ paddingLeft: 18, margin: '8px 0 0' }}>
              {data.map((x, i) => (
                <li key={i}>{x} LUX</li>
              ))}
            </ul>
          </div>
        );
        return (
          <Popover content={content} title="Detalle de mediciones" trigger="hover">
            <Tag color="blue" style={{ cursor: 'pointer' }}>
              Promedio: {avg} LUX ({data.length})
            </Tag>
          </Popover>
        );
      },
    },
    {
      title: 'Imágenes',
      dataIndex: 'image_urls',
      key: 'image_urls',
      width: 120,
      render: (imgs) => {
        const list = Array.isArray(imgs) ? imgs : [];
        if (!list.length) return <Text type="secondary">Ninguna</Text>;
        return (
          <Button
            type="link"
            icon={<EyeOutlined />}
            onClick={() => openImageViewer(list, 0)}
            size="small"
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
      width: 280,
      render: (v) => renderLocation(v),
    },
    {
      title: 'Observaciones',
      dataIndex: 'observaciones',
      key: 'observaciones',
      ellipsis: true,
      width: 180,
    },
    {
      title: 'Registrado por',
      dataIndex: 'created_by',
      key: 'created_by',
      width: 110,
      fixed: 'right', // <- la dejamos inmóvil
      render: (v) => {
        if (!v) return <Text type="secondary">N/A</Text>;
        const display = usersById[v];
        return display ? <Text>{display}</Text> : <Text type="secondary">{v}</Text>;
      },
    },
    {
      title: 'Acciones',
      key: 'acciones',
      width: 100,
      fixed: 'right', // <- y también acciones
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
  const firstMedicion = mediciones && mediciones.length > 0 ? mediciones[0] : null;

  const headerNombreEmpresa = proyectoInfo?.nombre || 'Cargando...';
  const headerAreaTrabajo = '';
  const headerFechaInicio = firstMedicion?.measured_at
    ? (() => {
      const raw = String(firstMedicion.measured_at);
      const [yyyy, mm, dd] = raw.slice(0, 10).split('-');
      return `${dd}/${mm}/${yyyy}`;
    })()
    : proyectoInfo?.created_at
      ? dayjs(proyectoInfo.created_at).format('DD/MM/YYYY')
      : 'N/A';
  const headerFechaFin = '';
  const headerEquipos =
    safeEquipos.length > 0
      ? safeEquipos.map((eq) => eq.nombre_equipo || 's/n').join(', ')
      : 'Ninguno';
  const headerModelos =
    safeEquipos.length > 0
      ? safeEquipos.map((eq) => eq.modelo || 's/n').join(', ')
      : 'N/A';
  const headerSeries =
    safeEquipos.length > 0
      ? safeEquipos.map((eq) => eq.serie || 's/n').join(', ')
      : 'N/A';

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
        <Breadcrumb.Item>{monitoreoInfo?.tipo_monitoreo || 'Mediciones'}</Breadcrumb.Item>
      </Breadcrumb>

      <Row justify="space-between" align="middle" style={{ marginBottom: 8 }}>
        <Col>
          <Title level={2} style={{ color: PRIMARY_BLUE, marginBottom: 0 }}>
            <LineChartOutlined /> Monitoreo de Iluminacion
          </Title>
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
              Agregar Medición
            </Button>
          </Space>
        </Col>
      </Row>


      {/* buscador + selector */}
      <Row justify="space-between" align="middle" style={{ marginBottom: 16, gap: 15 }}>
        <Col flex="0 0 590px">
          <Input.Search
            allowClear
            placeholder="Buscar por área, puesto, punto..."
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
          <Descriptions.Item label="FECHA DE INICIO">
            {headerFechaInicio}
          </Descriptions.Item>
          <Descriptions.Item label="AREA DE TRABAJO">
            {headerAreaTrabajo}
          </Descriptions.Item>
          <Descriptions.Item label="FECHA DE FINALIZACION">
            {headerFechaFin}
          </Descriptions.Item>
          <Descriptions.Item label="EQUIPO">
            {headerEquipos}
          </Descriptions.Item>
          <Descriptions.Item label="MODELO DEL EQUIPO">
            {headerModelos}
          </Descriptions.Item>

          <Descriptions.Item label="SERIE DEL EQUIPO">
            {headerSeries}
          </Descriptions.Item>
        </Descriptions>
      </Spin>

      <Spin spinning={loading}>
        {/* importante: la tabla ya tiene scroll.x, ahora las columnas fijas sí funcionan */}
        <div style={{ overflowX: 'auto' }}>
          <Table
            lassName="tabla-general" // <--- Clase personalizada para estilos de tabla cabecera fija
            size="small"
            columns={columns}
            dataSource={paginatedMediciones}
            rowKey="id"
            pagination={false}
            scroll={{ x: 1400 }} // un valor suficiente para que active scroll y respete las columnas fijas
          />
        </div>
      </Spin>

      {/* pie Regsitro x de y*/}
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
        title={selectedMedicion ? 'Editar Medición' : 'Agregar Medición'}
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
          name="medicionForm"
          key={selectedMedicion ? `edit-${selectedMedicion.id}` : 'add'}
          initialValues={
            selectedMedicion
              ? (() => {
                let timeVal = null;
                if (selectedMedicion.measured_at) {
                  const raw = String(selectedMedicion.measured_at);
                  const hhmm = raw.slice(11, 16);
                  const [hh, mm] = hhmm.split(':');
                  timeVal = dayjs().hour(Number(hh)).minute(Number(mm));
                }
                return {
                  area: selectedMedicion.area,
                  puesto_trabajo: selectedMedicion.puesto_trabajo,
                  punto_medicion: selectedMedicion.punto_medicion,
                  descripcion: selectedMedicion.descripcion_actividad || '',
                  horario_medicion: timeVal,
                  tipo_iluminacion: selectedMedicion.tipo_iluminacion,
                  nivel_requerido: selectedMedicion.nivel_requerido,
                  lecturas:
                    Array.isArray(selectedMedicion.lecturas) &&
                      selectedMedicion.lecturas.length > 0
                      ? selectedMedicion.lecturas
                      : [undefined],
                  k_index: selectedMedicion.k_index || '',
                  k_params: selectedMedicion.k_params || '',
                  observaciones: selectedMedicion.observaciones || '',
                  image_urls: Array.isArray(selectedMedicion.image_urls)
                    ? selectedMedicion.image_urls.join(', ')
                    : selectedMedicion.image_urls || '',
                  location: selectedMedicion.location || '',
                };
              })()
              : {
                lecturas: [undefined],
              }
          }
          preserve={false}
        >
          <Form.Item name="area" label="Área" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item
            name="puesto_trabajo"
            label="Puesto de Trabajo"
            rules={[{ required: true }]}
          >
            <Input />
          </Form.Item>
          <Form.Item
            name="punto_medicion"
            label="Punto de Medición"
            rules={[{ required: true }]}
          >
            <Input placeholder="Ej: P1" />
          </Form.Item>
          <Form.Item name="descripcion" label="Descripción (Opcional)">
            <Input.TextArea rows={2} />
          </Form.Item>
          <Form.Item
            name="horario_medicion"
            label="Horario de Medición"
            rules={[{ required: true, message: 'El horario es obligatorio' }]}
          >
            <Space.Compact style={{ width: '100%' }}>
              <TimePicker format="HH:mm" style={{ flex: 1 }} />
              <Tooltip title="Usar hora actual">
                <Button icon={<ClockCircleOutlined />} onClick={setHoraActual} />
              </Tooltip>
            </Space.Compact>
          </Form.Item>
          <Form.Item
            name="tipo_iluminacion"
            label="Tipo de Iluminación"
            rules={[{ required: true }]}
          >
            <Select placeholder="Selecciona un tipo">
              {TIPOS_ILUMINACION.map((t) => (
                <Option key={t} value={t}>
                  {t}
                </Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item
            name="nivel_requerido"
            label="Nivel Requerido (LUX)"
            rules={[{ required: true, message: 'El nivel requerido es obligatorio' }]}
          >
            <InputNumber min={0} style={{ width: '100%' }} />
          </Form.Item>

          <Form.List
            name="lecturas"
            rules={[
              {
                validator: async (_, lecturas) => {
                  if (!lecturas || lecturas.filter((l) => l != null).length === 0) {
                    return Promise.reject(new Error('Agrega al menos una lectura'));
                  }
                },
              },
            ]}
          >
            {(fields, { add, remove }, { errors }) => (
              <>
                <Text strong>Lecturas de Medición (LUX)</Text>
                {fields.map(({ key, name, ...rest }) => (
                  <Space
                    key={key}
                    style={{ display: 'flex', marginBottom: 8 }}
                    align="baseline"
                  >
                    <Form.Item
                      {...rest}
                      name={name}
                      rules={[{ required: true, message: 'Falta valor' }]}
                    >
                      <InputNumber min={0} placeholder="Ej: 550" style={{ width: '100%' }} />
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

          <Form.Item name="image_urls" label="URLs de imágenes (coma separadas)">
            <Input.TextArea rows={2} placeholder="https://... , https://..." />
          </Form.Item>

          <Form.Item name="location" label="Ubicación (texto o JSON)">
            <Input placeholder='Ej: -16.5, -68.1 ó {"lat":-16.5,"lng":-68.1}' />
          </Form.Item>

          <Form.Item name="k_index" label="k_index (opcional)">
            <Input placeholder="Ej: 0.8" />
          </Form.Item>
          <Form.Item name="k_params" label="k_params (opcional)">
            <Input.TextArea rows={2} placeholder="JSON de parámetros o texto" />
          </Form.Item>

          <Form.Item name="observaciones" label="Observaciones (Opcional)">
            <Input.TextArea rows={2} />
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
        title="Imagen de la medición"
      >
        {imageViewerList.length ? (
          <div style={{ textAlign: 'center' }}>
            <img
              src={imageViewerList[imageViewerIndex]}
              alt="medición"
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

export default IluminacionPage; // SUBIDO EN FECHA 14/11/2025 HRS. 10:11
