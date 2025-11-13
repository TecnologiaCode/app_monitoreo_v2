// src/pages/ParticulasPage.jsx

// =================================================================================
// IMPORTACIONES DE LIBRERÍAS
// =================================================================================

// Importa las bibliotecas principales de React
import React, { useEffect, useState, useMemo } from 'react';

// Importa componentes de la interfaz de usuario de Ant Design (AntD)
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
} from 'antd';

// Importa iconos de Ant Design
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

// Importa hooks de react-router-dom para navegación y parámetros de URL
import { Link, useNavigate, useParams } from 'react-router-dom';

// Importa dayjs para el manejo de fechas y horas
import dayjs from 'dayjs';
// Importa el plugin 'utc' para manejar correctamente las conversiones a UTC
import utc from 'dayjs/plugin/utc';
// Importa la localización en español para dayjs (meses, días)
import 'dayjs/locale/es';

// Importa el cliente de Supabase para la conexión con la base de datos
import { supabase } from '../supabaseClient.js';

// Importa la biblioteca para generar archivos Excel con estilos
import XLSX from 'xlsx-js-style';

// =================================================================================
// CONFIGURACIÓN INICIAL
// =================================================================================

// Aplica el plugin UTC a dayjs globalmente
dayjs.extend(utc);
// Establece el idioma español para dayjs
dayjs.locale('es');

// Desestructura componentes de Typography y Select para un uso más limpio
const { Title, Text } = Typography;
const { Option } = Select;

// Define constantes para valores mágicos
const PRIMARY_BLUE = '#2a8bb6'; // Color primario para la UI
const PARTICULAS_TABLE = 'particulas'; // Nombre de la tabla en Supabase

// Límites fijos para la lógica de cumplimiento en el Excel
const LIMITE_PM10 = 10; // Límite para PM 10 (I)
const LIMITE_PM25 = 3; // Límite para PM 2.5 (R)

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
    ? dayjs(originalTimestamp).local() // Si editamos: Convierte el UTC de la DB a local para usar su *fecha*
    : dayjs().local(); // Si creamos: Usa "hoy" en hora local

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

// =================================================================================
// DEFINICIÓN DEL COMPONENTE PRINCIPAL
// =================================================================================
const ParticulasPage = () => {
  // Hooks de React Router
  const { projectId, monitoreoId: mId, id } = useParams(); // Obtiene IDs de la URL
  const monitoreoId = mId || id; // Compatibilidad para 'id' o 'monitoreoId'
  const navigate = useNavigate(); // Hook para redirigir al usuario
  const [form] = Form.useForm(); // Hook de AntD para controlar el formulario del modal

  // --- Estados de Datos ---
  const [monitoreoInfo, setMonitoreoInfo] = useState(null); // Info del monitoreo actual
  const [proyectoInfo, setProyectoInfo] = useState(null); // Info del proyecto padre
  const [equiposInfo, setEquiposInfo] = useState([]); // Lista de equipos usados
  const [registros, setRegistros] = useState([]); // La lista principal de mediciones

  // --- Estados de UI (Carga y Modal) ---
  const [loadingHeader, setLoadingHeader] = useState(true); // Spinner para la cabecera
  const [loading, setLoading] = useState(true); // Spinner para la tabla principal
  const [saving, setSaving] = useState(false); // Spinner para el botón "Guardar" del modal
  const [isFormModalVisible, setIsFormModalVisible] = useState(false); // Visibilidad del modal (agregar/editar)
  const [selectedRegistro, setSelectedRegistro] = useState(null); // Registro seleccionado para editar (null si es "agregar")

  // --- Estados del Visor de Imágenes ---
  const [imageViewerOpen, setImageViewerOpen] = useState(false); // Visibilidad del modal de imágenes
  const [imageViewerList, setImageViewerList] = useState([]); // Lista de URLs de imágenes a mostrar
  const [imageViewerIndex, setImageViewerIndex] = useState(0); // Índice de la imagen actual

  // --- Estados de Búsqueda y Paginación ---
  const [searchText, setSearchText] = useState(''); // Texto en la barra de búsqueda
  const [pageSize, setPageSize] = useState(10); // Cantidad de registros por página
  const [currentPage, setCurrentPage] = useState(1); // Página actual

  // --- Estado de Diccionario ---
  // Almacena { 'user_uuid': 'Nombre Usuario' } para mostrar quién creó el registro
  const [usersById, setUsersById] = useState({});

  /* ================ HELPERS DE UI ================ */
  
  // Abre el modal visor de imágenes
  const openImageViewer = (imgs, idx = 0) => {
    if (!imgs || !imgs.length) return; // No hacer nada si no hay imágenes
    setImageViewerList(imgs);
    setImageViewerIndex(idx);
    setImageViewerOpen(true);
  };

  // Renderiza el campo 'location' que puede ser texto, array o JSON
  const renderLocation = (v) => {
    if (!v) return <Text type="secondary">N/A</Text>;
    if (typeof v === 'string') return v;
    if (Array.isArray(v)) return v.join(', ');
    return JSON.stringify(v); // Fallback por si es un objeto
  };

  /* ================ LÓGICA DE CABECERA (PROYECTO, EQUIPOS) ================ */
  
  // Obtiene la información del proyecto
  const fetchProyectoInfo = async (pId) => {
    if (!pId) return;
    try {
      const { data, error } = await supabase
        .from('proyectos')
        .select('id, nombre, created_at, estado')
        .eq('id', pId)
        .single(); // Espera un solo resultado
      if (error) throw error;
      setProyectoInfo(data);
    } catch (err) {
      console.error('Error proyecto:', err);
      setProyectoInfo(null);
    }
  };

  // Obtiene información de los equipos
  const fetchEquiposInfo = async (equipoIds) => {
    if (!equipoIds) {
      setEquiposInfo([]);
      return;
    }
    // Normaliza 'equipoIds' que puede ser un string JSON o un array
    let list = equipoIds;
    if (typeof list === 'string') {
      try {
        list = JSON.parse(list);
      } catch {
        list = []; // Si no es JSON, se ignora
      }
    }
    if (!Array.isArray(list) || !list.length) {
      setEquiposInfo([]);
      return;
    }
    // Busca los equipos en la BD
    try {
      const { data, error } = await supabase
        .from('equipos')
        .select('id, nombre_equipo, modelo, serie')
        .in('id', list); // 'in' para buscar múltiples IDs
      if (error) throw error;
      setEquiposInfo(data || []);
    } catch (err) {
      console.error('Error equipos:', err);
      setEquiposInfo([]);
    }
  };

  // Efecto que se ejecuta al cargar la página o si cambia el ID del monitoreo
  useEffect(() => {
    const fetchHeader = async () => {
      // Si no hay ID de monitoreo, solo busca el proyecto
      if (!monitoreoId) {
        if (projectId) {
          await fetchProyectoInfo(projectId);
        }
        setLoadingHeader(false);
        return;
      }
      setLoadingHeader(true);
      try {
        // 1. Busca la info del monitoreo
        const { data, error } = await supabase
          .from('monitoreos')
          .select('id, tipo_monitoreo, proyecto_id, equipos_asignados')
          .eq('id', monitoreoId)
          .single();
        if (error) throw error;
        setMonitoreoInfo(data);
        // 2. Busca el proyecto y los equipos en paralelo
        await Promise.all([
          fetchProyectoInfo(data.proyecto_id),
          fetchEquiposInfo(data.equipos_asignados),
        ]);
      } catch (err) {
        console.error('Error cabecera partículas:', err);
      } finally {
        setLoadingHeader(false); // Quita el spinner de la cabecera
      }
    };

    fetchHeader();
  }, [monitoreoId, projectId]); // Dependencias del efecto

  /* ================ LÓGICA DE REGISTROS (TABLA PRINCIPAL) ================ */

  // Obtiene todos los registros de partículas para este monitoreo
  const fetchRegistros = async () => {
    setLoading(true); // Activa el spinner de la tabla
    try {
      // Define las columnas que queremos traer de la BD
      const cols =
        'id, created_at, proyecto_id, monitoreo_id, measured_at, puesto_trabajo, temperatura_c, hr_percent, pm25_values, pm25_prom, pm10_values, pm10_prom, pts_values, pts_prom, observaciones, image_urls, location, created_by';

      let query = supabase.from(PARTICULAS_TABLE).select(cols);

      // Filtra los registros según el contexto (monitoreo o proyecto)
      if (monitoreoId) {
        query = query.eq('monitoreo_id', monitoreoId);
      } else if (projectId) {
        query = query.eq('proyecto_id', projectId);
      } else {
        // Si no hay ID de proyecto ni monitoreo, no muestra nada
        setRegistros([]);
        setLoading(false);
        return;
      }

      // Ordena por fecha de medición (los nulos primero) y luego por fecha de creación
      query = query
        .order('measured_at', { ascending: true, nullsFirst: true })
        .order('created_at', { ascending: true, nullsFirst: true });

      const { data, error } = await query;
      if (error) throw error;

      // "Patrón Adaptador": Normaliza los datos recibidos de Supabase
      const mapped = (data || []).map((r) => {
        // Función interna para normalizar arrays (que pueden venir como string)
        const normalizeArray = (val) => {
          if (!val) return [];
          if (Array.isArray(val)) return val; // Ya es un array
          if (typeof val === 'string' && val.trim() !== '') {
            try {
              // Intenta parsear como JSON (ej: ["1", "2"])
              const parsed = JSON.parse(val);
              if (Array.isArray(parsed)) return parsed;
            } catch (_) {
              // Si falla, lo trata como string separado por comas (ej: "1, 2")
              return val.split(',').map((s) => s.trim());
            }
          }
          return []; // Fallback
        };

        // Normaliza las URLs de imágenes
        let imgs = [];
        if (Array.isArray(r.image_urls)) {
          imgs = r.image_urls;
        } else if (typeof r.image_urls === 'string' && r.image_urls.trim() !== '') {
          imgs = r.image_urls.split(',').map((s) => s.trim());
        }

        // Retorna el registro normalizado
        return {
          ...r,
          pm10_values: normalizeArray(r.pm10_values),
          pm25_values: normalizeArray(r.pm25_values),
          pts_values: normalizeArray(r.pts_values),
          image_urls: imgs,
        };
      });

      setRegistros(mapped); // Guarda los datos normalizados en el estado
      setCurrentPage(1); // Resetea la paginación a la página 1

      // --- Carga de Perfiles de Usuario ---
      // Obtiene todos los IDs únicos de 'created_by'
      const createdByIds = Array.from(
        new Set(
          (mapped || [])
            .map((m) => m.created_by)
            .filter((v) => v && typeof v === 'string') // Filtra nulos o vacíos
        )
      );
      // Si hay IDs, busca sus perfiles
      if (createdByIds.length > 0) {
        await fetchUsersByIds(createdByIds);
      } else {
        setUsersById({});
      }
    } catch (err) {
      console.error('Error partículas:', err);
      message.error('No se pudieron cargar las partículas.');
      setRegistros([]);
    } finally {
      setLoading(false); // Desactiva el spinner de la tabla
    }
  };

  // Obtiene los nombres de los usuarios basado en sus IDs
  const fetchUsersByIds = async (ids) => {
    try {
      const { data, error } = await supabase
        .from('profiles') // Tabla de perfiles de usuario
        .select('id, username, nombre_completo, email, descripcion, rol, estado')
        .in('id', ids);

      if (error) {
        console.warn('No se pudieron cargar usuarios:', error.message);
        return;
      }

      // Crea un diccionario (objeto) para búsqueda rápida: { id: nombre }
      const dict = {};
      (data || []).forEach((u) => {
        // Busca el mejor nombre disponible para mostrar
        const display =
          (u.nombre_completo && u.nombre_completo.trim()) ||
          (u.username && u.username.trim()) ||
          (u.descripcion && u.descripcion.trim()) ||
          (u.rol && u.rol.trim()) ||
          (u.estado && u.estado.trim()) ||
          (u.email && u.email.trim()) ||
          u.id; // Fallback al ID
        dict[u.id] = display;
      });

      setUsersById(dict); // Guarda el diccionario en el estado
    } catch (err) {
      console.error('Error trayendo usuarios:', err);
    }
  };

  // Efecto para cargar datos y suscribirse a Realtime
  useEffect(() => {
    fetchRegistros(); // Carga los datos al iniciar

    // Configuración de Supabase Realtime
    const channel = supabase
      .channel('rt-particulas') // Un nombre único para el canal
      .on(
        'postgres_changes', // Escucha cambios en la BD
        { event: '*', schema: 'public', table: PARTICULAS_TABLE }, // En esta tabla
        () => fetchRegistros() // Cuando hay un cambio, vuelve a cargar los datos
      )
      .subscribe(); // Inicia la suscripción

    // Función de limpieza: se ejecuta cuando el componente se desmonta
    return () => {
      supabase.removeChannel(channel); // Se desuscribe del canal
    };
  }, [monitoreoId, projectId]); // Se vuelve a suscribir si cambia el ID

  /* ================ MANEJADORES DE CRUD (CREATE, READ, UPDATE, DELETE) ================ */
  
  // Abre el modal para agregar un nuevo registro
  const handleAdd = () => {
    setSelectedRegistro(null); // Pone el registro seleccionado en null
    setIsFormModalVisible(true); // Muestra el modal
  };

  // Abre el modal para editar un registro existente
  const handleEdit = (record) => {
    setSelectedRegistro(record); // Guarda el registro a editar
    setIsFormModalVisible(true); // Muestra el modal
  };

  // Muestra confirmación para eliminar un registro
  const handleDelete = (record) => {
    Modal.confirm({
      title: '¿Eliminar registro?',
      icon: <ExclamationCircleOutlined />,
      content: `Se eliminará el registro del puesto "${record.puesto_trabajo || record.id}".`,
      okText: 'Eliminar',
      okType: 'danger',
      cancelText: 'Cancelar',
      onOk: async () => { // Si el usuario confirma
        try {
          const { error } = await supabase
            .from(PARTICULAS_TABLE)
            .delete()
            .eq('id', record.id); // Elimina por ID
          if (error) throw error;
          message.success('Registro eliminado.');
          // Realtime se encargará de actualizar la tabla
        } catch (err) {
          console.error(err);
          message.error('No se pudo eliminar.');
        }
      },
    });
  };

  // Decide si debe llamar a la lógica de "Agregar" o "Editar"
  const handleFormOk = () => {
    selectedRegistro ? handleEditOk() : handleAddOk();
  };

  // Cierra el modal de formulario
  const handleFormCancel = () => {
    setIsFormModalVisible(false);
  };

  // Helper para convertir "1, 2, 3" en [1, 2, 3]
  const parseNumberArray = (txt) => {
    if (!txt) return null;
    if (Array.isArray(txt)) return txt; // Ya es un array
    const parts = txt
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean) // Quita vacíos
      .map((n) => Number(n)); // Convierte a número
    return parts.length ? parts : null;
  };

  // Lógica para AGREGAR un nuevo registro (CREATE)
  const handleAddOk = async () => {
    setSaving(true); // Activa spinner del botón Guardar
    try {
      const values = await form.validateFields(); // Obtiene valores del formulario

      // Validación de contexto
      if (!monitoreoId && !projectId) {
        message.error('No hay proyecto o monitoreo en la URL.');
        setSaving(false);
        return;
      }

      // "Patrón Adaptador": Transforma los datos del formulario (UI)
      // al formato de la Base de Datos.
      const payload = {
        proyecto_id: projectId || null,
        monitoreo_id: monitoreoId || null,
        
        // ¡LÓGICA DE HORA (CREAR)!
        // Convierte la hora local del formulario a UTC.
        // Pasa 'null' como 2do argumento para usar la fecha de "hoy".
        measured_at: parseHoraLocalToUTC(values.measured_at, null),

        puesto_trabajo: values.puesto_trabajo,
        // Convierte números a string si es necesario (según tu schema original)
        temperatura_c: values.temperatura_c != null ? String(values.temperatura_c) : null,
        hr_percent: values.hr_percent != null ? String(values.hr_percent) : null,
        
        // Convierte los strings de "values" a arrays de números
        pm25_values: values.pm25_values ? parseNumberArray(values.pm25_values) : null,
        pm25_prom: values.pm25_prom != null ? Number(values.pm25_prom) : null,
        pm10_values: values.pm10_values ? parseNumberArray(values.pm10_values) : null,
        pm10_prom: values.pm10_prom != null ? Number(values.pm10_prom) : null,
        pts_values: values.pts_values ? parseNumberArray(values.pts_values) : null,
        pts_prom: values.pts_prom != null ? Number(values.pts_prom) : null,
        
        observaciones: values.observaciones || null,
        
        // Convierte el string de URLs en un array
        image_urls:
          values.image_urls && values.image_urls.trim() !== ''
            ? values.image_urls
              .split(',')
              .map((s) => s.trim())
              .filter(Boolean)
            : null,
        location: values.location || null,
        // 'created_by' es manejado automáticamente por Supabase (si está configurado)
      };

      // Envía el payload a Supabase
      const { error } = await supabase.from(PARTICULAS_TABLE).insert(payload);
      if (error) throw error;

      message.success('Registro agregado.');
      setIsFormModalVisible(false); // Cierra el modal
    } catch (err) {
      console.error('Error add partículas:', err);
      message.error('No se pudo agregar.');
    } finally {
      setSaving(false); // Desactiva spinner del botón
    }
  };

  // Lógica para ACTUALIZAR un registro (UPDATE)
  const handleEditOk = async () => {
    if (!selectedRegistro) return; // Guarda de seguridad
    setSaving(true);
    try {
      const values = await form.validateFields(); // Obtiene valores del formulario

      // Prepara el payload de actualización
      const updateData = {
        proyecto_id: projectId || selectedRegistro.proyecto_id || null,
        monitoreo_id: monitoreoId || selectedRegistro.monitoreo_id || null,
        
        // ¡LÓGICA DE HORA (EDITAR)!
        // Convierte la hora local del formulario a UTC.
        // Pasa el timestamp original para PRESERVAR LA FECHA.
        measured_at: parseHoraLocalToUTC(values.measured_at, selectedRegistro.measured_at),

        puesto_trabajo: values.puesto_trabajo,
        temperatura_c: values.temperatura_c != null ? String(values.temperatura_c) : null,
        hr_percent: values.hr_percent != null ? String(values.hr_percent) : null,
        
        // Lógica de arrays y promedios
        pm25_values: values.pm25_values ? parseNumberArray(values.pm25_values) : null,
        pm25_prom: values.pm25_prom != null ? Number(values.pm25_prom) : null,
        pm10_values: values.pm10_values ? parseNumberArray(values.pm10_values) : null,
        pm10_prom: values.pm10_prom != null ? Number(values.pm10_prom) : null,
        pts_values: values.pts_values ? parseNumberArray(values.pts_values) : null,
        pts_prom: values.pts_prom != null ? Number(values.pts_prom) : null,
        
        observaciones: values.observaciones || null,
        
        // Lógica de URLs de imágenes
        image_urls:
          values.image_urls && values.image_urls.trim() !== ''
            ? values.image_urls
              .split(',')
              .map((s) => s.trim())
              .filter(Boolean)
            : null,
        location: values.location || null,
      };

      // Envía la actualización a Supabase
      const { error } = await supabase
        .from(PARTICULAS_TABLE)
        .update(updateData) // UPDATE en lugar de INSERT
        .eq('id', selectedRegistro.id); // Donde el ID coincida
      if (error) throw error;

      message.success('Registro actualizado.');
      setIsFormModalVisible(false);
    } catch (err) {
      console.error('Error edit partículas:', err);
      message.error('No se pudo actualizar.');
    } finally {
      setSaving(false);
    }
  };

  /* ================ EXPORTAR A EXCEL ================ */
  const exportToExcel = () => {
    try {
      const wsData = []; // Aquí irá toda la data del Excel (Array de Arrays)

      // --- Definición de Estilos ---
      const titleStyle = {
        font: { bold: true },
        alignment: { vertical: 'center', horizontal: 'left' },
      };
      const headerStyle = {
        font: { bold: true },
        alignment: { vertical: 'center', horizontal: 'center', wrapText: true },
        fill: { fgColor: { rgb: 'D9E1F2' } }, // Fondo azul claro
        border: { // Bordes
          top: { style: 'thin', color: { rgb: '000000' } },
          bottom: { style: 'thin', color: { rgb: '000000' } },
          left: { style: 'thin', color: { rgb: '000000' } },
          right: { style: 'thin', color: { rgb: '000000' } },
        },
      };
      const cellStyle = {
        alignment: { vertical: 'center', horizontal: 'left', wrapText: true },
        border: { // Bordes
          top: { style: 'thin', color: { rgb: '000000' } },
          bottom: { style: 'thin', color: { rgb: '000000' } },
          left: { style: 'thin', color: { rgb: '000000' } },
          right: { style: 'thin', color: { rgb: '000000' } },
        },
      };

      // --- Cabecera de Metadatos ---
      const empresa = proyectoInfo?.nombre || '';
      const firstReg = registros && registros.length ? registros[0] : null;
      // Intenta tomar la fecha del primer registro, o la del proyecto
      const fechaInicio =
        firstReg?.measured_at
          ? dayjs(firstReg.measured_at).utc().format('DD/MM/YYYY')
          : proyectoInfo?.measured_at
            ? dayjs(proyectoInfo.measured_at).utc().format('DD/MM/YYYY')
            : '';
      const fechaFin = ''; // Dejado en blanco

      // Fila 1: Título
      wsData.push([
        {
          v: 'PLANILLA DE MEDICIÓN DE PARTÍCULAS SUSPENDIDAS',
          s: {
            font: { bold: true, sz: 14 },
            alignment: { vertical: 'center', horizontal: 'center' },
          },
        },
      ]);

      // Fila 2: Info Empresa, Fecha Inicio
      wsData.push([
        { v: 'INSTALACIÓN:', s: titleStyle },
        { v: empresa, s: cellStyle },
        '', // Columna C vacía
        { v: 'FECHA DE INICIO DEL MONITOREO:', s: titleStyle },
        { v: fechaInicio, s: cellStyle },
      ]);
      // Fila 3: Info Fecha Fin, Tipo
      wsData.push([
        { v: 'FECHA DE FINALIZACIÓN DEL MONITOREO:', s: titleStyle },
        { v: fechaFin, s: cellStyle },
        '',
        { v: 'TIPO DE MONITOREO:', s: titleStyle },
        { v: monitoreoInfo?.tipo_monitoreo || 'PARTÍCULAS', s: cellStyle },
      ]);
      wsData.push(['', '', '', '', '']); // Fila 4: Espacio

      // --- Cabeceras de la Tabla (Anidadas) ---
      // Fila 5: Cabecera principal
      wsData.push([
        { v: 'N°', s: headerStyle },
        { v: 'Puesto de Trabajo Evaluado', s: headerStyle },
        { v: 'Fecha', s: headerStyle }, // Columna separada para Fecha
        { v: 'Hora de Medición', s: headerStyle }, // Columna separada para Hora

        /*{
          v: measured_at ? dayjs(measured_at).utc().format('DD/MM/YYYY') : '', // <-- CAMBIO CLAVE
          s: cellStyle,
        },
        // Hora (UTC)
        {
          v: measured_at ? dayjs(measured_at).utc().format('HH:mm') : '', // <-- CAMBIO CLAVE
          s: cellStyle,
        },*/
        { v: 'Temperatura °C', s: headerStyle },
        { v: 'H.R.%', s: headerStyle },
        { v: 'Resultados  µg/m³', s: headerStyle }, // Celda que se unirá
        '', // (ocupa 3 celdas)
        '',
        { v: 'Límite Permisible  µg/m³', s: headerStyle }, // Celda que se unirá
        '', // (ocupa 2 celdas)
        { v: 'Cumplimiento con la Norma', s: headerStyle }, // Celda que se unirá
        '', // (ocupa 2 celdas)
      ]);

      // Fila 6: Sub-cabeceras
      wsData.push([
        { v: '', s: headerStyle }, // N° (vacío, se unirá)
        { v: '', s: headerStyle }, // Puesto (vacío, se unirá)
        { v: '', s: headerStyle }, // Fecha (vacío, se unirá)
        { v: '', s: headerStyle }, // Hora (vacío, se unirá)
        { v: '', s: headerStyle }, // Temp (vacío, se unirá)
        { v: '', s: headerStyle }, // HR (vacío, se unirá)
        { v: 'PM 10', s: headerStyle }, // Sub-cabecera de Resultados
        { v: 'PM 2.5', s: headerStyle }, // Sub-cabecera de Resultados
        { v: 'PTS', s: headerStyle }, // Sub-cabecera de Resultados
        { v: 'PM 10', s: headerStyle }, // Sub-cabecera de Límite
        { v: 'PM 2.5', s: headerStyle }, // Sub-cabecera de Límite
        { v: 'PM 10', s: headerStyle }, // Sub-cabecera de Cumplimiento
        { v: 'PM 2.5', s: headerStyle }, // Sub-cabecera de Cumplimiento
      ]);

      // --- Filas de Datos ---
      // Itera sobre los registros (usamos los filtrados por si acaso, aunque aquí 'registros' es el total)
      registros.forEach((r, idx) => {
        // Calcula cumplimiento
        const pm10 = r.pm10_prom != null ? Number(r.pm10_prom) : null;
        const pm25 = r.pm25_prom != null ? Number(r.pm25_prom) : null;

        const cumplePm10 =
          pm10 != null ? (pm10 <= LIMITE_PM10 ? 'SI' : 'NO') : '';
        const cumplePm25 =
          pm25 != null ? (pm25 <= LIMITE_PM25 ? 'SI' : 'NO') : '';

        // Agrega la fila de datos
        wsData.push([
          { v: idx + 1, s: cellStyle }, // N°
          { v: r.puesto_trabajo || '', s: cellStyle }, // Puesto

          // ¡LÓGICA DE HORA (EXCEL)!
          // Usa .local() para mostrar la fecha y hora en la zona horaria correcta
          {
            v: r.measured_at ? dayjs(r.measured_at).utc().format('DD/MM/YYYY') : '',
            s: cellStyle,
          },
          {
            v: r.measured_at ? dayjs(r.measured_at).utc().format('HH:mm') : '',
            s: cellStyle,
          },

          { v: r.temperatura_c ?? '', s: cellStyle }, // Temp
          { v: r.hr_percent ?? '', s: cellStyle }, // HR
          { v: pm10 != null ? Number(pm10).toFixed(2) : '', s: cellStyle }, // PM 10 (Resultado)
          { v: pm25 != null ? Number(pm25).toFixed(2) : '', s: cellStyle }, // PM 2.5 (Resultado)
          { v: r.pts_prom != null ? Number(r.pts_prom).toFixed(2) : '', s: cellStyle }, // PTS (Resultado)

          { v: '10(I)', s: cellStyle }, // Límite PM 10
          { v: '3(R)', s: cellStyle }, // Límite PM 2.5
          { v: cumplePm10, s: cellStyle }, // Cumple PM 10
          { v: cumplePm25, s: cellStyle }, // Cumple PM 2.5
        ]);
      });

      // --- Creación de la Hoja (Sheet) ---
      const ws = XLSX.utils.aoa_to_sheet(wsData); // Convierte el Array de Arrays en hoja

      // --- Definición de Celdas Unidas (Merges) ---
      ws['!merges'] = [
        // Título (Fila 1, Col A hasta M)
        { s: { r: 0, c: 0 }, e: { r: 0, c: 12 } },
        // "Resultados" (Fila 5, Col G hasta I)
        { s: { r: 4, c: 6 }, e: { r: 4, c: 8 } },
        // "Límite" (Fila 5, Col J hasta K)
        { s: { r: 4, c: 9 }, e: { r: 4, c: 10 } },
        // "Cumplimiento" (Fila 5, Col L hasta M)
        { s: { r: 4, c: 11 }, e: { r: 4, c: 12 } },
        // Celdas de cabecera simples (unen Fila 5 y 6)
        { s: { r: 4, c: 0 }, e: { r: 5, c: 0 } }, // N°
        { s: { r: 4, c: 1 }, e: { r: 5, c: 1 } }, // Puesto
        { s: { r: 4, c: 2 }, e: { r: 5, c: 2 } }, // Fecha
        { s: { r: 4, c: 3 }, e: { r: 5, c: 3 } }, // Hora
        { s: { r: 4, c: 4 }, e: { r: 5, c: 4 } }, // Temp
        { s: { r: 4, c: 5 }, e: { r: 5, c: 5 } }, // HR
      ];

      // --- Definición de Ancho de Columnas ---
      ws['!cols'] = [
        { wch: 4 }, // A (N°)
        { wch: 28 }, // B (Puesto)
        { wch: 12 }, // C (Fecha)
        { wch: 10 }, // D (Hora)
        { wch: 12 }, // E (Temp)
        { wch: 10 }, // F (HR)
        { wch: 10 }, // G (PM 10 Res)
        { wch: 10 }, // H (PM 2.5 Res)
        { wch: 10 }, // I (PTS Res)
        { wch: 10 }, // J (PM 10 Lim)
        { wch: 10 }, // K (PM 2.5 Lim)
        { wch: 17 }, // L (Cumple PM 10)
        { wch: 17 }, // M (Cumple PM 2.5)
      ];

      // --- Creación del Libro (Workbook) y Descarga ---
      const wb = XLSX.utils.book_new(); // Crea un libro nuevo
      XLSX.utils.book_append_sheet(wb, ws, 'Partículas'); // Añade la hoja al libro
      XLSX.writeFile(wb, 'reporte_particulas.xlsx'); // Descarga el archivo
    } catch (err) {
      console.error('Error exportar partículas:', err);
      message.error('No se pudo exportar.');
    }
  };

  /* ================ FILTRO + PAGINACIÓN (MEMORIZADOS) ================ */
  
  // `useMemo` recalcula los registros filtrados solo si `searchText` o `registros` cambian
  const filteredRegistros = useMemo(() => {
    if (!searchText) return registros; // Si no hay búsqueda, retorna todo
    const s = searchText.toLowerCase();
    return registros.filter((r) => {
      // Busca en puesto, observaciones o ubicación
      return (
        (r.puesto_trabajo && r.puesto_trabajo.toLowerCase().includes(s)) ||
        (r.observaciones && r.observaciones.toLowerCase().includes(s)) ||
        (r.location && JSON.stringify(r.location).toLowerCase().includes(s))
      );
    });
  }, [searchText, registros]); // Dependencias

  // Conteo total para la paginación
  const totalFiltered = filteredRegistros.length;

  // `useMemo` recalcula la "página" actual de registros a mostrar
  const paginatedRegistros = useMemo(() => {
    const start = (currentPage - 1) * pageSize; // Índice inicial
    return filteredRegistros.slice(start, start + pageSize); // Corta el array
  }, [filteredRegistros, currentPage, pageSize]); // Dependencias

  /* ================ DEFINICIÓN DE COLUMNAS DE LA TABLA (AntD) ================ */
  const columns = [
    {
      title: 'N°',
      key: 'numero',
      width: 60,
      fixed: 'left', // Fija la columna a la izquierda
      // Calcula el N° basado en la paginación
      render: (_, __, i) => (currentPage - 1) * pageSize + i + 1,
    },

    // Columna FECHA (separada)
    {
      title: 'Fecha',
      dataIndex: 'measured_at',
      key: 'measured_date',
      width: 120,
      sorter: (a, b) => dayjs(a.measured_at).unix() - dayjs(b.measured_at).unix(),
      defaultSortOrder: 'descend',
      // ¡LÓGICA DE HORA (TABLA)! Usa el helper para mostrar la fecha local
      render: (v) => formatFechaUTC(v),
      

    },

    // Columna HORA (separada)
    {
      title: 'Hora de Medición',
      dataIndex: 'measured_at',
      key: 'measured_at',
      width: 140,
      // ✅ Permite ordenar ascendente/descendente por hora
      sorter: (a, b) => dayjs(a.measured_at).unix() - dayjs(b.measured_at).unix(),
      // ¡LÓGICA DE HORA (TABLA)! Usa el helper para mostrar la hora local
      render: (v) => formatHoraUTC(v),
    },

    {
      title: 'Puesto de Trabajo Evaluado',
      dataIndex: 'puesto_trabajo',
      key: 'puesto_trabajo',
      width: 220,
    },

    
    {
      title: 'Temperatura °C',
      dataIndex: 'temperatura_c',
      key: 'temperatura_c',
      width: 120,
    },
    {
      title: 'H.R. %',
      dataIndex: 'hr_percent',
      key: 'hr_percent',
      width: 100,
    },
    {
      // Columna anidada
      title: 'Resultados  µg/m³',
      children: [
        {
          title: 'PM 10',
          dataIndex: 'pm10_prom',
          key: 'pm10_prom',
          width: 100,
          render: (v) => (v != null ? Number(v).toFixed(2) : ''), // Formatea a 2 decimales
        },
        {
          title: 'PM 2.5',
          dataIndex: 'pm25_prom',
          key: 'pm25_prom',
          width: 100,
          render: (v) => (v != null ? Number(v).toFixed(2) : ''),
        },
        {
          title: 'PTS',
          dataIndex: 'pts_prom',
          key: 'pts_prom',
          width: 100,
          render: (v) => (v != null ? Number(v).toFixed(2) : ''),
        },
      ],
    },
    {
      title: 'Imágenes',
      dataIndex: 'image_urls',
      key: 'image_urls',
      width: 130,
      render: (imgs) => { // 'imgs' es el array normalizado
        const list = Array.isArray(imgs) ? imgs : [];
        if (!list.length) return <Text type="secondary">Ninguna</Text>;
        // Botón que abre el visor de imágenes
        return (
          <Button
            type="link"
            icon={<EyeOutlined />}
            onClick={() => openImageViewer(list, 0)} // Llama al helper
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
      width: 200,
      render: (v) => renderLocation(v), // Usa el helper de renderizado
    },
    {
      title: 'Observaciones',
      dataIndex: 'observaciones',
      key: 'observaciones',
      width: 200,
      ellipsis: true, // Corta el texto largo con "..."
    },
    {
      title: 'Registrado por',
      dataIndex: 'created_by',
      key: 'created_by',
      width: 190,
      fixed: 'right', // Fija la columna a la derecha
      render: (v) => { // 'v' es el UUID del usuario
        if (!v) return <Text type="secondary">N/A</Text>;
        const display = usersById[v]; // Busca en el diccionario
        return display ? <Text>{display}</Text> : <Text type="secondary">{v}</Text>; // Muestra nombre o ID
      },
    },
    {
      title: 'Acciones',
      key: 'acciones',
      fixed: 'right', // Fija la columna a la derecha
      width: 110,
      render: (_, record) => ( // 'record' es el registro completo de la fila
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

  /* ================ RENDERIZADO DEL COMPONENTE (JSX) ================ */
  
  // Calcula variables para la cabecera (Descriptions)
  const firstRegistro = registros && registros.length ? registros[0] : null;
  const headerNombreEmpresa = proyectoInfo?.nombre || 'Cargando...';
  // Fecha de inicio: del primer registro o del proyecto
  const headerFechaInicio = firstRegistro?.measured_at
    ? dayjs(firstRegistro.measured_at).utc().format('DD/MM/YYYY')
    : proyectoInfo?.created_at
      ? dayjs(proyectoInfo.measured_at).utc().format('DD/MM/YYYY')
      : 'N/A';
  
  const headerFechaFin = ''; // Vacío

  // Prepara la lista de equipos, modelos y series
  const safeEquipos = Array.isArray(equiposInfo) ? equiposInfo : [];
  const headerEquipos =
    safeEquipos.length > 0
      ? safeEquipos.map((eq) => eq.nombre_equipo || 's/n').join(', ')
      : 'Ninguno';
  const headerModelos =
    safeEquipos.length > 0 ? safeEquipos.map((eq) => eq.modelo || 's/n').join(', ') : 'N/A';
  const headerSeries =
    safeEquipos.length > 0 ? safeEquipos.map((eq) => eq.serie || 's/n').join(', ') : 'N/A';

  // Retorna la estructura JSX
  return (
    <>
      {/* --- Breadcrumbs (Migas de Pan) --- */}
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
        <Breadcrumb.Item>{monitoreoInfo?.tipo_monitoreo || 'Partículas'}</Breadcrumb.Item>
      </Breadcrumb>

      {/* --- Fila de Título y Botones de Acción --- */}
      <Row justify="space-between" align="middle" style={{ marginBottom: 16 }}>
        <Col>
          <Title level={2} style={{ color: PRIMARY_BLUE, marginBottom: 0 }}>
            Monitoreo de Partículas
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
              Agregar
            </Button>
          </Space>
        </Col>
      </Row>

      {/* --- Fila de Búsqueda y Paginación --- */}
      <Row justify="space-between" align="middle" style={{ marginBottom: 16, gap: 15 }}>
        <Col flex="0 0 590px">
          <Input.Search
            allowClear
            placeholder="Buscar por puesto, observación o ubicación..."
            value={searchText}
            onChange={(e) => {
              setSearchText(e.target.value);
              setCurrentPage(1); // Resetea a página 1 al buscar
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
                setCurrentPage(1); // Resetea a página 1
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

      {/* --- Cabecera de Información (Descriptions) --- */}
      <Spin spinning={loadingHeader}>
        <Descriptions bordered size="small" column={2} style={{ marginBottom: 15 }}>
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

      {/* --- Tabla Principal --- */}
      <Spin spinning={loading}>
        <div style={{ overflowX: 'auto' }}>
          <Table
            columns={columns}
            dataSource={paginatedRegistros} // Usa los datos paginados
            rowKey="id"
            size="small"
            pagination={false} // Paginación manejada manualmente abajo
            scroll={{ x: 1500 }} // Habilita scroll horizontal
          />
        </div>
      </Spin>

      {/* --- Pie de Página (Conteo y Paginación) --- */}
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
            onChange={(p) => setCurrentPage(p)} // Cambia la página actual
            size="small"
            showSizeChanger={false} // El 'showSizeChanger' es nuestro <Select>
          />
        </Col>
      </Row>

      {/* ================================================================================= */}
      {/* MODALES */}
      {/* ================================================================================= */}
      
      {/* --- MODAL FORMULARIO (Agregar/Editar) --- */}
      <Modal
        title={selectedRegistro ? 'Editar registro de partículas' : 'Agregar registro de partículas'}
        open={isFormModalVisible}
        onOk={handleFormOk}
        onCancel={handleFormCancel}
        confirmLoading={saving} // Muestra spinner en el botón OK
        width={760}
        destroyOnClose // Destruye el formulario al cerrar para resetearlo
      >
        <Form
          form={form} // Conecta el form a la instancia del hook
          layout="vertical"
          preserve={false} // No preservar valores al destruir
          // 'key' fuerza a React a recrear el formulario (necesario para 'initialValues')
          key={selectedRegistro ? `edit-${selectedRegistro.id}` : 'add'}
          
          // --- Valores Iniciales del Formulario ---
          initialValues={
            selectedRegistro
              ? { // --- MODO EDICIÓN ---
                // ¡LÓGICA DE HORA (FORMULARIO)!
                // Muestra la hora UTC convertida a LOCAL en el input
                measured_at: selectedRegistro.measured_at
                  // ? dayjs(selectedRegistro.measured_at).local().format('YYYY-MM-DD HH:mm')
                  ? dayjs(selectedRegistro.measured_at).utc().format('YYYY-MM-DD HH:mm') // <-- CAMBIO CLAVE
                  : '',

                puesto_trabajo: selectedRegistro.puesto_trabajo,
                temperatura_c: selectedRegistro.temperatura_c
                  ? Number(selectedRegistro.temperatura_c) // Asegura que sea número
                  : undefined,
                hr_percent: selectedRegistro.hr_percent
                  ? Number(selectedRegistro.hr_percent)
                  : undefined,
                
                // Convierte arrays a string "1, 2, 3" para el input
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
                
                // Convierte array de URLs a string
                image_urls: Array.isArray(selectedRegistro.image_urls)
                  ? selectedRegistro.image_urls.join(', ')
                  : selectedRegistro.image_urls || '',
                location: selectedRegistro.location || '',
              }
              : { // --- MODO CREACIÓN ---
                // ¡MEJORA! Pre-llena la hora actual (local)
                measured_at: dayjs().utc().format('YYYY-MM-DD HH:mm'),
              }
          }
        >
          {/* --- Campos del Formulario --- */}
          <Form.Item name="measured_at" label="Hora / fecha de medición">
            {/* Un Input de texto simple. El usuario puede poner "09:15" o "2025-11-06 09:15" */}
            <Input placeholder="YYYY-MM-DD HH:mm o solo HH:mm" />
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
            <InputNumber min={-10} max={60} style={{ width: '100%' }} />
          </Form.Item>

          <Form.Item
            name="hr_percent"
            label="H.R. %"
            rules={[{ required: true, message: 'Campo obligatorio' }]}
          >
            <InputNumber min={0} max={100} style={{ width: '100%' }} />
          </Form.Item>

          <Form.Item label="Promedios (µg/m³)" style={{ marginBottom: 4 }} />
          <Row gutter={8}>
            <Col span={8}>
              <Form.Item
                name="pm10_prom"
                label="PM 10 (prom)"
                rules={[{ required: true, message: 'Campo obligatorio' }]}
              >
                <InputNumber min={0} step={0.01} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item
                name="pm25_prom"
                label="PM 2.5 (prom)"
                rules={[{ required: true, message: 'Campo obligatorio' }]}
              >
                <InputNumber min={0} step={0.01} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item
                name="pts_prom"
                label="PTS (prom)"
                rules={[{ required: true, message: 'Campo obligatorio' }]}
              >
                <InputNumber min={0} step={0.01} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item label="Valores originales (opcional) separados por coma" style={{ marginBottom: 4 }} />
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

          <Form.Item name="image_urls" label="URLs de imágenes (coma separadas)">
            <Input.TextArea rows={2} placeholder="https://... , https://..." />
          </Form.Item>

          <Form.Item name="location" label="Ubicación (texto o JSON)">
            <Input
              placeholder={'Ej: -16.5, -68.1 ó {"easting":..., "northing":..., "utm_zone":"19K"}'}
            />
          </Form.Item>
        </Form>
      </Modal>

      {/* --- MODAL VER IMÁGENES --- */}
      <Modal
        open={imageViewerOpen}
        onCancel={() => setImageViewerOpen(false)}
        footer={
          // Muestra botones de navegación solo si hay más de 1 imagen
          imageViewerList.length > 1
            ? [
                <Button
                  key="prev"
                  onClick={() =>
                    setImageViewerIndex(
                      // Lógica de carrusel (circular)
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
            : null // Sin pie de página si hay solo 1 imagen
        }
        width={720}
        title="Imagen de la medición"
      >
        {imageViewerList.length ? (
          <div style={{ textAlign: 'center' }}>
            {/* Muestra la imagen actual basada en 'imageViewerIndex' */}
            <img
              src={imageViewerList[imageViewerIndex]}
              alt="partículas"
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

// Exporta el componente para ser usado en la aplicación subido hasta aqui al GitHub hora 02:010
export default ParticulasPage;