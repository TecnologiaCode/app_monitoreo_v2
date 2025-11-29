// src/pages/ParticulasPage.jsx

import React, { useEffect, useState, useMemo } from 'react';
import {
  Table,
  Button,
  Form,
  Input,
  Modal,
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
  Select,
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
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import 'dayjs/locale/es';
import { supabase } from '../supabaseClient.js';
import * as XLSX from 'xlsx';         // (tu versión nueva de Excel)
// IMPORTS DEL REPORTE
import { PDFViewer } from '@react-pdf/renderer';
import { ReporteFotografico } from '../components/ReporteFotografico';

dayjs.extend(utc);
dayjs.locale('es');

const { Title, Text } = Typography;
const { Option } = Select;

const PRIMARY_BLUE = '#2a8bb6';
const PARTICULAS_TABLE = 'particulas';

const LIMITE_PM10 = 10;
const LIMITE_PM25 = 3;

/* ================= HELPERS ================= */

const parseHoraLocalToUTC = (input, originalTimestamp = null) => {
  if (!input || typeof input !== 'string' || input.trim() === '') return null;
  const baseDateLocal = originalTimestamp ? dayjs(originalTimestamp).local() : dayjs().local();
  let hora, minuto, segundo, fechaConHoraLocal;
  const timeMatch = input.match(/^(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?$/);
  if (timeMatch) {
    hora = parseInt(timeMatch[1], 10);
    minuto = parseInt(timeMatch[2], 10);
    segundo = timeMatch[3] ? parseInt(timeMatch[3], 10) : 0;
    fechaConHoraLocal = baseDateLocal.hour(hora).minute(minuto).second(segundo);
  } else {
    fechaConHoraLocal = dayjs(input);
    if (!fechaConHoraLocal.isValid()) return null;
  }
  return fechaConHoraLocal.toISOString();
};

const formatHoraUTC = (v) => {
  if (!v) return '';
  try { return dayjs(v).utc().format('HH:mm'); } catch { return String(v); }
};

const formatFechaUTC = (v) => {
  if (!v) return '';
  try { return dayjs(v).utc().format('DD/MM/YYYY'); } catch { return String(v); }
};

// --- NUEVO HELPER PARA EXCEL: Convierte JSON de ubicación a Texto Plano ---
const formatLocationText = (v) => {
  if (!v) return '';
  let val = v;
  // Si viene como string (JSON), intentamos parsearlo
  if (typeof v === 'string') {
    try { val = JSON.parse(v); } catch (e) { return v; }
  }
  // Si es objeto UTM
  if (val && typeof val === 'object' && !Array.isArray(val)) {
    if (val.easting || val.northing) {
      const e =
        val.easting !== undefined && val.easting !== null
          ? Number(val.easting).toFixed(4)
          : '?';
      const n =
        val.northing !== undefined && val.northing !== null
          ? Number(val.northing).toFixed(4)
          : '?';
      const z = val.utm_zone ? `, Z: ${val.utm_zone}` : '';
      return `E: ${e}, N: ${n}${z}`;
    }
    if (val.lat || val.latitude) {
      const lat = val.lat || val.latitude;
      const lng = val.lng || val.longitude;
      return `Lat: ${lat}, Lng: ${lng}`;
    }
  }
  return JSON.stringify(val);
};

const ParticulasPage = () => {
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

  const [imageViewerOpen, setImageViewerOpen] = useState(false);
  const [imageViewerList, setImageViewerList] = useState([]);
  const [imageViewerIndex, setImageViewerIndex] = useState(0);

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

  const openImageViewer = (imgs, idx = 0) => {
    if (!imgs || !imgs.length) return;
    setImageViewerList(imgs);
    setImageViewerIndex(idx);
    setImageViewerOpen(true);
  };

  // Helper para renderizar Ubicación en la Tabla (UI)
  const renderLocation = (v) => {
    if (!v) return <Text type="secondary">N/A</Text>;
    let val = v;
    if (typeof v === 'string') {
      try {
        val = JSON.parse(v);
      } catch (e) {
        return v;
      }
    }
    if (val && typeof val === 'object' && !Array.isArray(val)) {
      if (val.easting || val.northing) {
        const e =
          val.easting !== undefined && val.easting !== null
            ? Number(val.easting).toFixed(4)
            : '?';
        const n =
          val.northing !== undefined && val.northing !== null
            ? Number(val.northing).toFixed(4)
            : '?';
        const z = val.utm_zone ? `, Z: ${val.utm_zone}` : '';
        return <span>{`E: ${e}, N: ${n}${z}`}</span>;
      }
      if (val.lat || val.latitude) {
        return (
          <span>{`Lat: ${val.lat || val.latitude}, Lng: ${
            val.lng || val.longitude
          }`}</span>
        );
      }
    }
    if (Array.isArray(val)) return val.join(', ');
    return JSON.stringify(val);
  };

  const getImagesArray = (reg) => {
    if (Array.isArray(reg.image_urls)) return reg.image_urls;
    if (typeof reg.image_urls === 'string' && reg.image_urls.trim() !== '') {
      try {
        const parsed = JSON.parse(reg.image_urls);
        if (Array.isArray(parsed)) return parsed;
      } catch {
        return reg.image_urls.split(',').map((s) => s.trim());
      }
    }
    return [];
  };

  const handlePrevImage = (regId, total) => {
    setTempSelections((prev) => ({
      ...prev,
      [regId]: (prev[regId] - 1 + total) % total
    }));
  };

  const handleNextImage = (regId, total) => {
    setTempSelections((prev) => ({
      ...prev,
      [regId]: (prev[regId] + 1) % total
    }));
  };

  const handleRecordSelectionToggle = (recordId) => {
    setRecordSelections((prev) => ({ ...prev, [recordId]: !prev[recordId] }));
  };

  const handleSelectAllRecords = () => {
    const allSelected = {};
    registros
      .filter((r) => getImagesArray(r).length > 0)
      .forEach((r) => {
        allSelected[r.id] = true;
      });
    setRecordSelections(allSelected);
  };

  const handleDeselectAllRecords = () => {
    const allDeselected = {};
    registros
      .filter((r) => getImagesArray(r).length > 0)
      .forEach((r) => {
        allDeselected[r.id] = false;
      });
    setRecordSelections(allDeselected);
  };

  const handleOpenPdf = () => {
    const registrosConFotos = registros.filter(
      (r) => getImagesArray(r).length > 0
    );
    if (registrosConFotos.length === 0) {
      message.warning('No hay registros con imágenes.');
      return;
    }
    const initialSelections = {};
    const initialRecordSelections = {};
    registrosConFotos.forEach((r) => {
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
    const loadingMsg = message.loading('Generando reporte...', 0);
    try {
      const registrosConFotos = registros.filter((r) => getImagesArray(r).length > 0);
      const registrosSeleccionados = registrosConFotos.filter(
        (r) => recordSelections[r.id] === true
      );
      if (registrosSeleccionados.length === 0) {
        message.warning('No ha seleccionado ningún registro.');
        setIsSavingSelection(false);
        loadingMsg();
        return;
      }
      const supabaseTasks = [];
      const dataForPdf = [];
      let i = 0;
      for (const r of registrosSeleccionados) {
        const imgs = getImagesArray(r);
        const selectedIdx =
          tempSelections[r.id] !== undefined ? tempSelections[r.id] : 0;
        const finalIdx = selectedIdx < imgs.length ? selectedIdx : 0;
        const originalUrl = imgs[finalIdx];
        const codigo = `PAR-${String(i + 1).padStart(2, '0')}`;
        dataForPdf.push({
          imageUrl: originalUrl,
          area: r.area || 'N/A',
          puesto: r.puesto_trabajo,
          codigo: codigo,
          fechaHora: `${formatFechaUTC(r.measured_at)} - ${formatHoraUTC(
            r.measured_at
          )}`
        });
        supabaseTasks.push(
          supabase
            .from(PARTICULAS_TABLE)
            .update({ selected_image_index: finalIdx })
            .eq('id', r.id)
        );
        i++;
      }
      await Promise.all(supabaseTasks);
      fetchRegistros();
      setPdfData(dataForPdf);
      setPdfStep('view');
      message.success('Reporte generado');
    } catch (error) {
      console.error('Error generando PDF:', error);
      message.error('Ocurrió un error inesperado.');
    } finally {
      loadingMsg();
      setIsSavingSelection(false);
    }
  };

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
    } catch (err) {
      console.error('Error proyecto:', err);
      setProyectoInfo(null);
    }
  };

  const fetchEquiposInfo = async (equipoIds) => {
    if (!equipoIds) {
      setEquiposInfo([]);
      return;
    }
    let list = equipoIds;
    if (typeof list === 'string') {
      try {
        list = JSON.parse(list);
      } catch {
        list = [];
      }
    }
    if (!Array.isArray(list) || !list.length) {
      setEquiposInfo([]);
      return;
    }
    try {
      const { data, error } = await supabase
        .from('equipos')
        .select('id, nombre_equipo, modelo, serie')
        .in('id', list);
      if (error) throw error;
      setEquiposInfo(data || []);
    } catch (err) {
      console.error('Error equipos:', err);
      setEquiposInfo([]);
    }
  };

  useEffect(() => {
    const fetchHeader = async () => {
      if (!monitoreoId) {
        if (projectId) await fetchProyectoInfo(projectId);
        setLoadingHeader(false);
        return;
      }
      setLoadingHeader(true);
      try {
        const { data, error } = await supabase
          .from('monitoreos')
          .select(
            'id, tipo_monitoreo, proyecto_id, equipos_asignados'
          )
          .eq('id', monitoreoId)
          .single();
        if (error) throw error;
        setMonitoreoInfo(data);
        await Promise.all([
          fetchProyectoInfo(data.proyecto_id),
          fetchEquiposInfo(data.equipos_asignados)
        ]);
      } catch (err) {
        console.error('Error cabecera:', err);
      } finally {
        setLoadingHeader(false);
      }
    };
    fetchHeader();
  }, [monitoreoId, projectId]);

  const fetchRegistros = async () => {
    setLoading(true);
    try {
      const cols =
        'id, created_at, proyecto_id, monitoreo_id, measured_at, area, puesto_trabajo, temperatura_c, hr_percent, pm25_values, pm25_prom, pm10_values, pm10_prom, pts_values, pts_prom, observaciones, image_urls, location, created_by, selected_image_index';
      let query = supabase.from(PARTICULAS_TABLE).select(cols);
      if (monitoreoId) query = query.eq('monitoreo_id', monitoreoId);
      else if (projectId) query = query.eq('proyecto_id', projectId);
      else {
        setRegistros([]);
        setLoading(false);
        return;
      }
      query = query
        .order('measured_at', { ascending: true, nullsFirst: true })
        .order('created_at', { ascending: true });
      const { data, error } = await query;
      if (error) throw error;

      const mapped = (data || []).map((r) => {
        const normalizeArray = (val) => {
          if (!val) return [];
          if (Array.isArray(val)) return val;
          if (typeof val === 'string' && val.trim() !== '') {
            try {
              const parsed = JSON.parse(val);
              if (Array.isArray(parsed)) return parsed;
            } catch (_) {
              return val.split(',').map((s) => s.trim());
            }
          }
          return [];
        };
        let imgs = [];
        if (Array.isArray(r.image_urls)) imgs = r.image_urls;
        else if (typeof r.image_urls === 'string' && r.image_urls.trim() !== '') {
          imgs = r.image_urls.split(',').map((s) => s.trim());
        }
        return {
          ...r,
          pm10_values: normalizeArray(r.pm10_values),
          pm25_values: normalizeArray(r.pm25_values),
          pts_values: normalizeArray(r.pts_values),
          image_urls: imgs
        };
      });
      setRegistros(mapped);
      setCurrentPage(1);
      const createdByIds = Array.from(
        new Set(
          (mapped || [])
            .map((m) => m.created_by)
            .filter((v) => v && typeof v === 'string')
        )
      );
      if (createdByIds.length > 0) await fetchUsersByIds(createdByIds);
      else setUsersById({});
    } catch (err) {
      console.error('Error partículas:', err);
      message.error('No se pudieron cargar las partículas.');
      setRegistros([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchUsersByIds = async (ids) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, username, nombre_completo')
        .in('id', ids);
      if (error) return;
      const dict = {};
      (data || []).forEach((u) => {
        dict[u.id] = u.nombre_completo || u.username || u.id;
      });
      setUsersById(dict);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchRegistros();
    const channel = supabase
      .channel('rt-particulas')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: PARTICULAS_TABLE
      }, () => fetchRegistros())
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [monitoreoId, projectId]);

  /* ================ CRUD ================ */
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
      title: '¿Eliminar registro?',
      icon: <ExclamationCircleOutlined />,
      content: `Se eliminará el registro del puesto "${record.puesto_trabajo || record.id}".`,
      okText: 'Eliminar',
      okType: 'danger',
      cancelText: 'Cancelar',
      onOk: async () => {
        try {
          const { error } = await supabase
            .from(PARTICULAS_TABLE)
            .delete()
            .eq('id', record.id);
          if (error) throw error;
          message.success('Registro eliminado.');
        } catch (err) {
          console.error(err);
          message.error('No se pudo eliminar.');
        }
      }
    });
  };

  const handleFormOk = () => {
    selectedRegistro ? handleEditOk() : handleAddOk();
  };
  const handleFormCancel = () => {
    setIsFormModalVisible(false);
  };

  const parseNumberArray = (txt) => {
    if (!txt) return null;
    if (Array.isArray(txt)) return txt;
    const parts = txt
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
      .map((n) => Number(n));
    return parts.length ? parts : null;
  };

  const handleAddOk = async () => {
    setSaving(true);
    try {
      const values = await form.validateFields();
      if (!monitoreoId && !projectId) {
        message.error('Error de contexto.');
        return;
      }
      const payload = {
        proyecto_id: projectId || null,
        monitoreo_id: monitoreoId || null,
        measured_at: parseHoraLocalToUTC(values.measured_at, null),
        area: values.area, // CAMPO AREA
        puesto_trabajo: values.puesto_trabajo,
        temperatura_c:
          values.temperatura_c != null ? String(values.temperatura_c) : null,
        hr_percent:
          values.hr_percent != null ? String(values.hr_percent) : null,
        pm25_values: values.pm25_values
          ? parseNumberArray(values.pm25_values)
          : null,
        pm25_prom: values.pm25_prom != null ? Number(values.pm25_prom) : null,
        pm10_values: values.pm10_values
          ? parseNumberArray(values.pm10_values)
          : null,
        pm10_prom: values.pm10_prom != null ? Number(values.pm10_prom) : null,
        pts_values: values.pts_values
          ? parseNumberArray(values.pts_values)
          : null,
        pts_prom: values.pts_prom != null ? Number(values.pts_prom) : null,
        observaciones: values.observaciones || null,
        image_urls:
          values.image_urls && values.image_urls.trim() !== ''
            ? values.image_urls
                .split(',')
                .map((s) => s.trim())
                .filter(Boolean)
            : null,
        location: values.location || null
      };
      const { error } = await supabase
        .from(PARTICULAS_TABLE)
        .insert(payload);
      if (error) throw error;
      message.success('Registro agregado.');
      setIsFormModalVisible(false);
    } catch (err) {
      console.error('Error add:', err);
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
      const updateData = {
        proyecto_id: projectId || selectedRegistro.proyecto_id || null,
        monitoreo_id: monitoreoId || selectedRegistro.monitoreo_id || null,
        measured_at: parseHoraLocalToUTC(
          values.measured_at,
          selectedRegistro.measured_at
        ),
        area: values.area, // CAMPO AREA
        puesto_trabajo: values.puesto_trabajo,
        temperatura_c:
          values.temperatura_c != null ? String(values.temperatura_c) : null,
        hr_percent:
          values.hr_percent != null ? String(values.hr_percent) : null,
        pm25_values: values.pm25_values
          ? parseNumberArray(values.pm25_values)
          : null,
        pm25_prom: values.pm25_prom != null ? Number(values.pm25_prom) : null,
        pm10_values: values.pm10_values
          ? parseNumberArray(values.pm10_values)
          : null,
        pm10_prom: values.pm10_prom != null ? Number(values.pm10_prom) : null,
        pts_values: values.pts_values
          ? parseNumberArray(values.pts_values)
          : null,
        pts_prom: values.pts_prom != null ? Number(values.pts_prom) : null,
        observaciones: values.observaciones || null,
        image_urls:
          values.image_urls && values.image_urls.trim() !== ''
            ? values.image_urls
                .split(',')
                .map((s) => s.trim())
                .filter(Boolean)
            : null,
        location: values.location || null
      };
      const { error } = await supabase
        .from(PARTICULAS_TABLE)
        .update(updateData)
        .eq('id', selectedRegistro.id);
      if (error) throw error;
      message.success('Registro actualizado.');
      setIsFormModalVisible(false);
    } catch (err) {
      console.error('Error edit:', err);
      message.error('No se pudo actualizar.');
    } finally {
      setSaving(false);
    }
  };

  /* ================ EXPORTAR A EXCEL ================ */
  const exportToExcel = () => {
    try {
      const wsData = [];
      const titleStyle = {
        font: { bold: true },
        alignment: { vertical: 'center', horizontal: 'left' }
      };
      const headerStyle = {
        font: { bold: true },
        alignment: {
          vertical: 'center',
          horizontal: 'center',
          wrapText: true
        },
        fill: { fgColor: { rgb: 'D9E1F2' } },
        border: {
          top: { style: 'thin', color: { rgb: '000000' } },
          bottom: { style: 'thin', color: { rgb: '000000' } },
          left: { style: 'thin', color: { rgb: '000000' } },
          right: { style: 'thin', color: { rgb: '000000' } }
        }
      };
      const cellStyle = {
        alignment: {
          vertical: 'center',
          horizontal: 'left',
          wrapText: true
        },
        border: {
          top: { style: 'thin', color: { rgb: '000000' } },
          bottom: { style: 'thin', color: { rgb: '000000' } },
          left: { style: 'thin', color: { rgb: '000000' } },
          right: { style: 'thin', color: { rgb: '000000' } }
        }
      };

      const empresa = proyectoInfo?.nombre || '';
      const firstReg = registros && registros.length ? registros[0] : null;
      const fechaInicio = firstReg?.measured_at
        ? dayjs(firstReg.measured_at).utc().format('DD/MM/YYYY')
        : proyectoInfo?.measured_at
        ? dayjs(proyectoInfo.measured_at).utc().format('DD/MM/YYYY')
        : '';
      const fechaFin = '';

      wsData.push([
        {
          v: 'PLANILLA DE MEDICIÓN DE PARTÍCULAS SUSPENDIDAS',
          s: {
            font: { bold: true, sz: 14 },
            alignment: { vertical: 'center', horizontal: 'center' }
          }
        }
      ]);
      wsData.push([
        { v: 'INSTALACIÓN:', s: titleStyle },
        { v: empresa, s: cellStyle },
        '',
        { v: 'FECHA DE INICIO DEL MONITOREO:', s: titleStyle },
        { v: fechaInicio, s: cellStyle }
      ]);
      wsData.push([
        { v: 'FECHA DE FINALIZACIÓN DEL MONITOREO:', s: titleStyle },
        { v: fechaFin, s: cellStyle },
        '',
        { v: 'TIPO DE MONITOREO:', s: titleStyle },
        {
          v: monitoreoInfo?.tipo_monitoreo || 'PARTÍCULAS',
          s: cellStyle
        }
      ]);
      wsData.push(['', '', '', '', '']);

      // === ENCABEZADOS DE COLUMNA ===
      wsData.push([
        { v: 'N°', s: headerStyle },
        { v: 'Área', s: headerStyle },
        { v: 'Puesto de Trabajo Evaluado', s: headerStyle },
        { v: 'Fecha', s: headerStyle },
        { v: 'Hora de Medición', s: headerStyle },
        { v: 'Temperatura °C', s: headerStyle },
        { v: 'H.R.%', s: headerStyle },
        { v: 'Resultados  µg/m³', s: headerStyle },
        '',
        '',
        { v: 'Límite Permisible  µg/m³', s: headerStyle },
        '',
        { v: 'Cumplimiento con la Norma', s: headerStyle },
        '',
        { v: 'COORDENADAS UTM', s: headerStyle },
        { v: 'OBSERVACIÓN', s: headerStyle },
        { v: 'IMAGEN', s: headerStyle }
      ]);

      wsData.push([
        { v: '', s: headerStyle },
        { v: '', s: headerStyle },
        { v: '', s: headerStyle },
        { v: '', s: headerStyle },
        { v: '', s: headerStyle },
        { v: '', s: headerStyle },
        { v: '', s: headerStyle },
        { v: 'PM 10', s: headerStyle },
        { v: 'PM 2.5', s: headerStyle },
        { v: 'PTS', s: headerStyle },
        { v: 'PM 10', s: headerStyle },
        { v: 'PM 2.5', s: headerStyle },
        { v: 'PM 10', s: headerStyle },
        { v: 'PM 2.5', s: headerStyle },
        { v: '', s: headerStyle }, // Sub-header vacío para Coordenadas
        { v: '', s: headerStyle }, // Sub-header vacío para Observación
        { v: '', s: headerStyle } // Sub-header vacío para Imagen
      ]);

      registros.forEach((r, idx) => {
        const pm10 = r.pm10_prom != null ? Number(r.pm10_prom) : null;
        const pm25 = r.pm25_prom != null ? Number(r.pm25_prom) : null;
        const cumplePm10 = pm10 != null ? (pm10 <= LIMITE_PM10 ? 'SI' : 'NO') : '';
        const cumplePm25 = pm25 != null ? (pm25 <= LIMITE_PM25 ? 'SI' : 'NO') : '';

        // Texto de coordenadas
        const ubicacionTexto = formatLocationText(r.location);

        // Primera imagen (si existe)
        const imgs = getImagesArray(r);
        const firstImg = imgs.length ? imgs[0] : '';

        wsData.push([
          { v: idx + 1, s: cellStyle },
          { v: r.area || '', s: cellStyle },
          { v: r.puesto_trabajo || '', s: cellStyle },
          {
            v: r.measured_at
              ? dayjs(r.measured_at).utc().format('DD/MM/YYYY')
              : '',
            s: cellStyle
          },
          {
            v: r.measured_at
              ? dayjs(r.measured_at).utc().format('HH:mm')
              : '',
            s: cellStyle
          },
          { v: r.temperatura_c ?? '', s: cellStyle },
          { v: r.hr_percent ?? '', s: cellStyle },
          {
            v: pm10 != null ? Number(pm10).toFixed(2) : '',
            s: cellStyle
          },
          {
            v: pm25 != null ? Number(pm25).toFixed(2) : '',
            s: cellStyle
          },
          {
            v: r.pts_prom != null ? Number(r.pts_prom).toFixed(2) : '',
            s: cellStyle
          },
          { v: '10(I)', s: cellStyle },
          { v: '3(R)', s: cellStyle },
          { v: cumplePm10, s: cellStyle },
          { v: cumplePm25, s: cellStyle },
          { v: ubicacionTexto, s: cellStyle },
          { v: r.observaciones || '', s: cellStyle },
          { v: firstImg, s: cellStyle }
        ]);
      });

      const ws = XLSX.utils.aoa_to_sheet(wsData);

      // MERGES (ajustados para nuevas columnas)
      ws['!merges'] = [
        { s: { r: 0, c: 0 }, e: { r: 0, c: 16 } }, // Título (hasta imagen)
        { s: { r: 4, c: 7 }, e: { r: 4, c: 9 } }, // Resultados
        { s: { r: 4, c: 10 }, e: { r: 4, c: 11 } }, // Límite
        { s: { r: 4, c: 12 }, e: { r: 4, c: 13 } }, // Cumplimiento

        // Vertical merges
        { s: { r: 4, c: 0 }, e: { r: 5, c: 0 } }, // N°
        { s: { r: 4, c: 1 }, e: { r: 5, c: 1 } }, // Área
        { s: { r: 4, c: 2 }, e: { r: 5, c: 2 } }, // Puesto
        { s: { r: 4, c: 3 }, e: { r: 5, c: 3 } }, // Fecha
        { s: { r: 4, c: 4 }, e: { r: 5, c: 4 } }, // Hora
        { s: { r: 4, c: 5 }, e: { r: 5, c: 5 } }, // Temp
        { s: { r: 4, c: 6 }, e: { r: 5, c: 6 } }, // HR
        { s: { r: 4, c: 14 }, e: { r: 5, c: 14 } }, // Coordenadas
        { s: { r: 4, c: 15 }, e: { r: 5, c: 15 } }, // Observación
        { s: { r: 4, c: 16 }, e: { r: 5, c: 16 } } // Imagen
      ];

      ws['!cols'] = [
        { wch: 4 },  // N
        { wch: 20 }, // Area
        { wch: 28 }, // Puesto
        { wch: 12 }, // Fecha
        { wch: 10 }, // Hora
        { wch: 12 }, // Temp
        { wch: 10 }, // HR
        { wch: 10 }, // PM10
        { wch: 10 }, // PM2.5
        { wch: 10 }, // PTS
        { wch: 10 }, // Limite
        { wch: 10 },
        { wch: 17 }, // Cumple
        { wch: 17 },
        { wch: 30 }, // Coordenadas
        { wch: 30 }, // Observación
        { wch: 40 }  // Imagen (URL)
      ];

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Partículas');
      XLSX.writeFile(wb, 'reporte_particulas.xlsx');
    } catch (err) {
      console.error(err);
      message.error('No se pudo exportar.');
    }
  };

  /* ================ FILTRO + PAGINACIÓN ================ */
  const filteredRegistros = useMemo(() => {
    if (!searchText) return registros;
    const s = searchText.toLowerCase();
    return registros.filter(
      (r) =>
        (r.puesto_trabajo &&
          r.puesto_trabajo.toLowerCase().includes(s)) ||
        (r.area && r.area.toLowerCase().includes(s)) ||
        (r.observaciones &&
          r.observaciones.toLowerCase().includes(s)) ||
        (r.location &&
          JSON.stringify(r.location).toLowerCase().includes(s))
    );
  }, [searchText, registros]);

  const totalFiltered = filteredRegistros.length;
  const paginatedRegistros = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredRegistros.slice(start, start + pageSize);
  }, [filteredRegistros, currentPage, pageSize]);

  /* ================ COLUMNAS TABLA ================ */
  const columns = [
    {
      title: 'N°',
      key: 'numero',
      width: 40,
      fixed: 'left',
      render: (_, __, i) => (currentPage - 1) * pageSize + i + 1
    },
    {
      title: 'Fecha',
      dataIndex: 'measured_at',
      key: 'measured_date',
      sorter: (a, b) =>
        dayjs(a.measured_at).unix() - dayjs(b.measured_at).unix(),
      defaultSortOrder: 'descend',
      width: 120,
      render: (v) => formatFechaUTC(v)
    },
    {
      title: 'Hora de Medición',
      dataIndex: 'measured_at',
      key: 'measured_at',
      width: 140,
      sorter: (a, b) =>
        dayjs(a.measured_at).unix() - dayjs(b.measured_at).unix(),
      render: (v) => formatHoraUTC(v)
    },
    { title: 'Área', dataIndex: 'area', width: 150, ellipsis: true },
    {
      title: 'Puesto de Trabajo Evaluado',
      dataIndex: 'puesto_trabajo',
      key: 'puesto_trabajo',
      width: 220
    },
    {
      title: 'Temperatura °C',
      dataIndex: 'temperatura_c',
      key: 'temperatura_c',
      width: 120
    },
    {
      title: 'H.R. %',
      dataIndex: 'hr_percent',
      key: 'hr_percent',
      width: 100
    },
    {
      title: 'Resultados  µg/m³',
      children: [
        {
          title: 'PM 10',
          dataIndex: 'pm10_prom',
          key: 'pm10_prom',
          width: 100,
          render: (v) => (v != null ? Number(v).toFixed(2) : '')
        },
        {
          title: 'PM 2.5',
          dataIndex: 'pm25_prom',
          key: 'pm25_prom',
          width: 100,
          render: (v) => (v != null ? Number(v).toFixed(2) : '')
        },
        {
          title: 'PTS',
          dataIndex: 'pts_prom',
          key: 'pts_prom',
          width: 100,
          render: (v) => (v != null ? Number(v).toFixed(2) : '')
        }
      ]
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
            icon={<EyeOutlined />}
            onClick={() => openImageViewer(list, 0)}
            size="small"
          >
            Ver imagen
          </Button>
        );
      }
    },
    {
      title: 'COORDENADAS UTM',
      dataIndex: 'location',
      key: 'location',
      width: 200,
      render: (v) => renderLocation(v)
    },
    {
      title: 'Observaciones',
      dataIndex: 'observaciones',
      key: 'observaciones',
      width: 200,
      ellipsis: true
    },
    {
      title: 'Registrado por',
      dataIndex: 'created_by',
      key: 'created_by',
      width: 190,
      fixed: 'right',
      render: (v) => usersById[v] || v
    },
    {
      title: 'Acciones',
      key: 'acciones',
      fixed: 'right',
      width: 110,
      render: (_, record) => (
        <Space size="small">
          <Tooltip title="Editar">
            <Button
              shape="circle"
              icon={<EditOutlined />}
              onClick={() => handleEdit(record)}
            />
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
      )
    }
  ];

  // JSX del componente...
  const firstRegistro = registros && registros.length ? registros[0] : null;
  const headerNombreEmpresa = proyectoInfo?.nombre || 'Cargando...';
  const headerFechaInicio = firstRegistro?.measured_at
    ? dayjs(firstRegistro.measured_at).utc().format('DD/MM/YYYY')
    : proyectoInfo?.created_at
    ? dayjs(proyectoInfo.created_at).utc().format('DD/MM/YYYY')
    : 'N/A';
  const headerFechaFin = '';
  const safeEquipos = Array.isArray(equiposInfo) ? equiposInfo : [];
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
        <Breadcrumb.Item>
          {monitoreoInfo?.tipo_monitoreo || 'Partículas'}
        </Breadcrumb.Item>
      </Breadcrumb>

      <Row justify="space-between" align="middle" style={{ marginBottom: 16 }}>
        <Col>
          <Title
            level={2}
            style={{ color: PRIMARY_BLUE, marginBottom: 0 }}
          >
            Monitoreo de Partículas
          </Title>
        </Col>
        <Col>
          <Space>
            <Button
              onClick={() =>
                navigate(`/proyectos/${projectId}/monitoreo`)
              }
            >
              <ArrowLeftOutlined /> Volver a Monitoreos
            </Button>
            <Button
              icon={<FileExcelOutlined />}
              onClick={exportToExcel}
            >
              Exportar a Excel
            </Button>
            <Button
              icon={<FilePdfOutlined />}
              onClick={handleOpenPdf}
              style={{
                backgroundColor: '#ff4d4f',
                color: 'white',
                borderColor: '#ff4d4f'
              }}
            >
              Reporte Fotos
            </Button>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={handleAdd}
            >
              Agregar
            </Button>
          </Space>
        </Col>
      </Row>

      <Row
        justify="space-between"
        align="middle"
        style={{ marginBottom: 16, gap: 15 }}
      >
        <Col flex="0 0 590px">
          <Input.Search
            allowClear
            placeholder="Buscar..."
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
        <Descriptions
          bordered
          size="small"
          column={2}
          style={{ marginBottom: 15 }}
        >
          <Descriptions.Item label="NOMBRE DE LA EMPRESA">
            {headerNombreEmpresa}
          </Descriptions.Item>
          <Descriptions.Item label="FECHA DE INICIO">
            {headerFechaInicio}
          </Descriptions.Item>
          <Descriptions.Item label="FECHA DE FINALIZACIÓN">
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
        <div style={{ overflowX: 'auto' }}>
          <Table
            className="tabla-general"
            columns={columns}
            dataSource={paginatedRegistros}
            rowKey="id"
            size="small"
            pagination={false}
            scroll={{ x: 1500 }}
          />
        </div>
      </Spin>

      <Row
        justify="space-between"
        align="middle"
        style={{ marginTop: 12 }}
      >
        <Col>
          {(() => {
            const mostradosHastaAqui = Math.min(
              currentPage * pageSize,
              totalFiltered
            );
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

      <Modal
        title={
          selectedRegistro
            ? 'Editar registro de partículas'
            : 'Agregar registro de partículas'
        }
        open={isFormModalVisible}
        onOk={handleFormOk}
        onCancel={handleFormCancel}
        confirmLoading={saving}
        width={760}
        destroyOnClose
        footer={[
          <Button key="back" onClick={() => setIsFormModalVisible(false)}>
            Cancelar
          </Button>,
          <Button
            key="submit"
            type="primary"
            loading={saving}
            onClick={() => form.submit()}
          >
            Guardar
          </Button>
        ]}
      >
        <Form
          form={form}
          layout="vertical"
          preserve={false}
          key={selectedRegistro ? `edit-${selectedRegistro.id}` : 'add'}
          onFinish={selectedRegistro ? handleEditOk : handleAddOk}
          initialValues={
            selectedRegistro
              ? {
                  measured_at: selectedRegistro.measured_at
                    ? dayjs(selectedRegistro.measured_at)
                        .utc()
                        .format('YYYY-MM-DD HH:mm')
                    : '',
                  area: selectedRegistro.area || '', // CAMPO AREA
                  puesto_trabajo: selectedRegistro.puesto_trabajo,
                  temperatura_c: selectedRegistro.temperatura_c
                    ? Number(selectedRegistro.temperatura_c)
                    : undefined,
                  hr_percent: selectedRegistro.hr_percent
                    ? Number(selectedRegistro.hr_percent)
                    : undefined,
                  pm25_values: Array.isArray(selectedRegistro.pm25_values)
                    ? selectedRegistro.pm25_values.join(', ')
                    : '',
                  pm25_prom: selectedRegistro.pm25_prom,
                  pm10_values: Array.isArray(selectedRegistro.pm10_values)
                    ? selectedRegistro.pm10_values.join(', ')
                    : '',
                  pm10_prom: selectedRegistro.pm10_prom,
                  pts_values: Array.isArray(selectedRegistro.pts_values)
                    ? selectedRegistro.pts_values.join(', ')
                    : '',
                  pts_prom: selectedRegistro.pts_prom,
                  observaciones: selectedRegistro.observaciones,
                  image_urls: Array.isArray(selectedRegistro.image_urls)
                    ? selectedRegistro.image_urls.join(', ')
                    : selectedRegistro.image_urls || '',
                  location: selectedRegistro.location || ''
                }
              : { measured_at: dayjs().utc().format('YYYY-MM-DD HH:mm') }
          }
        >
          <Form.Item
            name="measured_at"
            label="Hora / fecha de medición"
          >
            <Input placeholder="YYYY-MM-DD HH:mm o solo HH:mm" />
          </Form.Item>
          {/* CAMPO AREA */}
          <Form.Item
            name="area"
            label="Área"
            rules={[{ required: true, message: 'Campo obligatorio' }]}
          >
            <Input />
          </Form.Item>
          <Form.Item
            name="puesto_trabajo"
            label="Puesto de Trabajo Evaluado"
            rules={[{ required: true, message: 'Campo obligatorio' }]}
          >
            <Input />
          </Form.Item>
          <Form.Item
            name="temperatura_c"
            label="Temperatura °C"
            rules={[{ required: true, message: 'Campo obligatorio' }]}
          >
            <InputNumber
              min={-10}
              max={60}
              style={{ width: '100%' }}
            />
          </Form.Item>
          <Form.Item
            name="hr_percent"
            label="H.R. %"
            rules={[{ required: true, message: 'Campo obligatorio' }]}
          >
            <InputNumber min={0} max={100} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item
            label="Promedios (µg/m³)"
            style={{ marginBottom: 4 }}
          />
          <Row gutter={8}>
            <Col span={8}>
              <Form.Item
                name="pm10_prom"
                label="PM 10 (prom)"
                rules={[{ required: true, message: 'Campo obligatorio' }]}
              >
                <InputNumber
                  min={0}
                  step={0.01}
                  style={{ width: '100%' }}
                />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item
                name="pm25_prom"
                label="PM 2.5 (prom)"
                rules={[{ required: true, message: 'Campo obligatorio' }]}
              >
                <InputNumber
                  min={0}
                  step={0.01}
                  style={{ width: '100%' }}
                />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item
                name="pts_prom"
                label="PTS (prom)"
                rules={[{ required: true, message: 'Campo obligatorio' }]}
              >
                <InputNumber
                  min={0}
                  step={0.01}
                  style={{ width: '100%' }}
                />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item
            label="Valores originales (opcional) separados por coma"
            style={{ marginBottom: 4 }}
          />
          <Form.Item name="pm10_values" label="PM 10 values">
            <Input placeholder="Ej: 2, 3, 1" />
          </Form.Item>
          <Form.Item name="pm25_values" label="PM 2.5 values">
            <Input placeholder="Ej: 1, 2, 3" />
          </Form.Item>
          <Form.Item name="pts_values" label="PTS values">
            <Input placeholder="Ej: 4, 3, 2" />
          </Form.Item>
          <Form.Item name="observaciones" label="Observaciones">
            <Input.TextArea rows={3} />
          </Form.Item>
          <Form.Item
            name="image_urls"
            label="URLs de imágenes (coma separadas)"
          >
            <Input.TextArea
              rows={2}
              placeholder="https://... , https://..."
            />
          </Form.Item>
          <Form.Item
            name="location"
            label="Ubicación (texto o JSON)"
          >
            <Input placeholder={'Ej: {"easting":792865.73,"northing":8056735.27,"utm_zone":"19K"}'} />
          </Form.Item>
        </Form>
      </Modal>

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
                      (prev) =>
                        (prev - 1 + imageViewerList.length) %
                        imageViewerList.length
                    )
                  }
                >
                  Anterior
                </Button>,
                <Button
                  key="next"
                  type="primary"
                  onClick={() =>
                    setImageViewerIndex(
                      (prev) => (prev + 1) % imageViewerList.length
                    )
                  }
                >
                  Siguiente
                </Button>
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
              alt="partículas"
              style={{
                maxWidth: '100%',
                maxHeight: '60vh',
                objectFit: 'contain'
              }}
            />
            <div style={{ marginTop: 8 }}>
              {imageViewerIndex + 1} / {imageViewerList.length}
            </div>
          </div>
        ) : (
          <Text type="secondary">Sin imagen.</Text>
        )}
      </Modal>

      {/* === MODAL DE PDF (CON SELECCIÓN DE REGISTROS) === */}
      <Modal
        title={
          pdfStep === 'selection'
            ? 'Seleccionar Imágenes'
            : 'Vista Previa PDF'
        }
        open={isPdfModalVisible}
        onCancel={() => setIsPdfModalVisible(false)}
        width={1000}
        style={{ top: 20 }}
        footer={
          pdfStep === 'selection' ? (
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                width: '100%',
                alignItems: 'center'
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8
                }}
              >
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
          )
        }
      >
        <div
          style={{
            height: '75vh',
            overflowY: 'auto',
            overflowX: 'hidden'
          }}
        >
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
                <Button size="small" onClick={handleSelectAllRecords}>
                  Seleccionar Todos
                </Button>
                <Button size="small" onClick={handleDeselectAllRecords}>
                  Deseleccionar Todos
                </Button>
              </div>
              <div
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: '10px',
                  justifyContent: 'center'
                }}
              >
                {registros
                  .filter((r) => getImagesArray(r).length > 0)
                  .map((r) => {
                    const imgs = getImagesArray(r);
                    const currentIdx = tempSelections[r.id] || 0;
                    const isSelected = recordSelections[r.id] === true;
                    return (
                      <div
                        key={r.id}
                        style={{
                          width: '23%',
                          border: isSelected
                            ? '1px solid #ddd'
                            : '1px dashed #999',
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
                          onChange={() =>
                            handleRecordSelectionToggle(r.id)
                          }
                          style={{
                            position: 'absolute',
                            top: 5,
                            right: 5,
                            zIndex: 20
                          }}
                        />
                        <Text strong style={{ fontSize: 12 }}>
                          {monitoreoInfo?.tipo_monitoreo || 'Partículas'}
                        </Text>
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
                              onClick={() =>
                                handlePrevImage(r.id, imgs.length)
                              }
                            />
                          )}
                          <img
                            src={imgs[currentIdx]}
                            style={{
                              maxWidth: '100%',
                              maxHeight: '100%',
                              objectFit: 'contain'
                            }}
                          />
                          {imgs.length > 1 && (
                            <Button
                              shape="circle"
                              icon={<RightOutlined />}
                              size="small"
                              style={{ position: 'absolute', right: 5 }}
                              onClick={() =>
                                handleNextImage(r.id, imgs.length)
                              }
                            />
                          )}
                          {imgs.length > 1 && (
                            <span
                              style={{
                                position: 'absolute',
                                bottom: 2,
                                right: 5,
                                fontSize: 10,
                                background:
                                  'rgba(255,255,255,0.7)'
                              }}
                            >
                              {currentIdx + 1}/{imgs.length}
                            </span>
                          )}
                        </div>
                        <Text
                          style={{ fontSize: 11, marginTop: 5 }}
                        >
                          {r.puesto_trabajo}
                        </Text>
                      </div>
                    );
                  })}
              </div>
            </>
          )}
          {pdfStep === 'view' && (
            <PDFViewer
              width="100%"
              height="100%"
              showToolbar={true}
            >
              <ReporteFotografico
                data={pdfData}
                empresa={proyectoInfo?.descripcion || 'SIN DESCRIPCIÓN'}
                layout={pdfLayout}
                tituloMonitoreo={
                  monitoreoInfo?.tipo_monitoreo || 'Partículas'
                }
                descripcionProyecto={''}
              />
            </PDFViewer>
          )}
        </div>
      </Modal>
    </>
  );
};

export default ParticulasPage;