// src/pages/ErgonomiaPage.jsx
// CORREGIDO: Todas las funciones auxiliares (exportExcel, helpers, etc.)
// se han movido DENTRO del scope del componente ErgonomiaPage
// para solucionar el 'ReferenceError'.
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
    TimePicker,
    Row,
    Col,
    Descriptions,
    Pagination,
    Divider,
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
    ToolOutlined,
    UserOutlined,
    CalendarOutlined,
    LinkOutlined,
    PaperClipOutlined,
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

// --- CONSTANTES ---
const MEDICIONES_TABLE_NAME = 'ergonomia';
const PRIMARY_BLUE = '#2a8bb6';
const MANO_AGARRE_OPTIONS = ['Derecha', 'Izquierda', 'Ambas'];
// --- FIN CONSTANTES ---

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



const ErgonomiaPage = () => {
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

    const renderLocation = (v) => {
        if (!v) return <Text type="secondary">N/A</Text>;
        if (typeof v === 'object') {
            const lat = v.lat ?? v.latitude ?? '';
            const lng = v.lng ?? v.longitude ?? '';
            if (lat !== '' || lng !== '') { return <span>lat: {lat}{lng !== '' ? `, lng: ${lng}` : ''}</span>; }
            const e = v.easting ?? '';
            const n = v.northing ?? '';
            const z = v.utm_zone ?? '';
            if (e !== '' || n !== '' || z !== '') { return <span>{`E: ${e}${n !== '' ? `, N: ${n}` : ''}${z ? `, Z: ${z}` : ''}`}</span>; }
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

    // 2) Exportar a Excel (layout profesional y sólo amarillos)
    const exportToExcel = () => {
        try {
            const B = {
                top: { style: 'thin', color: { rgb: '000000' } },
                bottom: { style: 'thin', color: { rgb: '000000' } },
                left: { style: 'thin', color: { rgb: '000000' } },
                right: { style: 'thin', color: { rgb: '000000' } },
            };

            const sTitle = { font: { bold: true, sz: 14 }, alignment: { vertical: 'center', horizontal: 'center' }, border: B };
            const sHeader = { font: { bold: true }, alignment: { vertical: 'center', horizontal: 'center' }, fill: { fgColor: { rgb: 'D9D9D9' } }, border: B };
            const sLabel = { font: { bold: true }, alignment: { vertical: 'center', horizontal: 'left' }, border: B };
            const sYellow = { alignment: { vertical: 'center', horizontal: 'left', wrapText: true }, fill: { fgColor: { rgb: 'FFF2CC' } }, border: B };
            const sGreyBar = { font: { bold: true }, alignment: { vertical: 'center', horizontal: 'center' }, fill: { fgColor: { rgb: 'BFBFBF' } }, border: B };

            const empresaNombre = headerInfo.empresa || '—';
            const fechaMonitoreo = headerInfo.fecha || '';
            const wb = XLSX.utils.book_new();

            const toUTMText = (loc) => {
                if (!loc) return '';
                try {
                    const o = typeof loc === 'string' ? JSON.parse(loc) : loc;
                    const e = o.easting ?? '';
                    const n = o.northing ?? '';
                    const z = o.utm_zone ?? '';
                    if (e || n || z) return `E: ${e}   N: ${n}   Z: ${z}`;
                    const lat = o.lat ?? o.latitude ?? '';
                    const lng = o.lng ?? o.longitude ?? '';
                    if (lat || lng) return `lat: ${lat}   lng: ${lng}`;
                    return '';
                } catch { return String(loc); }
            };

            rows.forEach((r, idx) => {
                const wsData = [];

                // Encabezado superior (logo/títulos/controles) – solo estructura
                wsData.push([{ v: 'FICHA DE INSPECCIÓN', s: sTitle }]);
                wsData.push([{ v: 'ESTUDIO DE ERGONÓMICO', s: sTitle }]);
                wsData.push([{ v: 'PACHABOL S.R.L.', s: sTitle }]);
                wsData.push(['']); // espacio

                // IDENTIFICACIÓN DE LA EMPRESA (barra gris)
                wsData.push([{ v: 'IDENTIFICACIÓN DE LA EMPRESA', s: sHeader }]);

                // Fila: Nombre / NIT / Dirección / Municipio / Departamento / UTM
                wsData.push([
                    { v: 'Nombre /Razón Social:', s: sLabel }, { v: empresaNombre, s: sYellow },
                    { v: 'NIT:', s: sLabel }, { v: '', s: sYellow },
                    { v: 'Dirección:', s: sLabel }, { v: '', s: sYellow },
                    { v: 'Municipio:', s: sLabel }, { v: '', s: sYellow },
                    { v: 'Departamento:', s: sLabel }, { v: '', s: sYellow },
                ]);

                wsData.push([
                    { v: 'Coordenadas UTM:', s: sLabel },
                    { v: toUTMText(r.location), s: sYellow },
                    { v: '', s: sLabel }, { v: '', s: sYellow },
                    { v: '', s: sLabel }, { v: '', s: sYellow },
                    { v: '', s: sLabel }, { v: '', s: sYellow },
                    { v: '', s: sLabel }, { v: '', s: sYellow },
                ]);

                // Fila: Área / Nombre trabajador
                wsData.push([
                    { v: 'Área de trabajo:', s: sLabel }, { v: r.area_trabajo || '', s: sYellow },
                    { v: 'Nombre del trabajador:', s: sLabel }, { v: r.trabajador_nombre || '', s: sYellow },
                    { v: '', s: sLabel }, { v: '', s: sYellow },
                    { v: '', s: sLabel }, { v: '', s: sYellow },
                    { v: '', s: sLabel }, { v: '', s: sYellow },
                ]);

                // Fila: Cargo / Edad / Turno / Dolencias
                wsData.push([
                    { v: 'Cargo:', s: sLabel }, { v: r.cargo || '', s: sYellow },
                    { v: 'Edad:', s: sLabel }, { v: r.edad ?? '', s: sYellow },
                    { v: 'Turno:', s: sLabel }, { v: r.turno || '', s: sYellow },
                    { v: 'Dolencias:', s: sLabel }, { v: r.dolencias || '', s: sYellow },
                    { v: '', s: sLabel }, { v: '', s: sYellow },
                ]);

                // Fila: Actividades / Peso / Altura / Antigüedad
                wsData.push([
                    { v: 'Actividades realizadas por el trabajador:', s: sLabel },
                    { v: r.actividades || '', s: sYellow },
                    { v: 'Peso:', s: sLabel }, { v: (r.peso_kg ?? ''), s: sYellow },
                    { v: 'Altura:', s: sLabel }, { v: (r.altura_m ?? ''), s: sYellow },
                    { v: 'Antigüedad:', s: sLabel }, { v: (r.antiguedad_meses ?? ''), s: sYellow },
                    { v: '', s: sLabel }, { v: '', s: sYellow },
                ]);

                // Barra gris: DATOS REGISTRADOS POR LOS EQUIPOS
                wsData.push([{ v: 'DATOS REGISTRADOS POR LOS EQUIPOS', s: sHeader }]);

                // Subencabezado: O2 / Pc / Fuerza agarre (Derecha, Izquierda)
                wsData.push([
                    { v: 'Oxígeno (O2)', s: sLabel }, { v: (r.o2 ?? ''), s: sYellow },
                    { v: 'Presión (Pc)', s: sLabel }, { v: (r.presion_pc ?? ''), s: sYellow },
                    { v: 'Fuerza de Agarre', s: sLabel }, { v: 'Derecha', s: sLabel },
                    { v: (r.mano_agarre === 'Derecha' || r.mano_agarre === 'Ambas') ? (r.fuerza_agarre_kg ?? '') : '', s: sYellow },
                    { v: 'Izquierda', s: sLabel },
                    { v: (r.mano_agarre === 'Izquierda' || r.mano_agarre === 'Ambas') ? (r.fuerza_agarre_kg ?? '') : '', s: sYellow },
                ]);

                // Barras grises de los cuadros divididos (solo estructura; NO amarillos)
                wsData.push([{ v: 'Características del ambiente de trabajo:', s: sLabel }, { v: '', s: { ...sYellow, fill: { fgColor: { rgb: 'E7E6E6' } } } }]);
                wsData.push([{ v: 'Descripción de movimientos repetitivos y postura:', s: sLabel }, { v: '', s: { ...sYellow, fill: { fgColor: { rgb: 'E7E6E6' } } } }]);

                // Barra gris: DESCRIPCIÓN DE CARGA
                wsData.push([{ v: 'DESCRIPCIÓN DE CARGA', s: sHeader }]);

                wsData.push([
                    { v: 'Peso (Kg):', s: sLabel }, { v: (r.carga_peso_kg ?? ''), s: sYellow },
                    { v: 'Agarre:', s: sLabel }, { v: r.carga_agarre || '', s: sYellow },
                ]);

                wsData.push([
                    { v: 'Frecuencia:', s: sLabel }, { v: r.carga_frecuencia || '', s: sYellow },
                    { v: 'Distancia:', s: sLabel }, { v: (r.carga_distancia_m ?? ''), s: sYellow },
                ]);

                wsData.push([
                    { v: 'Ayuda (mecanica – N° personas):', s: sLabel }, { v: r.carga_ayuda || '', s: sYellow },
                    { v: 'Descripcion de la actividad:', s: sLabel }, { v: r.carga_descripcion || '', s: sYellow },
                ]);

                // Barra gris: OBSERVACIONES
                wsData.push([{ v: 'OBSERVACIONES', s: sHeader }]);
                wsData.push([{ v: r.observaciones || '', s: sYellow }]);

                // Barra gris: CONSTANCIA
                wsData.push([{ v: 'CONSTANCIA', s: sHeader }]);

                wsData.push([
                    { v: 'Tecnico responsable', s: sLabel }, { v: 'Encargado de la empresa', s: sLabel }
                ]);

                const tecnicoNombre = usersById[r.created_by] || '';
                wsData.push([{ v: 'Nombre:', s: sLabel }, { v: tecnicoNombre, s: sYellow }, { v: 'Nombre:', s: sLabel }, { v: '', s: sYellow }]);
                wsData.push([{ v: 'Cargo:', s: sLabel }, { v: '', s: sYellow }, { v: 'Cargo:', s: sLabel }, { v: '', s: sYellow }]);
                wsData.push([{ v: 'Empresa:', s: sLabel }, { v: 'PACHABOL S.R.L.', s: sYellow }, { v: 'Empresa:', s: sLabel }, { v: empresaNombre, s: sYellow }]);
                wsData.push([{ v: 'Celular:', s: sLabel }, { v: '', s: sYellow }, { v: 'Celular:', s: sLabel }, { v: '', s: sYellow }]);

                const ws = XLSX.utils.aoa_to_sheet(wsData);

                // Ajuste de columnas (layout 10 columnas visibles)
                ws['!cols'] = [
                    { wch: 24 }, { wch: 34 },
                    { wch: 14 }, { wch: 18 },
                    { wch: 16 }, { wch: 22 },
                    { wch: 16 }, { wch: 22 },
                    { wch: 16 }, { wch: 22 },
                ];

                // Merges para títulos y bloques anchos (lo principal para que se vea igual)
                ws['!merges'] = [
                    // Títulos
                    { s: { r: 0, c: 0 }, e: { r: 0, c: 9 } },
                    { s: { r: 1, c: 0 }, e: { r: 1, c: 9 } },
                    { s: { r: 2, c: 0 }, e: { r: 2, c: 9 } },

                    // Barras de sección
                    { s: { r: 4, c: 0 }, e: { r: 4, c: 9 } }, // Identificación
                    { s: { r: 11, c: 0 }, e: { r: 11, c: 9 } }, // Datos equipos
                    { s: { r: 15, c: 0 }, e: { r: 15, c: 9 } }, // Descripción de carga
                    { s: { r: 19, c: 0 }, e: { r: 19, c: 9 } }, // Observaciones
                    { s: { r: 21, c: 0 }, e: { r: 21, c: 9 } }, // Constancia

                    // Observaciones área amplia (fila 20)
                    { s: { r: 20, c: 0 }, e: { r: 20, c: 9 } },
                ];

                XLSX.utils.book_append_sheet(wb, ws, `Reg ${idx + 1}`);
            });

            XLSX.writeFile(wb, `Ergonomia_${empresaNombre}_${fechaMonitoreo}.xlsx`);
        } catch (err) {
            console.error('Error exportando a Excel:', err);
            message.error('No se pudo exportar el Excel.');
        }
    };

    /* ---------- Cabecera (proyecto/monitoreo/equipos) ---------- */
    useEffect(() => {
        (async () => {
            setLoadingHeader(true);
            try {
                if (monitoreoId) {
                    const { data: m, error: em } = await supabase.from('monitoreos').select('id, tipo_monitoreo, proyecto_id, equipos_asignados').eq('id', monitoreoId).single();
                    if (em) throw em;
                    const { data: p } = await supabase.from('proyectos').select('id, nombre, created_at').eq('id', m.proyecto_id).single();
                    let equipos = [];
                    let ids = m.equipos_asignados;
                    if (typeof ids === 'string') { try { ids = JSON.parse(ids); } catch { ids = []; } }
                    if (Array.isArray(ids) && ids.length) {
                        const { data: eq } = await supabase .from('equipos') .select('id, nombre_equipo, modelo, serie') .in('id', ids);
                        equipos = eq || [];
                    }
                    setHeaderInfo((h) => ({ ...h, empresa: p?.nombre || '—', fecha: p?.created_at ? dayjs(p.created_at).format('DD/MM/YYYY') : '—', equipo: equipos.length ? equipos.map(e => e.nombre_equipo || 's/n').join(', ') : '', modelos: equipos.length ? equipos.map(e => e.modelo || 's/n').join(', ') : '', series: equipos.length ? equipos.map(e => e.serie || 's/n').join(', ') : '', }));
                } else if (projectId) {
                    const { data: p } = await supabase .from('proyectos') .select('id, nombre, created_at') .eq('id', projectId) .single();
                    setHeaderInfo((h) => ({ ...h, empresa: p?.nombre || '—', fecha: p?.created_at ? dayjs(p.created_at).format('DD/MM/YYYY') : '—', }));
                }
            } catch (e) { console.error('Header error:', e); } finally { setLoadingHeader(false); }
        })();
    }, [projectId, monitoreoId]);

    /* ---------- Traer filas (MODIFICADO para 'ergonomia') ---------- */
    const fetchRows = async () => {
        setLoading(true);
        try {
            let q = supabase.from(MEDICIONES_TABLE_NAME).select('*').order('inserted_at', { ascending: true });

            if (monitoreoId && projectId) { q = q.or(`monitoreo_id.eq.${monitoreoId},proyecto_id.eq.${projectId}`); }
            else if (monitoreoId) { q = q.eq('monitoreo_id', monitoreoId); }
            else if (projectId) { q = q.eq('proyecto_id', projectId); }

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
                    descripcion: r.actividades || '',
                    image_urls: imageUrls,
                };
            });

            setRows(mapped);
            setCurrentPage(1);

            if (mapped.length && mapped[0].measured_at) {
                const raw = String(mapped[0].measured_at);
                const [yyyy, mm, dd] = raw.slice(0, 10).split('-');
                setHeaderInfo((h) => ({ ...h, fecha: `${dd}/${mm}/${yyyy}` }));
            }

            const ids = Array.from(new Set(mapped.map(m => m.created_by).filter(Boolean)));
            if (ids.length) {
                const { data: profs } = await supabase .from('profiles') .select('id, username, nombre_completo, email, descripcion, rol, estado') .in('id', ids);
                const dict = {};
                (profs || []).forEach((u) => { const display = (u.nombre_completo && u.nombre_completo.trim()) || (u.username && u.username.trim()) || u.id; dict[u.id] = display; });
                setUsersById(dict);
            } else {
                setUsersById({});
            }
        } catch (e) { console.error('Fetch error:', e); message.error('No se pudo cargar Ergonomía.'); setRows([]); } 
        finally { setLoading(false); }
    };

    useEffect(() => {
        fetchRows();
        const ch = supabase
            .channel('rt-ergonomia')
            .on('postgres_changes', { event: '*', schema: 'public', table: MEDICIONES_TABLE_NAME }, (payload) => {
                fetchRows();
            })
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
            content: `Se eliminará el registro de "${rec.trabajador_nombre}"`, 
            okText: 'Eliminar', 
            okType: 'danger', 
            cancelText: 'Cancelar', onOk: async () => { 
                try { 
                    //const { error } = await supabase.from(MEDICIONES_TABLE_NAME).delete().eq('id', rec.id); 
                    //if (error) throw error; message.success('Eliminado.'); 
                    // USAMOS 'setRows' PORQUE ASI SE LLAMA TU VARIABLE
                    setRows((prevRows) => prevRows.filter((item) => item.id !== rec.id));
                    message.success('Registro eliminado.');    
                } catch (e) { 
                    message.error('No se pudo eliminar.'); 
                } 
            } 
        }); 
    };
    
        const onOkForm = () => (selected ? doEdit() : doAdd());
        const onCancelForm = () => setIsFormOpen(false);

    // 3) Hora: guardar en LOCAL con offset (sin toISOString) para evitar -4h
    const payloadFromValues = async (values) => {
        let created_by = selected ? undefined : (await supabase.auth.getUser()).data.user?.id;

        let measuredAt = null;
        if (values.horario_medicion) {
            const h = values.horario_medicion.hour();
            const m = values.horario_medicion.minute();
            const base = selected?.measured_at ? dayjs(selected.measured_at) : dayjs(); // fecha base local
            const local = base.hour(h).minute(m).second(0).millisecond(0);
            // Guardar como string con offset local (no toISOString)
            measuredAt = local.format(); // ej: 2025-11-03T01:31:00-04:00
        }

        let imageUrls = null;
        if (values.image_urls && values.image_urls.trim() !== '') {
            imageUrls = values.image_urls.split(',').map(s => s.trim()).filter(Boolean);
        }

        const payload = {
            proyecto_id: projectId || null,
            monitoreo_id: monitoreoId || null,
            measured_at: measuredAt,
            area_trabajo: values.area_trabajo,
            trabajador_nombre: values.trabajador_nombre,
            cargo: values.cargo,
            edad: values.edad,
            turno: values.turno,
            dolencias: values.dolencias,
            actividades: values.actividades,
            peso_kg: toNumberOrString(values.peso_kg),
            altura_m: toNumberOrString(values.altura_m),
            antiguedad_meses: toNumberOrString(values.antiguedad_meses),
            o2: toNumberOrString(values.o2),
            presion_pc: toNumberOrString(values.presion_pc),
            fuerza_agarre_kg: toNumberOrString(values.fuerza_agarre_kg),
            mano_agarre: values.mano_agarre,
            carga_peso_kg: toNumberOrString(values.carga_peso_kg),
            carga_agarre: values.carga_agarre,
            carga_frecuencia: values.carga_frecuencia,
            carga_distancia_m: toNumberOrString(values.carga_distancia_m),
            carga_ayuda: values.carga_ayuda,
            carga_descripcion: values.carga_descripcion,
            observaciones: values.observaciones || null,
            image_urls: imageUrls,
            location: values.location || null,
        };
        
        if (created_by && !selected) {
            payload.created_by = created_by;
        }
        
        return payload;
    };

    const doAdd = async () => {
        setSaving(true);
        try {
            const values = await form.validateFields();
            const payload = await payloadFromValues(values);
            const { error } = await supabase.from(MEDICIONES_TABLE_NAME).insert(payload);
            if (error) throw error;
            message.success('Registro agregado.');
            setIsFormOpen(false);
        } catch (e) {
            console.error('Error al agregar:', e);
            message.error('No se pudo agregar: ' + e.message);
        } finally { setSaving(false); }
    };

    const doEdit = async () => {
        setSaving(true);
        try {
            const values = await form.validateFields();
            const payload = await payloadFromValues(values);
            const { error } = await supabase.from(MEDICIONES_TABLE_NAME).update(payload).eq('id', selected.id);
            if (error) throw error;
            message.success('Registro actualizado.');
            setIsFormOpen(false);
        } catch (e) {
            console.error('Error al actualizar:', e);
            message.error('No se pudo actualizar: ' + e.message);
        } finally { setSaving(false); }
    };

    const setHoraActual = () => {
        form.setFieldsValue({ horario_medicion: dayjs() });
    };

    /* ---------- Filtro/Paginación y visor de imágenes ---------- */
    const filtered = useMemo(() => {
        if (!searchText) return rows;
        const s = searchText.toLowerCase();
        return rows.filter(r => {
            const imgs = Array.isArray(r.image_urls) ? r.image_urls.join(',') : (r.image_urls || '');
            return (
                (r.area_trabajo && r.area_trabajo.toLowerCase().includes(s)) ||
                (r.trabajador_nombre && r.trabajador_nombre.toLowerCase().includes(s)) ||
                (r.cargo && r.cargo.toLowerCase().includes(s)) ||
                (r.actividades && r.actividades.toLowerCase().includes(s)) ||
                (r.observaciones && r.observaciones.toLowerCase().includes(s))
            );
        });
    }, [searchText, rows]);
    const totalFiltered = filtered.length;
    const pageData = useMemo(() => { const start = (currentPage - 1) * pageSize; return filtered.slice(start, start + pageSize); }, [filtered, currentPage, pageSize]);
    const openImageViewer = (imgs, idx = 0) => { const list = Array.isArray(imgs) ? imgs : []; if (!list.length) return; setImageViewerList(list); setImageViewerIndex(idx); setImageViewerOpen(true); };

    /* ========================= COLUMNAS TABLA (MODIFICADO) ========================= */
    const columns = [
        { 
            title: 'N°', 
            key: 'n', 
            width: 60, 
            fixed: 'left', render: (_, __, i) => (currentPage - 1) * pageSize + i + 1, 
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
            title: 'Área de Trabajo', 
            dataIndex: 'area_trabajo', 
            key: 'area_trabajo', 
            width: 150, 
            ellipsis: true 
        },
        { 
            title: 'Nombre del Trabajador', 
            dataIndex: 'trabajador_nombre', 
            key: 'trabajador_nombre', 
            width: 200, 
            ellipsis: true 
        },
        
        { title: 'Edad', dataIndex: 'edad', key: 'edad', width: 80 },
        { title: 'Turno', dataIndex: 'turno', key: 'turno', width: 100, ellipsis: true },
        { title: 'Dolencias', dataIndex: 'dolencias', key: 'dolencias', width: 200, ellipsis: true },
        { title: 'Actividades', dataIndex: 'actividades', key: 'actividades', width: 250, ellipsis: true },
        { title: 'Peso (Kg)', dataIndex: 'peso_kg', key: 'peso_kg', width: 90 },
        { title: 'Altura (m)', dataIndex: 'altura_m', key: 'altura_m', width: 90 },
        { title: 'Antigüedad (meses)', dataIndex: 'antiguedad_meses', key: 'antiguedad_meses', width: 100 },
        { title: 'O2', dataIndex: 'o2', key: 'o2', width: 80 },
        { title: 'Presión (Pc)', dataIndex: 'presion_pc', key: 'presion_pc', width: 80 },
        { title: 'Fuerza Agarre (Kg)', dataIndex: 'fuerza_agarre_kg', key: 'fuerza_agarre_kg', width: 100 },
        { title: 'Mano Agarre', dataIndex: 'mano_agarre', key: 'mano_agarre', width: 100 },
        { title: 'Carga: Peso (Kg)', dataIndex: 'carga_peso_kg', key: 'carga_peso_kg', width: 100 },
        { title: 'Carga: Agarre', dataIndex: 'carga_agarre', key: 'carga_agarre', width: 150, ellipsis: true },
        { title: 'Carga: Frecuencia', dataIndex: 'carga_frecuencia', key: 'carga_frecuencia', width: 150, ellipsis: true },
        { title: 'Carga: Distancia (m)', dataIndex: 'carga_distancia_m', key: 'carga_distancia_m', width: 100 },
        { title: 'Carga: Ayuda', dataIndex: 'carga_ayuda', key: 'carga_ayuda', width: 150, ellipsis: true },
        { title: 'Carga: Descripción', dataIndex: 'carga_descripcion', key: 'carga_descripcion', width: 250, ellipsis: true },
        { title: 'Imágenes', dataIndex: 'image_urls', key: 'image_urls', width: 120, render: (imgs) => { const list = Array.isArray(imgs) ? imgs : []; if (!list.length) return <Text type="secondary">Ninguna</Text>; return ( <Button type="link" icon={<EyeOutlined />} onClick={() => openImageViewer(list, 0)} size="small" > Ver imagen </Button> ); }, },
        { title: 'Ubicación', dataIndex: 'location', key: 'location', width: 180, render: (v) => renderLocation(v), },
        { title: 'Observaciones', dataIndex: 'observaciones', key: 'observaciones', ellipsis: true, width: 240, },
        { title: 'Registrado por', dataIndex: 'created_by', key: 'created_by', width: 120, fixed: 'right', ellipsis: true, render: (v) => { if (!v) return <Text type="secondary">N/A</Text>; const display = usersById[v]; return display ? <Tooltip title={display}>{display}</Tooltip> : <Text type="secondary">{v.slice(0, 8)}...</Text>; }, },
        { 
            title: 'Acciones', 
            key: 'acciones', 
            width: 100, 
            fixed: 'right', render: (_, record) => ( 
            <Space size="small"> 
                <Tooltip title="Editar">
                    <Button shape="circle" icon={<EditOutlined />} onClick={() => handleEdit(record)} />
                </Tooltip> 
                <Tooltip title="Eliminar">
                    <Button danger shape="circle" icon={<DeleteOutlined />} onClick={() => handleDelete(record)} />
                </Tooltip> 
            </Space> ), 
        },
    ];

    /* ---------- Render ---------- */
    return (
        <>
            <Breadcrumb style={{ margin: '16px 0' }}>
                <Breadcrumb.Item><Link to="/"><HomeOutlined /></Link></Breadcrumb.Item>
                <Breadcrumb.Item><Link to="/proyectos">Proyectos</Link></Breadcrumb.Item>
                <Breadcrumb.Item><Link to={`/proyectos/${projectId}/monitoreo`}><DatabaseOutlined /> Monitoreos</Link></Breadcrumb.Item>
                <Breadcrumb.Item>Ergonomía</Breadcrumb.Item>
            </Breadcrumb>

            <Row justify="space-between" align="middle" style={{ marginBottom: 8 }}>
                <Col>
                    <Title level={2} style={{ color: PRIMARY_BLUE, marginBottom: 0 }}>Monitoreo de Ergonomía</Title>
                </Col>
                <Col>
                    <Space>
                        <Button onClick={() => navigate(`/proyectos/${projectId}/monitoreo`)}><ArrowLeftOutlined /> Volver</Button>
                        <Button icon={<FileExcelOutlined />} onClick={exportToExcel} loading={loading}>Exportar</Button>
                        <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>Agregar</Button>
                    </Space>
                </Col>
            </Row>

            {/* buscador + selector */}
            <Row justify="space-between" align="middle" style={{ marginBottom: 12, gap: 15 }}>
                <Col flex="0 0 520px">
                    <Input.Search
                        allowClear
                        placeholder="Buscar por área, trabajador, cargo, actividades..."
                        value={searchText}
                        onChange={(e) => { setSearchText(e.target.value); setCurrentPage(1); }}
                    />
                </Col>
                <Col>
                    <Space>
                        <Text type="secondary">Ver:</Text>
                        <Select value={pageSize} onChange={(val) => { setPageSize(val); setCurrentPage(1); }} style={{ width: 90 }} >
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
                        scroll={{ x: 2000 }}
                    />
                </div>
            </Spin>

            {/* Pie paginación */}
            <Row justify="space-between" align="middle" style={{ marginTop: 12 }}>
                <Col>
                    {(() => { const mostrados = Math.min(currentPage * pageSize, totalFiltered); return <Text type="secondary">Registros {mostrados} de {totalFiltered}</Text>; })()}
                </Col>
                <Col>
                    <Pagination current={currentPage} pageSize={pageSize} total={totalFiltered} onChange={(p) => setCurrentPage(p)} size="small" showSizeChanger={false} />
                </Col>
            </Row>

            {/* MODAL FORM */}
            <Modal
                title={selected ? 'Editar Registro de Ergonomía' : 'Agregar Registro de Ergonomía'}
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
                            ...selected,
                            // ✅ Hora local al cargar para evitar desfase
                            horario_medicion: selected.measured_at ? dayjs(selected.measured_at).local() : null,
                            actividades: selected.actividades || '',
                            image_urls: Array.isArray(selected.image_urls) ? selected.image_urls.join(', ') : (selected.image_urls || ''),
                            location: typeof selected.location === 'object' ? JSON.stringify(selected.location) : (selected.location || ''),
                          }
                        : { }
                    }
                >
                    <Divider orientation="left">Datos del Trabajador</Divider>
                    <Row gutter={12}>
                        <Col span={12}><Form.Item name="area_trabajo" label="Área de trabajo" rules={[{ required: true }]}><Input /></Form.Item></Col>
                        <Col span={12}><Form.Item name="trabajador_nombre" label="Nombre del trabajador" rules={[{ required: true }]}><Input /></Form.Item></Col>
                    </Row>
                    <Row gutter={12}>
                        <Col span={8}><Form.Item name="cargo" label="Cargo"><Input /></Form.Item></Col>
                        <Col span={8}><Form.Item name="edad" label="Edad"><InputNumber min={18} style={{ width: '100%' }} /></Form.Item></Col>
                        <Col span={8}><Form.Item name="turno" label="Turno"><Input /></Form.Item></Col>
                    </Row>
                    <Row gutter={12}>
                        <Col span={8}><Form.Item name="peso_kg" label="Peso (Kg)"><InputNumber min={0} step={0.1} style={{ width: '100%' }} /></Form.Item></Col>
                        <Col span={8}><Form.Item name="altura_m" label="Altura (m)"><InputNumber min={0} step={0.01} style={{ width: '100%' }} /></Form.Item></Col>
                        <Col span={8}><Form.Item name="antiguedad_meses" label="Antigüedad (meses)"><InputNumber min={0} style={{ width: '100%' }} /></Form.Item></Col>
                    </Row>
                    <Form.Item name="actividades" label="Actividades realizadas por el trabajado">
                        <Input.TextArea rows={2} />
                    </Form.Item>
                    <Form.Item name="dolencias" label="Dolencias">
                        <Input />
                    </Form.Item>

                    <Divider orientation="left">Datos Registrados (Equipos)</Divider>
                    <Row gutter={12}>
                        <Col span={8}><Form.Item name="o2" label="Oxígeno (O2)"><InputNumber style={{ width: '100%' }} /></Form.Item></Col>
                        <Col span={8}><Form.Item name="presion_pc" label="Presión (Pc)"><InputNumber style={{ width: '100%' }} /></Form.Item></Col>
                        <Col span={8}><Form.Item name="horario_medicion" label="Hora de medición" rules={[{ required: true }]}><Space.Compact style={{ width: '100%' }}><TimePicker format="HH:mm" style={{ flex: 1 }} /><Tooltip title="Usar hora actual"><Button icon={<ClockCircleOutlined />} onClick={setHoraActual} /></Tooltip></Space.Compact></Form.Item></Col>
                    </Row>
                    <Row gutter={12}>
                        <Col span={12}><Form.Item name="fuerza_agarre_kg" label="Fuerza de Agarre (Kg)"><InputNumber min={0} style={{ width: '100%' }} /></Form.Item></Col>
                        <Col span={12}><Form.Item name="mano_agarre" label="Mano (Agarre)"><Select placeholder="Seleccionar mano">{MANO_AGARRE_OPTIONS.map(o => <Option key={o} value={o}>{o}</Option>)}</Select></Form.Item></Col>
                    </Row>
                    
                    <Divider orientation="left">Descripción de Carga</Divider>
                    <Row gutter={12}>
                        <Col span={8}><Form.Item name="carga_peso_kg" label="Peso (Kg)"><InputNumber min={0} style={{ width: '100%' }} /></Form.Item></Col>
                        <Col span={8}><Form.Item name="carga_frecuencia" label="Frecuencia"><Input /></Form.Item></Col>
                        <Col span={8}><Form.Item name="carga_distancia_m" label="Distancia (m)"><InputNumber min={0} style={{ width: '100%' }} /></Form.Item></Col>
                    </Row>
                    <Row gutter={12}>
                        <Col span={12}><Form.Item name="carga_agarre" label="Agarre"><Input /></Form.Item></Col>
                        <Col span={12}><Form.Item name="carga_ayuda" label="Ayuda (mecanica - N° personas)"><Input /></Form.Item></Col>
                    </Row>
                    <Form.Item name="carga_descripcion" label="Descripción de la actividad (Carga)">
                        <Input.TextArea rows={2} />
                    </Form.Item>

                    <Divider orientation="left">Otros</Divider>
                    <Form.Item name="image_urls" label="URLs de imágenes (coma separadas)">
                        <Input.TextArea rows={2} placeholder="https://..., https://..." />
                    </Form.Item>
                    <Form.Item name="location" label="COORDENADAS UTM (texto/JSON)">
                        <Input placeholder='Ej: {"easting":585326.65,"northing":8169066.21,"utm_zone":"19K"}' />
                    </Form.Item>
                    <Form.Item name="observaciones" label="Observaciones">
                        <Input.TextArea rows={3} />
                    </Form.Item>
                </Form>
            </Modal>

            {/* Visor de imágenes */}
            <Modal open={imageViewerOpen} onCancel={() => setImageViewerOpen(false)} footer={
                imageViewerList.length > 1 ? [
                    <Button key="prev" onClick={() => setImageViewerIndex((prev) => (prev - 1 + imageViewerList.length) % imageViewerList.length)}>Anterior</Button>,
                    <Button key="next" type="primary" onClick={() => setImageViewerIndex((prev) => (prev + 1) % imageViewerList.length)}>Siguiente</Button>,
                ] : null
            } width={720} title="Imagen del registro">
                {imageViewerList.length ? (
                    <div style={{ textAlign: 'center' }}>
                        <img src={imageViewerList[imageViewerIndex]} alt="registro" style={{ maxWidth: '100%', maxHeight: '60vh', objectFit: 'contain' }} />
                        <div style={{ marginTop: 8 }}>{imageViewerIndex + 1} / {imageViewerList.length}</div>
                    </div>
                ) : (
                    <Text type="secondary">Sin imagen.</Text>
                )}
            </Modal>
        </>
    );
};

export default ErgonomiaPage;
