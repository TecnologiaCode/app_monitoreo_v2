// src/pages/GasesPage.jsx
import React, { useEffect, useMemo, useState } from 'react';
import {
  Table,
  Button,
  Form,
  Input,
  Modal,
  Typography,
  Space,
  Select,
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
const { Option } = Select;
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
import { FilePdfOutlined } from '@ant-design/icons'; // Icono para el botón
import { PDFViewer } from '@react-pdf/renderer'; // El visor
import { ReporteFotografico } from '../components/ReporteFotografico'; // Tu nuevo componente
import { LeftOutlined, RightOutlined, SaveOutlined } from '@ant-design/icons';



dayjs.extend(utc);
dayjs.locale('es');

const { Title, Text } = Typography;
const PRIMARY_BLUE = '#2a8bb6';

/* ========================= HELPERS FECHA/HORA ========================= */
// Formatea HORA mostrando la hora local del navegador a partir de un timestamp UTC
const formatHoraUTC = (v) => {
  if (!v) return '';
  try {
    return dayjs(v).utc().utc().format('HH:mm'); // UTC -> Local HH:mm
  } catch {
    return String(v);
  }
};

// Formatea FECHA mostrando la fecha local del navegador a partir de un timestamp UTC
const formatFechaUTC = (v) => {
  if (!v) return '';
  try {
    return dayjs(v).utc().local().format('DD/MM/YYYY'); // UTC -> Local DD/MM/YYYY
  } catch {
    return String(v);
  }
};

/* ========================= HELPERS GENERALES ========================= */

// Muestra location en formato legible (UTM / lat-lng / texto / JSON)
const formatUTM = (loc) => {
  if (!loc) return '';
  if (typeof loc === 'string') {
    const s = loc.trim();
    if (!s) return '';
    try {
      const parsed = JSON.parse(s); // si es JSON en string
      return formatUTM(parsed);
    } catch {
      return s; // texto plano
    }
  }
  if (typeof loc === 'object') {
    const e = loc.easting ?? loc.E ?? loc.x ?? loc.X ?? loc.Este ?? loc.e ?? '';
    const n = loc.northing ?? loc.N ?? loc.y ?? loc.Y ?? loc.Norte ?? loc.n ?? '';
    const z = loc.utm_zone ?? loc.zone ?? loc.zona ?? loc.utm ?? '';
    if (e || n || z) {
      const eStr = e !== '' ? String(e) : '';
      const nStr = n !== '' ? String(n) : '';
      const par = [eStr && `${eStr}E`, nStr && `${nStr}N`].filter(Boolean).join('; ');
      return [par, z && `Z${z}`].filter(Boolean).join(' ').trim();
    }
    const lat = loc.lat ?? loc.latitude;
    const lng = loc.lng ?? loc.longitude;
    if (lat != null || lng != null) {
      const latStr = lat != null ? String(lat) : '';
      const lngStr = lng != null ? String(lng) : '';
      return (latStr && lngStr) ? `${latStr}, ${lngStr}` : (latStr || lngStr);
    }
    return JSON.stringify(loc);
  }
  return String(loc);
};

// convierte "20,99" -> 20.99; deja strings no numéricas tal cual; null/undef => null
const toNumberOrString = (v) => {
  if (v === null || v === undefined || v === '') return null;
  if (typeof v === 'number') return v;
  const s = String(v).replace(',', '.');
  const n = Number(s);
  return Number.isNaN(n) ? String(v) : n;
};

// renderer seguro: muestra 2 decimales si es número, si es string la muestra, si null -> vacío
const renderVal = (v) => {
  if (v === null || v === undefined || v === '') return '';
  if (typeof v === 'number') return v.toFixed(2);
  return String(v);
};

/* ========================= EXPORTAR EXCEL (xlsx-js-style) ========================= */
/**
 * Genera un Excel con cabeceras agrupadas por pares de columnas, tomando:
 * - Área (r.area)
 * - Puesto de trabajo (r.puesto_trabajo)
 * - Hora local derivada de measured_at (formatHoraUTC)
 * - Pares (O2, H2S, CO, LEL, HCHO, T-COV, CO2, HR, TA)
 * - Location formateado (formatUTM)
 */
const exportToExcel = (registros = [], empresaNombre = 'Empresa') => {
  try {
    const wsData = [];

    const borde = {
      top: { style: 'thin', color: { rgb: '000000' } },
      bottom: { style: 'thin', color: { rgb: '000000' } },
      left: { style: 'thin', color: { rgb: '000000' } },
      right: { style: 'thin', color: { rgb: '000000' } },
    };
    const labelRoja = {
      font: { bold: true, color: { rgb: 'FF0000' } },
      alignment: { vertical: 'center', horizontal: 'left', wrapText: true },
      border: borde,
    };
    const valor = {
      alignment: { vertical: 'center', horizontal: 'left', wrapText: true },
      border: borde,
    };
    const headerTabla = {
      font: { bold: true },
      alignment: { vertical: 'center', horizontal: 'center', wrapText: true },
      fill: { fgColor: { rgb: 'FFFF00' } },
      border: borde,
    };
    const cell = {
      alignment: { vertical: 'center', horizontal: 'center', wrapText: true },
      border: borde,
    };

    // Encabezado simple
    wsData.push(['']);
    wsData.push([
      { v: 'NOMBRE DE LA EMPRESA:', s: labelRoja },
      { v: empresaNombre, s: valor },
      '', '', '', '', '', '', '', '', '', '', '', '', '', '',
    ]);
    wsData.push(['']);

    // Cabecera de tabla (dos filas: títulos agrupados + subcolumnas)
    const idxHeaderTop = wsData.length;
    wsData.push([
      { v: 'N°', s: headerTabla },
      { v: 'AREA DE TRABAJO', s: headerTabla },
      { v: 'PUESTO DE TRABAJO', s: headerTabla },
      { v: 'HORA', s: headerTabla },
      { v: 'O2 (%Vol)', s: headerTabla }, '',
      { v: 'H2S (ppm)', s: headerTabla }, '',
      { v: 'CO (ppm)', s: headerTabla }, '',
      { v: 'LEL %', s: headerTabla }, '',
      { v: 'HCHO (mg/m3)', s: headerTabla }, '',
      { v: 'T-COV (mg/m3)', s: headerTabla }, '',
      { v: 'CO2 (ppm)', s: headerTabla }, '',
      { v: 'H.R. %', s: headerTabla }, '',
      { v: 'TA °C', s: headerTabla }, '',
      { v: 'COORDENADAS UTM', s: headerTabla },
      { v: 'CATEGORIA', s: headerTabla },
      { v: 'IMAGEN', s: headerTabla },
      { v: 'OBSERVACION', s: headerTabla },
    ]);
    wsData.push([
      { v: '', s: headerTabla }, { v: '', s: headerTabla }, { v: '', s: headerTabla },
      { v: '', s: headerTabla },
      { v: 'Col 1', s: headerTabla }, { v: 'Col 2', s: headerTabla },
      { v: 'Col 1', s: headerTabla }, { v: 'Col 2', s: headerTabla },
      { v: 'Col 1', s: headerTabla }, { v: 'Col 2', s: headerTabla },
      { v: 'Col 1', s: headerTabla }, { v: 'Col 2', s: headerTabla },
      { v: 'Col 1', s: headerTabla }, { v: 'Col 2', s: headerTabla },
      { v: 'Col 1', s: headerTabla }, { v: 'Col 2', s: headerTabla },
      { v: 'Col 1', s: headerTabla }, { v: 'Col 2', s: headerTabla },
      { v: 'Col 1', s: headerTabla }, { v: 'Col 2', s: headerTabla },
      { v: '', s: headerTabla }, { v: '', s: headerTabla }, { v: '', s: headerTabla }, { v: '', s: headerTabla },
    ]);

    const rows = registros.length ? registros : [];

    rows.forEach((r, i) => {
      const val = (x) => renderVal(x);
      const locStr = formatUTM(r.location);

      wsData.push([
        { v: i + 1, s: cell },
        { v: r.area || '', s: cell },                               // Área (col nueva)
        { v: r.puesto_trabajo || '', s: cell },                     // Puesto
        { v: formatHoraUTC(r.measured_at), s: cell },               // Hora local desde measured_at
        { v: val(r.o2_1), s: cell }, { v: val(r.o2_2), s: cell },
        { v: val(r.h2s_1), s: cell }, { v: val(r.h2s_2), s: cell },
        { v: val(r.co_1), s: cell },  { v: val(r.co_2), s: cell },
        { v: val(r.lel_1), s: cell }, { v: val(r.lel_2), s: cell },
        { v: val(r.hcho_1), s: cell },{ v: val(r.hcho_2), s: cell },
        { v: val(r.tcov_1), s: cell },{ v: val(r.tcov_2), s: cell },
        { v: val(r.co2_1), s: cell }, { v: val(r.co2_2), s: cell },
        { v: val(r.hr_1), s: cell },  { v: val(r.hr_2), s: cell },
        { v: val(r.ta_1), s: cell },  { v: val(r.ta_2), s: cell },
        { v: locStr || '', s: cell },
        { v: r.categoria != null ? String(r.categoria) : '', s: cell },
        { v: Array.isArray(r.image_urls) ? r.image_urls.join(', ') : (r.image_urls || ''), s: cell },
        { v: r.observaciones || '', s: cell },
      ]);
    });

    const ws = XLSX.utils.aoa_to_sheet(wsData);

    // Merges de cabeceras agrupadas
    ws['!merges'] = [
      { s: { r: idxHeaderTop, c: 0 }, e: { r: idxHeaderTop + 1, c: 0 } }, // N°
      { s: { r: idxHeaderTop, c: 1 }, e: { r: idxHeaderTop + 1, c: 1 } }, // Área
      { s: { r: idxHeaderTop, c: 2 }, e: { r: idxHeaderTop + 1, c: 2 } }, // Puesto
      { s: { r: idxHeaderTop, c: 3 }, e: { r: idxHeaderTop + 1, c: 3 } }, // Hora
      { s: { r: idxHeaderTop, c: 4 }, e: { r: idxHeaderTop, c: 5 } },     // O2
      { s: { r: idxHeaderTop, c: 6 }, e: { r: idxHeaderTop, c: 7 } },     // H2S
      { s: { r: idxHeaderTop, c: 8 }, e: { r: idxHeaderTop, c: 9 } },     // CO
      { s: { r: idxHeaderTop, c: 10 }, e: { r: idxHeaderTop, c: 11 } },   // LEL
      { s: { r: idxHeaderTop, c: 12 }, e: { r: idxHeaderTop, c: 13 } },   // HCHO
      { s: { r: idxHeaderTop, c: 14 }, e: { r: idxHeaderTop, c: 15 } },   // T-COV
      { s: { r: idxHeaderTop, c: 16 }, e: { r: idxHeaderTop, c: 17 } },   // CO2
      { s: { r: idxHeaderTop, c: 18 }, e: { r: idxHeaderTop, c: 19 } },   // HR
      { s: { r: idxHeaderTop, c: 20 }, e: { r: idxHeaderTop, c: 21 } },   // TA
      { s: { r: idxHeaderTop, c: 22 }, e: { r: idxHeaderTop + 1, c: 22 } },// UTM
      { s: { r: idxHeaderTop, c: 23 }, e: { r: idxHeaderTop + 1, c: 23 } },// Categoria
      { s: { r: idxHeaderTop, c: 24 }, e: { r: idxHeaderTop + 1, c: 24 } },// Imagen
      { s: { r: idxHeaderTop, c: 25 }, e: { r: idxHeaderTop + 1, c: 25 } },// Observación
    ];

    // Ancho de columnas
    ws['!cols'] = [
      { wch: 4 },   // N°
      { wch: 22 },  // Área
      { wch: 24 },  // Puesto
      { wch: 8 },   // Hora
      { wch: 8 }, { wch: 8 },    // O2
      { wch: 8 }, { wch: 8 },    // H2S
      { wch: 8 }, { wch: 8 },    // CO
      { wch: 8 }, { wch: 8 },    // LEL
      { wch: 10 }, { wch: 10 },  // HCHO
      { wch: 10 }, { wch: 10 },  // T-COV
      { wch: 10 }, { wch: 10 },  // CO2
      { wch: 8 },  { wch: 8 },   // HR
      { wch: 8 },  { wch: 8 },   // TA
      { wch: 28 },               // UTM
      { wch: 10 },               // Categoria
      { wch: 28 },               // Imagen
      { wch: 28 },               // Observación
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Gases');
    XLSX.writeFile(wb, 'reporte_gases.xlsx');
    message.success('✅ Archivo Excel generado correctamente');
  } catch (err) {
    console.error('Error exportar gases:', err);
    message.error('No se pudo exportar el Excel.');
  }
};

/* ========================= COMPONENTE PRINCIPAL ========================= */
const GasesPage = () => {
  const { projectId, monitoreoId: mId, id } = useParams();
  const monitoreoId = mId || id;
  const navigate = useNavigate();
  const [form] = Form.useForm();

  const [registros, setRegistros] = useState([]);
  const [proyectoInfo, setProyectoInfo] = useState(null);
  const [monitoreoInfo, setMonitoreoInfo] = useState(null);
  const [usersById, setUsersById] = useState({});

  const [loadingHeader, setLoadingHeader] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isFormModalVisible, setIsFormModalVisible] = useState(false);
  const [selectedRegistro, setSelectedRegistro] = useState(null);

  const [searchText, setSearchText] = useState('');
  const [pageSize, setPageSize] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);

  const [imageViewerOpen, setImageViewerOpen] = useState(false);
  const [imageViewerList, setImageViewerList] = useState([]);
  const [imageViewerIndex, setImageViewerIndex] = useState(0);

  // Estados para el reporte de fotos
  const [isPdfModalVisible, setIsPdfModalVisible] = useState(false);
  const [pdfStep, setPdfStep] = useState('selection'); // 'selection' | 'view'
  const [pdfData, setPdfData] = useState([]);
  
  // Diccionario para controlar qué índice de imagen se muestra en el modal { registroId: indice }
  const [tempSelections, setTempSelections] = useState({});
  const [isSavingSelection, setIsSavingSelection] = useState(false);
  const [pdfLayout, setPdfLayout] = useState('2x4');

// Función para preparar los datos y abrir el modal
const handleOpenPdf = () => {
    // Filtramos solo registros con imágenes
    const registrosConFotos = registros.filter(r => {
       const imgs = getImagesArray(r); // Usaremos un helper abajo
       return imgs.length > 0;
    });

    if (registrosConFotos.length === 0) {
        message.warning("No hay registros con imágenes.");
        return;
    }

    // Preparamos el estado inicial de selección basado en lo guardado en BD
    const initialSelections = {};
    registrosConFotos.forEach(r => {
        // Si el índice guardado es mayor que la cantidad de fotos actuales, reset a 0
        const imgs = getImagesArray(r);
        const savedIndex = r.selected_image_index || 0;
        initialSelections[r.id] = savedIndex < imgs.length ? savedIndex : 0;
    });

    setTempSelections(initialSelections);
    setPdfStep('selection'); // Primero mostramos la selección
    setIsPdfModalVisible(true);
  };

  // Helper para obtener array de imagenes limpio
  const getImagesArray = (reg) => {
      if (Array.isArray(reg.image_urls)) return reg.image_urls;
      if (typeof reg.image_urls === 'string' && reg.image_urls.trim() !== '') {
          return reg.image_urls.split(',').map(s => s.trim());
      }
      return [];
  };

  const handlePrevImage = (regId, total) => {
      setTempSelections(prev => ({
          ...prev,
          [regId]: (prev[regId] - 1 + total) % total
      }));
  };

  const handleNextImage = (regId, total) => {
      setTempSelections(prev => ({
          ...prev,
          [regId]: (prev[regId] + 1) % total
      }));
  };

// Guardar en Supabase y Generar PDF
  const handleSaveAndGenerate = async () => {
      setIsSavingSelection(true);
      const loadingMsg = message.loading("Procesando imágenes...", 0);
      
      try {
          const finalPdfData = [];
          const registrosConFotos = registros.filter(r => getImagesArray(r).length > 0);
          
          // Usamos un bucle for...of para procesar una por una y ver errores
          for (const r of registrosConFotos) {
              const imgs = getImagesArray(r);
              // Obtenemos el índice seleccionado (si no hay selección, es 0)
              const selectedIdx = tempSelections[r.id] !== undefined ? tempSelections[r.id] : 0;
              
              // Validación de seguridad: si el índice es mayor a las fotos que existen, usa 0
              const finalIdx = selectedIdx < imgs.length ? selectedIdx : 0;
              const originalUrl = imgs[finalIdx];

              // 1. Comprimimos
              const compressedUrl = await compressImage(originalUrl);

              finalPdfData.push({
                  imageUrl: compressedUrl,
                  area: r.area,
                  puesto: r.puesto_trabajo,
              });

              // 2. Guardamos en BD
              // Quitamos la condición 'if' temporalmente para forzar el guardado y ver si funciona
              console.log(`Intentando actualizar ID: ${r.id} con índice: ${finalIdx}`);
              
              const { error, data } = await supabase
                  .from('gases')
                  .update({ selected_image_index: finalIdx })
                  .eq('id', r.id)
                  .select(); // .select() nos devuelve el dato actualizado para confirmar

              if (error) {
                  console.error("Error Supabase:", error.message);
                  message.error(`Error guardando registro ${r.puesto_trabajo}`);
              } else if (data && data.length === 0) {
                  // ESTO ES CLAVE: Si entra aquí, es problema de RLS (Permisos)
                  console.warn("Supabase devolvió 0 filas actualizadas. Revisa tus políticas RLS.");
              } else {
                  console.log("Guardado exitoso:", data);
              }
          }

          // 3. Refrescamos la tabla visualmente
          await fetchRegistros();

          setPdfData(finalPdfData);
          setPdfStep('view'); 
          message.success("Proceso completado");

      } catch (error) {
          console.error("Error general:", error);
          message.error("Ocurrió un error inesperado");
      } finally {
          loadingMsg();
          setIsSavingSelection(false);
      }
  };

  // Helper para comprimir imagen antes del PDF
const compressImage = (url) => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "Anonymous"; // Vital para que funcione con tu .htaccess
    img.src = url + "?t=" + new Date().getTime(); // Evitar caché

    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');

      // Definimos un ancho máximo razonable para un PDF (ej. 800px es suficiente para calidad alta en A4)
      const MAX_WIDTH = 800; 
      let width = img.width;
      let height = img.height;

      // Redimensionar manteniendo aspecto
      if (width > MAX_WIDTH) {
        height *= MAX_WIDTH / width;
        width = MAX_WIDTH;
      }

      canvas.width = width;
      canvas.height = height;

      // Dibujar imagen redimensionada
      ctx.drawImage(img, 0, 0, width, height);

      // Convertir a JPEG con calidad 0.6 (60%) -> Esto reduce MUCHO el peso
      const dataUrl = canvas.toDataURL('image/jpeg', 0.6);
      resolve(dataUrl);
    };

    img.onerror = (err) => {
      console.error("Error comprimiendo imagen", url, err);
      // Si falla la compresión, devolvemos la URL original como fallback
      resolve(url);
    };
  });
};

  /* ===== Header ===== */
  useEffect(() => {
    (async () => {
      try {
        if (monitoreoId) {
          const { data: mon, error: em } = await supabase
            .from('monitoreos')
            .select('id, tipo_monitoreo, proyecto_id')
            .eq('id', monitoreoId).single();
          if (em) throw em;
          setMonitoreoInfo(mon);
          const { data: proy, error: ep } = await supabase
            .from('proyectos').select('id, nombre, created_at').eq('id', mon.proyecto_id).single();
          if (ep) throw ep;
          setProyectoInfo(proy);
        } else if (projectId) {
          const { data: proy, error: ep } = await supabase
            .from('proyectos').select('id, nombre, created_at').eq('id', projectId).single();
          if (ep) throw ep;
          setProyectoInfo(proy);
        }
      } catch (e) {
        console.error('Header error:', e);
      } finally {
        setLoadingHeader(false);
      }
    })();
  }, [projectId, monitoreoId]);

  /* ===== Fetch Registros con NORMALIZACIÓN ===== */
  const fetchRegistros = async () => {
    setLoading(true);
    try {
      let q = supabase.from('gases').select('*').order('created_at', { ascending: true });
      if (monitoreoId) q = q.eq('monitoreo_id', monitoreoId);
      else if (projectId) q = q.eq('proyecto_id', projectId);

      const { data, error } = await q;
      if (error) throw error;

      // Helper para mapear pares _1/_2 o arrays *_values según tu esquema
      const mapPar = (obj, base, arrAlt) => {
        let v1 = obj[`${base}_1`];
        let v2 = obj[`${base}_2`];
        if ((v1 === undefined || v2 === undefined) && obj[arrAlt]) {
          const arr = Array.isArray(obj[arrAlt]) ? obj[arrAlt] : [];
          v1 = v1 === undefined ? arr[0] : v1;
          v2 = v2 === undefined ? arr[1] : v2;
        }
        return [toNumberOrString(v1), toNumberOrString(v2)];
      };

      const mapped = (data || []).map((r) => {
        const [o2_1, o2_2] = mapPar(r, 'o2', 'o2_values');
        const [h2s_1, h2s_2] = mapPar(r, 'h2s', 'h2s_values');
        const [co_1, co_2] = mapPar(r, 'co', 'co_values');
        const [lel_1, lel_2] = mapPar(r, 'lel', 'lel_values');
        const [hcho_1, hcho_2] = mapPar(r, 'hcho', 'hcho_values');
        const [tcov_1, tcov_2] = mapPar(r, 'tcov', 'tcov_values');
        const [co2_1, co2_2] = mapPar(r, 'co2', 'co2_values');
        const [hr_1, hr_2] = mapPar(r, 'hr', 'hr_values');
        const [ta_1, ta_2] = mapPar(r, 'ta', 'ta_values');

        let imageUrls = [];
        if (Array.isArray(r.image_urls)) imageUrls = r.image_urls;
        else if (typeof r.image_urls === 'string' && r.image_urls.trim() !== '') {
          imageUrls = r.image_urls.split(',').map((s) => s.trim());
        }

        return {
          ...r,
          // Normalizados numéricos
          o2_1, o2_2,
          h2s_1, h2s_2,
          co_1, co_2,
          lel_1, lel_2,
          hcho_1, hcho_2,
          tcov_1, tcov_2,
          co2_1, co2_2,
          hr_1, hr_2,
          ta_1, ta_2,
          image_urls: imageUrls,
          formatted_location: formatUTM(r.location), // string listo para UI/Excel
        };
      });

      setRegistros(mapped);

      // cargar perfiles de created_by
      const createdByIds = Array.from(
        new Set(
          (mapped || [])
            .map((m) => m.created_by)
            .filter((v) => v && typeof v === 'string')
        )
      );
      if (createdByIds.length > 0) {
        const { data: profs } = await supabase
          .from('profiles')
          .select('id, username, nombre_completo, email, descripcion, rol, estado')
          .in('id', createdByIds);
        if (profs) {
          const dict = {};
          profs.forEach((u) => {
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
        }
      } else {
        setUsersById({});
      }

      setCurrentPage(1);
    } catch (e) {
      console.error(e);
      message.error('No se pudo cargar gases');
      setRegistros([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRegistros();
    const ch = supabase
      .channel('rt-gases')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'gases' }, fetchRegistros)
      .subscribe();
    return () => supabase.removeChannel(ch);
  }, [projectId, monitoreoId]);

  /* ===== CRUD ===== */
  const handleAdd = () => { setSelectedRegistro(null); setIsFormModalVisible(true); };
  const handleEdit = (record) => { setSelectedRegistro(record); setIsFormModalVisible(true); };

  const handleDelete = (record) => {
    Modal.confirm({
      title: '¿Eliminar registro?',
      icon: <ExclamationCircleOutlined />,
      content: `Se eliminará el registro "${record.puesto_trabajo}"`,
      okText: 'Eliminar',
      okType: 'danger',
      cancelText: 'Cancelar',
      onOk: async () => {
        try {
          const { error } = await supabase.from('gases').delete().eq('id', record.id);
          if (error) throw error;
          message.success('Eliminado');
        } catch (e) { message.error('No se pudo eliminar'); }
      }
    });
  };

  const [formInst] = [form];
  const handleFormOk = () => (selectedRegistro ? handleEditOk() : handleAddOk());
  const handleFormCancel = () => setIsFormModalVisible(false);

  // payload: guardamos 'location' (texto o JSON), y measured_at basado en hora local digitada
  const payloadFromValues = (values) => {
    const v1 = (base) => toNumberOrString(values[`${base}_1`]);
    const v2 = (base) => toNumberOrString(values[`${base}_2`]);
    const arr = (base) => [
      v1(base) === null ? null : v1(base),
      v2(base) === null ? null : v2(base),
    ];

    let measuredAtTimestamp = null;
    if (values.hora && /^[0-2]\d:[0-5]\d$/.test(values.hora)) {
      const [hours, minutes] = values.hora.split(':');
      // Base: si edito, uso misma fecha del registro; si no, hoy local
      const base = selectedRegistro?.measured_at ? dayjs(selectedRegistro.measured_at).utc().local() : dayjs();
      // Construimos datetime local y lo serializamos con offset local
      measuredAtTimestamp = base.hour(Number(hours)).minute(Number(minutes)).second(0).millisecond(0)
        .format('YYYY-MM-DD[T]HH:mm:ssZ');
    } else if (selectedRegistro && selectedRegistro.measured_at) {
      measuredAtTimestamp = selectedRegistro.measured_at;
    }

    return {
      proyecto_id: projectId || null,
      monitoreo_id: monitoreoId || null,
      area: values.area || null,                         // área (existe en tu tabla)
      puesto_trabajo: values.puesto_trabajo || null,
      measured_at: measuredAtTimestamp,

      o2_values: arr('o2'), o2_prom: null,
      h2s_values: arr('h2s'), h2s_prom: null,
      co_values: arr('co'), co_prom: null,
      lel_values: arr('lel'), lel_prom: null,
      hcho_values: arr('hcho'), hcho_prom: null,
      tcov_values: arr('tcov'), tcov_prom: null,
      co2_values: arr('co2'), co2_prom: null,
      hr_values: arr('hr'), hr_prom: null,
      ta_values: arr('ta'), ta_prom: null,

      location: values.location || null,                 // UTM/JSON/Texto

      categoria: values.categoria != null ? String(values.categoria) : null,
      observaciones: values.observaciones || null,
      image_urls: values.image_urls
        ? values.image_urls.split(',').map((s) => s.trim()).filter(Boolean)
        : null,
    };
  };

  const handleAddOk = async () => {
    setSaving(true);
    try {
      const values = await formInst.validateFields();
      const payload = payloadFromValues(values);
      const { error } = await supabase.from('gases').insert(payload);
      if (error) throw error;
      message.success('Registro agregado');
      setIsFormModalVisible(false);
    } catch (e) {
      console.error(e);
      message.error('No se pudo agregar');
    } finally { setSaving(false); }
  };

  const handleEditOk = async () => {
    if (!selectedRegistro) return;
    setSaving(true);
    try {
      const values = await formInst.validateFields();
      const payload = payloadFromValues(values);
      const { error } = await supabase.from('gases').update(payload).eq('id', selectedRegistro.id);
      if (error) throw error;
      message.success('Registro actualizado');
      setIsFormModalVisible(false);
    } catch (e) {
      console.error(e);
      message.error('No se pudo actualizar');
    } finally { setSaving(false); }
  };

  /* ===== Filtro + Paginación ===== */
  const filteredRegistros = useMemo(() => {
    if (!searchText) return registros;
    const s = searchText.toLowerCase();
    return registros.filter((r) => {
      const imgStr = Array.isArray(r.image_urls) ? r.image_urls.join(',') : (r.image_urls || '');
      const horaStr = (formatHoraUTC(r.measured_at) || '').toLowerCase(); // usar helper correcto
      const locStr = (r.formatted_location || '').toLowerCase();
      return (
        (r.area && r.area.toLowerCase().includes(s)) ||
        (r.puesto_trabajo && r.puesto_trabajo.toLowerCase().includes(s)) ||
        (horaStr && horaStr.includes(s)) ||
        (locStr && locStr.includes(s)) ||
        (r.categoria && String(r.categoria).toLowerCase().includes(s)) ||
        (r.observaciones && r.observaciones.toLowerCase().includes(s)) ||
        (imgStr && imgStr.toLowerCase().includes(s))
      );
    });
  }, [searchText, registros]);

  const totalFiltered = filteredRegistros.length;

  const paginatedRegistros = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredRegistros.slice(start, start + pageSize);
  }, [filteredRegistros, currentPage, pageSize]);

  /* ===== Visor de imágenes ===== */
  const openImageViewer = (imgs, idx = 0) => {
    if (!imgs || imgs.length === 0) return;
    setImageViewerList(imgs);
    setImageViewerIndex(idx);
    setImageViewerOpen(true);
  };

  /* ===== Columnas (anidadas) ===== */
  const columns = [
    {
      title: 'N°',
      key: 'numero',
      width: 60,
      fixed: 'left',
      render: (_, __, i) => (currentPage - 1) * pageSize + i + 1
    },

    // FECHA / HORA desde measured_at
    {
      title: 'FECHA',
      dataIndex: 'measured_at',
      key: 'measured_date',
      sorter: (a, b) => dayjs(a.measured_at).unix() - dayjs(b.measured_at).unix(),
      defaultSortOrder: 'descend',
      width: 120,
      render: (t) => formatFechaUTC(t),
    },
    {
      title: 'HORA',
      dataIndex: 'measured_at',
      key: 'measured_at',
      sorter: (a, b) => dayjs(a.measured_at).unix() - dayjs(b.measured_at).unix(),
      width: 110,
      render: (t) => formatHoraUTC(t) || <Text type="secondary">—</Text>
    },

    { title: 'AREA DE TRABAJO', dataIndex: 'area', key: 'area', width: 200 },
    { title: 'PUESTO DE TRABAJO', dataIndex: 'puesto_trabajo', key: 'puesto_trabajo', width: 200 },

    {
      title: 'O2 (%Vol)',
      children: [
        { title: 'Col 1', dataIndex: 'o2_1', key: 'o2_1', width: 90, render: renderVal },
        { title: 'Col 2', dataIndex: 'o2_2', key: 'o2_2', width: 90, render: renderVal },
      ],
    },
    {
      title: 'H2S (ppm)',
      children: [
        { title: 'Col 1', dataIndex: 'h2s_1', key: 'h2s_1', width: 90, render: renderVal },
        { title: 'Col 2', dataIndex: 'h2s_2', key: 'h2s_2', width: 90, render: renderVal },
      ],
    },
    {
      title: 'CO (ppm)',
      children: [
        { title: 'Col 1', dataIndex: 'co_1', key: 'co_1', width: 90, render: renderVal },
        { title: 'Col 2', dataIndex: 'co_2', key: 'co_2', width: 90, render: renderVal },
      ],
    },
    {
      title: 'LEL %',
      children: [
        { title: 'Col 1', dataIndex: 'lel_1', key: 'lel_1', width: 90, render: renderVal },
        { title: 'Col 2', dataIndex: 'lel_2', key: 'lel_2', width: 90, render: renderVal },
      ],
    },
    {
      title: 'HCHO (mg/m3)',
      children: [
        { title: 'Col 1', dataIndex: 'hcho_1', key: 'hcho_1', width: 100, render: renderVal },
        { title: 'Col 2', dataIndex: 'hcho_2', key: 'hcho_2', width: 100, render: renderVal },
      ],
    },
    {
      title: 'T-COV (mg/m3)',
      children: [
        { title: 'Col 1', dataIndex: 'tcov_1', key: 'tcov_1', width: 100, render: renderVal },
        { title: 'Col 2', dataIndex: 'tcov_2', key: 'tcov_2', width: 100, render: renderVal },
      ],
    },
    {
      title: 'CO2 (ppm)',
      children: [
        { title: 'Col 1', dataIndex: 'co2_1', key: 'co2_1', width: 100, render: renderVal },
        { title: 'Col 2', dataIndex: 'co2_2', key: 'co2_2', width: 100, render: renderVal },
      ],
    },
    {
      title: 'H.R. %',
      children: [
        { title: 'Col 1', dataIndex: 'hr_1', key: 'hr_1', width: 90, render: renderVal },
        { title: 'Col 2', dataIndex: 'hr_2', key: 'hr_2', width: 90, render: renderVal },
      ],
    },
    {
      title: 'TA °C',
      children: [
        { title: 'Col 1', dataIndex: 'ta_1', key: 'ta_1', width: 90, render: renderVal },
        { title: 'Col 2', dataIndex: 'ta_2', key: 'ta_2', width: 90, render: renderVal },
      ],
    },

    // Location formateado
    {
      title: 'COORDENADAS UTM',
      dataIndex: 'formatted_location',
      key: 'formatted_location',
      width: 240,
      render: (v) => (v && String(v).trim() !== '' ? v : <Text type="secondary">N/A</Text>),
    },

    { title: 'CATEGORIA', dataIndex: 'categoria', key: 'categoria', width: 90 },

    {
      title: 'IMAGEN',
      dataIndex: 'image_urls',
      key: 'image_urls',
      width: 160,
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
    { title: 'OBSERVACION', dataIndex: 'observaciones', key: 'observaciones', width: 260, ellipsis: true },

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
            <Button icon={<EditOutlined />} onClick={() => setSelectedRegistro(record) || setIsFormModalVisible(true)} />
          </Tooltip>
          <Tooltip title="Eliminar">
            <Button danger icon={<DeleteOutlined />} onClick={() => handleDelete(record)} />
          </Tooltip>
        </Space>
      ),
    },
  ];

  // Cabeceras Descriptions
  const first = registros[0];
  const empresa = proyectoInfo?.nombre || 'Empresa';
  const fechaInicio =
    first?.created_at ? dayjs(first.created_at).format('DD/MM/YYYY')
      : proyectoInfo?.created_at ? dayjs(proyectoInfo.created_at).format('DD/MM/YYYY')
        : 'N/A';

  return (
    <>
      <Breadcrumb style={{ margin: '16px 0' }}>
        <Breadcrumb.Item><Link to="/"><HomeOutlined /></Link></Breadcrumb.Item>
        <Breadcrumb.Item><Link to="/proyectos">Proyectos</Link></Breadcrumb.Item>
        <Breadcrumb.Item>
          <Link to={`/proyectos/${projectId}/monitoreo`}><DatabaseOutlined /> Monitoreos</Link>
        </Breadcrumb.Item>
        <Breadcrumb.Item>{monitoreoInfo?.tipo_monitoreo || 'Gases contaminantes'}</Breadcrumb.Item>
      </Breadcrumb>

      <Row justify="space-between" align="middle" style={{ marginBottom: 12 }}>
        <Col>
          <Title level={2} style={{ color: PRIMARY_BLUE, marginBottom: 0 }}>
            Monitoreo de Gases Contaminantes
          </Title>
        </Col>
        <Col>
          <Space>
            <Button onClick={() => navigate(`/proyectos/${projectId}/monitoreo`)}>
              <ArrowLeftOutlined /> Volver
            </Button>
            <Button icon={<FileExcelOutlined />} onClick={() => exportToExcel(registros, empresa)}>
              Exportar a Excel
            </Button>
            {/* NUEVO BOTÓN */}
            <Button 
              icon={<FilePdfOutlined />} 
              onClick={handleOpenPdf}
              style={{ backgroundColor: '#ff4d4f', color: 'white', borderColor: '#ff4d4f' }} // Opcional: color rojo PDF
            >
              Reporte Fotos
            </Button>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => setSelectedRegistro(null) || setIsFormModalVisible(true)}
            >
              Agregar
            </Button>
          </Space>
        </Col>
      </Row>

      {/* Buscador */}
      <Row justify="space-between" align="middle" style={{ marginBottom: 16, gap: 15 }}>
        <Col flex="0 0 520px">
          <Input.Search
            allowClear
            placeholder="Buscar por área, puesto, hora, coordenadas (location), observación…"
            value={searchText}
            onChange={(e) => {
              setSearchText(e.target.value);
              setCurrentPage(1);
            }}
          />
        </Col>
        <Col>
          <Space>
            <Text type="secondary">Registros por página:</Text>
            <InputNumber
              min={5}
              max={100}
              value={pageSize}
              onChange={(v) => {
                const n = Number(v) || 10;
                setPageSize(n);
                setCurrentPage(1);
              }}
              style={{ width: 90 }}
            />
          </Space>
        </Col>
      </Row>

      <Spin spinning={loadingHeader}>
        <Descriptions bordered size="small" column={2} style={{ marginBottom: 15 }}>
          <Descriptions.Item label="NOMBRE DE LA EMPRESA">{empresa}</Descriptions.Item>
          <Descriptions.Item label="FECHA DE INICIO">{fechaInicio}</Descriptions.Item>
        </Descriptions>
      </Spin>

      <Spin spinning={loading}>
        <div style={{ overflowX: 'auto' }}>
          <Table
            className="tabla-general" // <--- Clase personalizada para estilos de tabla cabecera fija
            columns={columns}
            dataSource={paginatedRegistros}
            rowKey="id"
            size="small"
            pagination={false}
            scroll={{ x: 1500 }}
          />
        </div>
      </Spin>

      {/* Pie: paginación */}
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
        title={selectedRegistro ? 'Editar Registro de Gases' : 'Agregar Registro de Gases'}
        open={isFormModalVisible}
        onOk={handleFormOk}
        onCancel={handleFormCancel}
        confirmLoading={saving}
        width={900}
        destroyOnClose
      >
        <Form
          form={formInst}
          layout="vertical"
          preserve={false}
          key={selectedRegistro ? `edit-${selectedRegistro.id}` : 'add'}
          initialValues={
            selectedRegistro ? {
              area: selectedRegistro.area || '',
              puesto_trabajo: selectedRegistro.puesto_trabajo,
              // Mostramos hora en local (texto HH:mm) desde measured_at (UTC)
              hora: selectedRegistro?.measured_at
                ? dayjs(selectedRegistro.measured_at).utc().local().format('HH:mm')
                : null,

              o2_1: selectedRegistro.o2_1, o2_2: selectedRegistro.o2_2,
              h2s_1: selectedRegistro.h2s_1, h2s_2: selectedRegistro.h2s_2,
              co_1: selectedRegistro.co_1, co_2: selectedRegistro.co_2,
              lel_1: selectedRegistro.lel_1, lel_2: selectedRegistro.lel_2,
              hcho_1: selectedRegistro.hcho_1, hcho_2: selectedRegistro.hcho_2,
              tcov_1: selectedRegistro.tcov_1, tcov_2: selectedRegistro.tcov_2,
              co2_1: selectedRegistro.co2_1, co2_2: selectedRegistro.co2_2,
              hr_1: selectedRegistro.hr_1, hr_2: selectedRegistro.hr_2,
              ta_1: selectedRegistro.ta_1, ta_2: selectedRegistro.ta_2,

              location: typeof selectedRegistro.location === 'object'
                ? JSON.stringify(selectedRegistro.location)
                : (selectedRegistro.location || ''),
              categoria: selectedRegistro.categoria,
              observaciones: selectedRegistro.observaciones,
              image_urls: Array.isArray(selectedRegistro.image_urls)
                ? selectedRegistro.image_urls.join(', ')
                : (selectedRegistro.image_urls || ''),
            } : {}
          }
        >
          <Row gutter={12}>
            <Col span={10}>
              <Form.Item
                name="area"
                label="Área de Trabajo"
                rules={[{ required: true, message: 'Obligatorio' }]}
              >
                <Input />
              </Form.Item>
            </Col>
            <Col span={10}>
              <Form.Item
                name="puesto_trabajo"
                label="Puesto de Trabajo"
                rules={[{ required: true, message: 'Obligatorio' }]}
              >
                <Input />
              </Form.Item>
            </Col>
            <Col span={4}>
              <Form.Item
                name="hora"
                label="Hora (HH:mm)"
                rules={[{ required: true, message: 'Obligatorio' }]}
              >
                <Input placeholder="09:15" />
              </Form.Item>
            </Col>
          </Row>

          {/* Pares O2 / H2S / CO / LEL */}
          <Row gutter={8}>
            <Col span={6}><Form.Item name="o2_1" label="O2 Col 1"><InputNumber step={0.01} style={{ width: '100%' }} /></Form.Item></Col>
            <Col span={6}><Form.Item name="o2_2" label="O2 Col 2"><InputNumber step={0.01} style={{ width: '100%' }} /></Form.Item></Col>

            <Col span={6}><Form.Item name="h2s_1" label="H2S Col 1"><InputNumber step={0.01} style={{ width: '100%' }} /></Form.Item></Col>
            <Col span={6}><Form.Item name="h2s_2" label="H2S Col 2"><InputNumber step={0.01} style={{ width: '100%' }} /></Form.Item></Col>
          </Row>

          <Row gutter={8}>
            <Col span={6}><Form.Item name="co_1" label="CO Col 1"><InputNumber step={0.01} style={{ width: '100%' }} /></Form.Item></Col>
            <Col span={6}><Form.Item name="co_2" label="CO Col 2"><InputNumber step={0.01} style={{ width: '100%' }} /></Form.Item></Col>

            <Col span={6}><Form.Item name="lel_1" label="LEL Col 1"><InputNumber step={0.01} style={{ width: '100%' }} /></Form.Item></Col>
            <Col span={6}><Form.Item name="lel_2" label="LEL Col 2"><InputNumber step={0.01} style={{ width: '100%' }} /></Form.Item></Col>
          </Row>

          {/* Pares HCHO / T-COV / CO2 */}
          <Row gutter={8}>
            <Col span={6}><Form.Item name="hcho_1" label="HCHO Col 1"><InputNumber step={0.001} style={{ width: '100%' }} /></Form.Item></Col>
            <Col span={6}><Form.Item name="hcho_2" label="HCHO Col 2"><InputNumber step={0.001} style={{ width: '100%' }} /></Form.Item></Col>

            <Col span={6}><Form.Item name="tcov_1" label="T-COV Col 1"><InputNumber step={0.001} style={{ width: '100%' }} /></Form.Item></Col>
            <Col span={6}><Form.Item name="tcov_2" label="T-COV Col 2"><InputNumber step={0.001} style={{ width: '100%' }} /></Form.Item></Col>
          </Row>

          <Row gutter={8}>
            <Col span={6}><Form.Item name="co2_1" label="CO2 Col 1"><InputNumber step={0.01} style={{ width: '100%' }} /></Form.Item></Col>
            <Col span={6}><Form.Item name="co2_2" label="CO2 Col 2"><InputNumber step={0.01} style={{ width: '100%' }} /></Form.Item></Col>

            <Col span={6}><Form.Item name="hr_1" label="H.R. Col 1"><InputNumber step={0.01} style={{ width: '100%' }} /></Form.Item></Col>
            <Col span={6}><Form.Item name="hr_2" label="H.R. Col 2"><InputNumber step={0.01} style={{ width: '100%' }} /></Form.Item></Col>
          </Row>

          <Row gutter={8}>
            <Col span={6}><Form.Item name="ta_1" label="TA °C Col 1"><InputNumber step={0.01} style={{ width: '100%' }} /></Form.Item></Col>
            <Col span={6}><Form.Item name="ta_2" label="TA °C Col 2"><InputNumber step={0.01} style={{ width: '100%' }} /></Form.Item></Col>
          </Row>

          {/* Campo de location (texto o JSON) */}
          <Row gutter={8}>
            <Col span={24}>
              <Form.Item name="location" label="Location (UTM/JSON/Texto)">
                <Input.TextArea rows={2} placeholder='Ej: {"easting":588457.04,"northing":8178344.41,"utm_zone":"19K"}  ó  588457.04E; 8178344.41N Z19K' />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={8}>
            <Col span={8}><Form.Item name="categoria" label="Categoría"><Input placeholder="4" /></Form.Item></Col>
            <Col span={16}><Form.Item name="observaciones" label="Observaciones"><Input.TextArea rows={3} /></Form.Item></Col>
          </Row>

          <Form.Item name="image_urls" label="Imagen(es) URL (separadas por coma)">
            <Input.TextArea rows={2} placeholder="https://..., https://..." />
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
      {/* ... AL FINAL DE TU JSX, JUNTO A LOS OTROS MODALES ... */}
<Modal
          title={pdfStep === 'selection' ? "Seleccionar Imágenes para Reporte" : "Vista Previa PDF"}
          open={isPdfModalVisible}
          onCancel={() => setIsPdfModalVisible(false)}
          width={1000}
          style={{ top: 20 }}
footer={
    pdfStep === 'selection' ? (
        <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
            
            {/* NUEVO: Selector de Distribución */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Text strong>Distribución:</Text>
                <Select 
                    defaultValue="2x4" 
                    style={{ width: 120 }} 
                    onChange={(val) => setPdfLayout(val)}
                >
                    <Option value="2x4">2 x 4 (8 fotos)</Option>
                    <Option value="2x3">2 x 3 (6 fotos)</Option>
                    <Option value="3x3">3 x 3 (9 fotos)</Option>
                    <Option value="3x4">3 x 4 (12 fotos)</Option>
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
            <ArrowLeftOutlined /> Volver a seleccionar
        </Button>
    )
}
      >
          <div style={{ height: '75vh', overflowY: 'auto', overflowX: 'hidden' }}>
              
              {/* PASO 1: SELECCIÓN (HTML GRID) */}
              {pdfStep === 'selection' && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', justifyContent: 'center' }}>
                      {registros.filter(r => getImagesArray(r).length > 0).map((r, i) => {
                          const imgs = getImagesArray(r);
                          const currentIdx = tempSelections[r.id] || 0;
                          
                          return (
                              <div key={r.id} style={{ 
                                  width: '23%', // Aprox 4 columnas
                                  border: '1px solid #ddd', 
                                  padding: '8px',
                                  borderRadius: '8px',
                                  display: 'flex', 
                                  flexDirection: 'column',
                                  alignItems: 'center',
                                  backgroundColor: '#fafafa'
                              }}>
                                  <Text strong style={{ fontSize: 12, marginBottom: 5, textAlign: 'center' }}>
                                      {r.area || 'Sin Área'}
                                  </Text>
                                  
                                  {/* Contenedor de Imagen con Flechas */}
                                  <div style={{ position: 'relative', width: '100%', height: '150px', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff', border: '1px solid #eee' }}>
                                      
                                      {/* Flecha Izquierda (Solo si hay más de 1 foto) */}
                                      {imgs.length > 1 && (
                                          <Button 
                                              shape="circle" 
                                              icon={<LeftOutlined />} 
                                              size="small" 
                                              style={{ position: 'absolute', left: 5, zIndex: 10 }}
                                              onClick={() => handlePrevImage(r.id, imgs.length)}
                                          />
                                      )}

                                      <img 
                                          src={imgs[currentIdx]} 
                                          alt="preview" 
                                          style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
                                      />

                                      {/* Flecha Derecha */}
                                      {imgs.length > 1 && (
                                          <Button 
                                              shape="circle" 
                                              icon={<RightOutlined />} 
                                              size="small" 
                                              style={{ position: 'absolute', right: 5, zIndex: 10 }}
                                              onClick={() => handleNextImage(r.id, imgs.length)}
                                          />
                                      )}
                                      
                                      {/* Indicador de página (ej: 1/3) */}
                                      {imgs.length > 1 && (
                                          <span style={{ position: 'absolute', bottom: 2, right: 5, fontSize: 10, background: 'rgba(255,255,255,0.7)', padding: '0 4px' }}>
                                              {currentIdx + 1}/{imgs.length}
                                          </span>
                                      )}
                                  </div>

                                  <Text style={{ fontSize: 11, marginTop: 5, textAlign: 'center', color: '#666' }}>
                                      {r.puesto_trabajo}
                                  </Text>
                              </div>
                          );
                      })}
                  </div>
              )}

              {/* PASO 2: VISOR PDF REAL */}
                {pdfStep === 'view' && (
                      <PDFViewer width="100%" height="100%" showToolbar={true}>
                          <ReporteFotografico 
                              data={pdfData} 
                              empresa={proyectoInfo?.nombre || 'Empresa'}
                              layout={pdfLayout} // <--- AQUÍ PASAMOS LA SELECCIÓN
                          />
                      </PDFViewer>
                )}
          </div>
      </Modal>
    </>
  );
};

export default GasesPage;
