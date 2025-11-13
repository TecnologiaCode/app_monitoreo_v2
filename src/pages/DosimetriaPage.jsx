// src/pages/DosimetriaPage.jsx
// CORREGIDO: Añadidas columnas Fecha/Hora y corregida paginación en N°
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
    Switch,
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

dayjs.extend(utc);
dayjs.extend(timezone);

const { Title, Text } = Typography;
const { Option } = Select;

// --- CONSTANTES ---
const MEDICIONES_TABLE_NAME = 'dosimetria';
const PRIMARY_BLUE = '#2a8bb6';
const PONDERACION_OPTIONS = ['A', 'C', 'Z'];
const RESPUESTA_OPTIONS = ['Rápido', 'Lento', 'Impulso'];
// --- FIN CONSTANTES ---

const DosimetriaPage = () => {
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

    const exportToExcel = () => {
        // ... (La lógica de exportar a Excel no se ha modificado) ...
        try {
            const empresaNombre = headerInfo.empresa || '—';
            const fechaMonitoreo = headerInfo.fecha || '';
            const headerEquipos = headerInfo.equipo || 'N/A';
            const headerModelos = headerInfo.modelos || 'N/A';
            const headerSeries = headerInfo.series || 'N/A';
            const B = { top: { style: 'thin' }, bottom: { style: 'thin' }, left: { style: 'thin' }, right: { style: 'thin' } };
            const th = { font: { bold: true }, alignment: { vertical: 'center', horizontal: 'center', wrapText: true }, fill: { fgColor: { rgb: "D9D9D9" } }, border: B };
            const thL = { font: { bold: true }, alignment: { vertical: 'center', horizontal: 'left' }, border: B };
            const tdL = { alignment: { vertical: 'center', horizontal: 'left', wrapText: true }, border: B };
            const tdC = { alignment: { vertical: 'center', horizontal: 'center', wrapText: true }, border: B };
            const wb = XLSX.utils.book_new();
            rows.forEach((r, i) => {
                const wsData = [];
                wsData.push([{ v: 'FICHA DE INSPECCIÓN - ESTUDIO DE DOSIMETRÍA', s: { font: { bold: true, sz: 14 }, alignment: { vertical: 'center', horizontal: 'center' } } }]);
                wsData.push([]);
                wsData.push([{ v: 'IDENTIFICACIÓN DE LA EMPRESA', s: th }]);
                wsData.push([{ v: 'NOMBRE DE LA EMPRESA', s: thL }, { v: empresaNombre, s: tdL }, { v: 'EQUIPO', s: thL }, { v: headerEquipos, s: tdL },]);
                wsData.push([{ v: 'AREA DE TRABAJO', s: thL }, { v: r.area_trabajo || '', s: tdL }, { v: 'MODELO DEL EQUIPO', s: thL }, { v: headerModelos, s: tdL },]);
                wsData.push([{ v: 'FECHA DE MONITOREO', s: thL }, { v: r.fecha_medicion || fechaMonitoreo, s: tdL }, { v: 'SERIE DEL EQUIPO', s: thL }, { v: headerSeries, s: tdL },]);
                wsData.push([{ v: 'HORA DE MONITOREO', s: thL }, { v: r.hora_medicion || '', s: tdL }, { v: '', s: tdL }, { v: '', s: tdL },]);
                wsData.push(['']);
                
                wsData.push([{ v: 'DATOS DE LA MEDICIÓN', s: th }]);
                wsData.push([{ v: 'Area de Trabajo', s: thL }, { v: r.area, s: tdL }, { v: '', s: thL }, { v: '', s: tdC }]);
                wsData.push([{ v: 'Actividad', s: thL }, { v: r.actividad, s: tdL }, { v: '', s: thL }, { v: '', s: tdC }]);
                wsData.push([{ v: 'Maquinaria/Equipo', s: thL }, { v: r.maquinaria_equipo, s: tdL }, { v: '', s: thL }, { v: '', s: tdC }]);
                wsData.push([{ v: 'Punto de Medición', s: thL }, { v: r.punto_medicion, s: tdL }, { v: 'LEQ (dB)', s: thL }, { v: r.leq_db, s: tdC }]);
               
                wsData.push([{ v: 'Tiempo Expos. (h)', s: thL }, { v: r.tiempo_expos_h, s: tdC }, { v: 'LMax (dB)', s: thL }, { v: r.lmx_db, s: tdC }]);
                wsData.push([{ v: 'Ponderación', s: thL }, { v: r.ponderacion, s: tdC }, { v: 'PMax (dB)', s: thL }, { v: r.pmx_db, s: tdC }]);
                wsData.push([{ v: 'Respuesta', s: thL }, { v: r.respuesta, s: tdC }, { v: 'PLx (dB)', s: thL }, { v: r.plx_db, s: tdC }]);
                wsData.push([{ v: 'Duración Med. (h)', s: thL }, { v: r.duracion_medicion_h, s: tdC }, { v: 'LEX (dB)', s: thL }, { v: r.lex_db, s: tdC }]);
                wsData.push([{ v: 'Uso Protectores', s: thL }, { v: r.uso_protectores ? 'Sí' : 'No', s: tdC }, { v: 'LE (dB)', s: thL }, { v: r.le_db, s: tdC }]);
                wsData.push([{ v: 'Tipo Protector', s: thL }, { v: r.tipo_protector || '', s: tdL }, { v: '', s: tdL }, { v: '', s: tdL }]);
                wsData.push([{ v: 'Observaciones', s: thL }, { v: r.observaciones || '', s: tdL }, { v: '', s: tdL }, { v: '', s: tdL }]);
                const ws = XLSX.utils.aoa_to_sheet(wsData);
                ws['!cols'] = [{ wch: 20 }, { wch: 30 }, { wch: 20 }, { wch: 20 }];
                ws['!merges'] = [
                    { s: { r: 0, c: 0 }, e: { r: 0, c: 3 } },
                    { s: { r: 2, c: 0 }, e: { r: 2, c: 3 } },
                    { s: { r: 7, c: 0 }, e: { r: 7, c: 3 } },
                    { s: { r: 15, c: 0 }, e: { r: 15, c: 3 } },
                ];
                XLSX.utils.book_append_sheet(wb, ws, `Reg ${i + 1} (${r.punto_medicion || 's/n'})`);
            });
            XLSX.writeFile(wb, `Reporte_Dosimetria_${empresaNombre}.xlsx`);
        } catch (err) { console.error('Error exportando a Excel:', err); message.error('No se pudo exportar el Excel.'); }
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
                        const { data: eq } = await supabase.from('equipos').select('id, nombre_equipo, modelo, serie').in('id', ids);
                        equipos = eq || [];
                    }
                    setHeaderInfo((h) => ({ ...h, empresa: p?.nombre || '—', fecha: p?.created_at ? dayjs(p.created_at).format('DD/MM/YYYY') : '—', equipo: equipos.length ? equipos.map(e => e.nombre_equipo || 's/n').join(', ') : '', modelos: equipos.length ? equipos.map(e => e.modelo || 's/n').join(', ') : '', series: equipos.length ? equipos.map(e => e.serie || 's/n').join(', ') : '', }));
                } else if (projectId) {
                    const { data: p } = await supabase.from('proyectos').select('id, nombre, created_at').eq('id', projectId).single();
                    setHeaderInfo((h) => ({ ...h, empresa: p?.nombre || '—', fecha: p?.created_at ? dayjs(p.created_at).format('DD/MM/YYYY') : '—', }));
                }
            } catch (e) { console.error('Header error:', e); } finally { setLoadingHeader(false); }
        })();
    }, [projectId, monitoreoId]);

    /* ---------- Traer filas (MODIFICADO para 'dosimetria' y añadir fecha/hora) ---------- */
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

                // --- AÑADIDO: Mapeo de Fecha y Hora ---
                let fecha_medicion = '';
                let hora_medicion = '';
                if (r.measured_at) {
                    const localTime = dayjs(r.measured_at).utc();
                    if (localTime.isValid()) {
                        fecha_medicion = localTime.format('DD/MM/YYYY');
                        hora_medicion = localTime.format('HH:mm');
                    }
                }
                // --- FIN AÑADIDO ---

                return {
                    ...r,
                    descripcion: r.observaciones, // Mapeo para el form
                    image_urls: imageUrls,
                    fecha_medicion: fecha_medicion, // <-- Añadido
                    hora_medicion: hora_medicion,   // <-- Añadido
                };
            });

            setRows(mapped);
            setCurrentPage(1);

            // Ajustar fecha/hora de cabecera con la primera fila
            if (mapped.length && mapped[0].measured_at) {
                setHeaderInfo((h) => ({
                    ...h,
                    fecha: mapped[0].fecha_medicion,
                    hora: mapped[0].hora_medicion
                }));
            }

            const ids = Array.from(new Set(mapped.map(m => m.created_by).filter(Boolean)));
            if (ids.length) {
                const { data: profs } = await supabase.from('profiles').select('id, username, nombre_completo, email, descripcion, rol, estado').in('id', ids);
                const dict = {};
                (profs || []).forEach((u) => { const display = (u.nombre_completo && u.nombre_completo.trim()) || (u.username && u.username.trim()) || u.id; dict[u.id] = display; });
                setUsersById(dict);
            } else {
                setUsersById({});
            }
        } catch (e) { console.error('Fetch error:', e); message.error('No se pudo cargar Dosimetría.'); setRows([]); }
        finally { setLoading(false); }
    };

    // useEffect Realtime (MODIFICADO para 'dosimetria')
    useEffect(() => {
        fetchRows();
        const ch = supabase
            .channel('rt-dosimetria') // Canal único
            .on('postgres_changes', { event: '*', schema: 'public', table: MEDICIONES_TABLE_NAME }, (payload) => {
                console.log('RT: cambio en dosimetria', payload);
                fetchRows(); // Recarga simple
            })
            .subscribe();
        return () => supabase.removeChannel(ch);
    }, [projectId, monitoreoId]);

    /* ---------- CRUD ---------- */
    const handleAdd = () => { setSelected(null); setIsFormOpen(true); };
    const handleEdit = (rec) => { setSelected(rec); setIsFormOpen(true); };
    const handleDelete = (rec) => { Modal.confirm({ title: '¿Eliminar registro?', icon: <ExclamationCircleOutlined />, content: `Se eliminará el registro de "${rec.punto_medicion}"`, okText: 'Eliminar', okType: 'danger', cancelText: 'Cancelar', onOk: async () => { try { const { error } = await supabase.from(MEDICIONES_TABLE_NAME).delete().eq('id', rec.id); if (error) throw error; message.success('Eliminado.'); } catch (e) { message.error('No se pudo eliminar.'); } } }); };
    const onOkForm = () => (selected ? doEdit() : doAdd());
    const onCancelForm = () => { setIsFormOpen(false); setSelected(null); };

    // Mapea los valores del formulario a la estructura de la DB 'dosimetria'
    const payloadFromValues = async (values) => {

        let created_by = selected ? undefined : (await supabase.auth.getUser()).data.user?.id;

        let measuredAt = null;
        if (values.horario_medicion) {
            measuredAt = values.horario_medicion.toISOString();
        }

        let imageUrls = null;
        if (values.image_urls && values.image_urls.trim() !== '') {
            imageUrls = values.image_urls.split(',').map(s => s.trim()).filter(Boolean);
        }

        const payload = {
            proyecto_id: projectId || null,
            monitoreo_id: monitoreoId || null,
            measured_at: measuredAt,
            punto_medicion: values.punto_medicion,
            tiempo_expos_h: toNumberOrString(values.tiempo_expos_h),
            ponderacion: values.ponderacion,
            respuesta: values.respuesta,
            duracion_medicion_h: toNumberOrString(values.duracion_medicion_h),
            leq_db: toNumberOrString(values.leq_db),
            lmx_db: toNumberOrString(values.lmx_db),
            pmx_db: toNumberOrString(values.pmx_db),
            plx_db: toNumberOrString(values.plx_db),
            lex_db: toNumberOrString(values.lex_db),
            le_db: toNumberOrString(values.le_db),
            uso_protectores: values.uso_protectores,
            tipo_protector: values.tipo_protector,
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
        return rows.filter(r =>
            (r.punto_medicion && r.punto_medicion.toLowerCase().includes(s)) ||
            (r.tipo_protector && r.tipo_protector.toLowerCase().includes(s)) ||
            (r.observaciones && r.observaciones.toLowerCase().includes(s))
        );
    }, [searchText, rows]);
    const totalFiltered = filtered.length;
    const pageData = useMemo(() => { const start = (currentPage - 1) * pageSize; return filtered.slice(start, start + pageSize); }, [filtered, currentPage, pageSize]);
    const openImageViewer = (imgs, idx = 0) => { const list = Array.isArray(imgs) ? imgs : []; if (!list.length) return; setImageViewerList(list); setImageViewerIndex(idx); setImageViewerOpen(true); };

    /* ========================= COLUMNAS TABLA (MODIFICADO) ========================= */
    const columns = [
        // --- CORREGIDO: Error de paginación en N° ---
        {
            title: 'N°',
            key: 'n',
            width: 60,
            fixed: 'left',
            render: (_, __, i) => (currentPage - 1) * pageSize + i + 1, // <-- Fórmula corregida
        },

        // --- AÑADIDO: Columna Fecha ---
        {
            title: 'Fecha',
            dataIndex: 'fecha_medicion',
            key: 'fecha_medicion',

            // ✅ Permite ordenar ascendente/descendente por fecha
            sorter: (a, b) => dayjs(a.measured_at).unix() - dayjs(b.measured_at).unix(),
            defaultSortOrder: 'descend',
            width: 120, render: (t) => formatFechaUTC(t),
        },
        // --- FIN AÑADIDO ---

        {
            title: 'Hora',
            dataIndex: 'hora_medicion',
            key: 'hora_medicion',
            sorter: (a, b) => {
                // Comparar directamente las horas (string "HH:mm")
                const t1 = a.hora_medicion ? a.hora_medicion.replace(':', '') : 0;
                const t2 = b.hora_medicion ? b.hora_medicion.replace(':', '') : 0;
                return parseInt(t1) - parseInt(t2);
            },
            width: 110,
            render: (t) => t || <Text type="secondary">—</Text>
        },
        // --- FIN MODIFICACIÓN ---

        // --- COLUMNAS ADICIONAS ---
         { title: 'Area de Trabajo', 
            dataIndex: 'area', 
            key: 'area', 
            width: 120, 
            ellipsis: true, 
            
        },

         { title: 'Actividad', 
            dataIndex: 'actividad', 
            key: 'actividad', 
            width: 100, 
            ellipsis: true, 
             
        },

         { title: 'Maquinaria/Equipo', 
            dataIndex: 'maquinaria_equipo', 
            key: 'maquinaria_equipo', 
            width: 200, 
            ellipsis: true, 
            
        },

        //---------------

        { 
            title: 'Punto de Medición', 
            dataIndex: 'punto_medicion', 
            key: 'punto_medicion', 
            width: 150, 
            ellipsis: true, 
        },

        { title: 'T. Expos. (h)', 
            dataIndex: 'tiempo_expos_h', 
            key: 'tiempo_expos_h', 
            width: 100 
        },
        { title: 'Pond.', 
            dataIndex: 'ponderacion', key: 'ponderacion', width: 80 },
        { title: 'Resp.', dataIndex: 'respuesta', key: 'respuesta', width: 100 },
        { title: 'Dur. Med. (h)', dataIndex: 'duracion_medicion_h', key: 'duracion_medicion_h', width: 100 },
        { title: 'LEQ (dB)', dataIndex: 'leq_db', key: 'leq_db', width: 90 },
        { title: 'LMax (dB)', dataIndex: 'lmx_db', key: 'lmx_db', width: 90 },
        { title: 'PMax (dB)', dataIndex: 'pmx_db', key: 'pmx_db', width: 90 },
        { title: 'PLx (dB)', dataIndex: 'plx_db', key: 'plx_db', width: 90 },
        { title: 'LEX (dB)', dataIndex: 'lex_db', key: 'lex_db', width: 90 },
        { title: 'LE (dB)', dataIndex: 'le_db', key: 'le_db', width: 90 },
        { title: 'Usa Protectores', dataIndex: 'uso_protectores', key: 'uso_protectores', width: 130, render: (val) => (val ? <Tag color="green">Sí</Tag> : <Tag color="red">No</Tag>) },
        { title: 'Tipo Protector', dataIndex: 'tipo_protector', key: 'tipo_protector', width: 200, ellipsis: true },
        { title: 'Imágenes', dataIndex: 'image_urls', key: 'image_urls', width: 120, render: (imgs) => { const list = Array.isArray(imgs) ? imgs : []; if (!list.length) return <Text type="secondary">Ninguna</Text>; return (<Button type="link" icon={<EyeOutlined />} onClick={() => openImageViewer(list, 0)} size="small" > Ver imagen </Button>); }, },
        { title: 'Ubicación', dataIndex: 'location', key: 'location', width: 180, render: (v) => renderLocation(v), },
        { title: 'Observaciones', dataIndex: 'observaciones', key: 'observaciones', ellipsis: true, width: 240, },
        { title: 'Registrado por', dataIndex: 'created_by', key: 'created_by', width: 190, fixed: 'right', ellipsis: true, render: (v) => { if (!v) return <Text type="secondary">N/A</Text>; const display = usersById[v]; return display ? <Tooltip title={display}>{display}</Tooltip> : <Text type="secondary">{v.slice(0, 8)}...</Text>; }, },
        { title: 'Acciones', key: 'acciones', width: 100, fixed: 'right', render: (_, record) => (<Space size="small"> <Tooltip title="Editar"><Button shape="circle" icon={<EditOutlined />} onClick={() => handleEdit(record)} /></Tooltip> <Tooltip title="Eliminar"><Button danger shape="circle" icon={<DeleteOutlined />} onClick={() => handleDelete(record)} /></Tooltip> </Space>), },
    ];
    // --- FIN COLUMNAS ---

    /* ---------- Render ---------- */
    return (
        <>
            <Breadcrumb style={{ margin: '16px 0' }}>
                <Breadcrumb.Item><Link to="/"><HomeOutlined /></Link></Breadcrumb.Item>
                <Breadcrumb.Item><Link to="/proyectos">Proyectos</Link></Breadcrumb.Item>
                <Breadcrumb.Item><Link to={`/proyectos/${projectId}/monitoreo`}><DatabaseOutlined /> Monitoreos</Link></Breadcrumb.Item>
                <Breadcrumb.Item>Dosimetría</Breadcrumb.Item>
            </Breadcrumb>

            <Row justify="space-between" align="middle" style={{ marginBottom: 8 }}>
                <Col>
                    <Title level={2} style={{ color: PRIMARY_BLUE, marginBottom: 0 }}>Monitoreo de Dosimetría</Title>
                </Col>
                <Col>
                    <Space>
                        <Button onClick={() => navigate(`/proyectos/${projectId}/monitoreo`)}><ArrowLeftOutlined /> Volver</Button>
                        <Button icon={<FileExcelOutlined />} onClick={() => exportToExcel(rows, headerInfo, usersById)} loading={loading}>Exportar</Button>
                        <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>Agregar</Button>
                    </Space>
                </Col>
            </Row>

            {/* buscador + selector */}
            <Row justify="space-between" align="middle" style={{ marginBottom: 12, gap: 15 }}>
                <Col flex="0 0 520px">
                    <Input.Search
                        allowClear
                        placeholder="Buscar por punto de medición, protector, observaciones..."
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
                        size="small"
                        columns={columns}
                        dataSource={pageData}
                        rowKey="id"
                        pagination={false}
                        scroll={{ x: 2200 }} // Ajustado para nuevas columnas
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

            {/* MODAL FORM (MODIFICADO para 'dosimetria') */}
            <Modal
                title={selected ? 'Editar Dosimetría' : 'Agregar Dosimetría'}
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
                            ? { // Mapeo Inverso (DB -> Form)
                                ...selected,
                                horario_medicion: selected.measured_at ? dayjs(selected.measured_at).utc().local() : null,
                                image_urls: Array.isArray(selected.image_urls) ? selected.image_urls.join(', ') : (selected.image_urls || ''),
                                location: typeof selected.location === 'object' ? JSON.stringify(selected.location) : (selected.location || ''),
                                // 'descripcion' no está en este form, usamos 'observaciones'
                            }
                            : { // Valores por defecto para Add
                                ponderacion: 'A',
                                respuesta: 'Rápido',
                                uso_protectores: false,
                            }
                    }
                >
                    <Row gutter={16}>
                        <Col span={12}><Form.Item name="punto_medicion" label="Punto de Medición / Trabajador" rules={[{ required: true }]}><Input placeholder="Ej: Taller 1 / Juan Perez" /></Form.Item></Col>
                        <Col span={12}>
                            <Form.Item name="horario_medicion"
                                label="Hora de medición"
                                rules={[{ required: true }]}><Space.Compact
                                    style={{ width: '100%' }}><TimePicker
                                        format="HH:mm"
                                        style={{ flex: 1 }} />
                                    <Tooltip title="Usar hora actual">
                                        <Button icon={<ClockCircleOutlined />}
                                            onClick={setHoraActual} />
                                    </Tooltip></Space.Compact></Form.Item></Col>
                    </Row>

                    <Divider orientation="left">Configuración de Medición</Divider>
                    <Row gutter={16}>
                        <Col span={8}><Form.Item name="tiempo_expos_h" label="Tiempo Expos. (h)" rules={[{ required: true }]}><InputNumber min={0} step={0.1} style={{ width: '100%' }} placeholder="8" /></Form.Item></Col>
                        <Col span={8}><Form.Item name="ponderacion" label="Ponderación" rules={[{ required: true }]}><Select>{PONDERACION_OPTIONS.map(o => <Option key={o} value={o}>{o}</Option>)}</Select></Form.Item></Col>
                        <Col span={8}><Form.Item name="respuesta" label="Respuesta" rules={[{ required: true }]}><Select>{RESPUESTA_OPTIONS.map(o => <Option key={o} value={o}>{o}</Option>)}</Select></Form.Item></Col>
                    </Row>
                    <Form.Item name="duracion_medicion_h" label="Duración Medición (h)" rules={[{ required: true }]}><InputNumber min={0} step={0.1} style={{ width: '100%' }} placeholder="1.5" /></Form.Item>

                    <Divider orientation="left">Resultados (dB)</Divider>
                    <Row gutter={16}>
                        <Col span={8}><Form.Item name="leq_db" label="LEQ (dB)" rules={[{ required: true }]}><InputNumber style={{ width: '100%' }} /></Form.Item></Col>
                        <Col span={8}><Form.Item name="lmx_db" label="LMax (dB)" rules={[{ required: true }]}><InputNumber style={{ width: '100%' }} /></Form.Item></Col>
                        <Col span={8}><Form.Item name="pmx_db" label="PMax (dB)" rules={[{ required: true }]}><InputNumber style={{ width: '100%' }} /></Form.Item></Col>
                    </Row>
                    <Row gutter={16}>
                        <Col span={8}><Form.Item name="plx_db" label="PLx (dB)" rules={[{ required: true }]}><InputNumber style={{ width: '100%' }} /></Form.Item></Col>
                        <Col span={8}><Form.Item name="lex_db" label="LEX (dB)" rules={[{ required: true }]}><InputNumber style={{ width: '100%' }} /></Form.Item></Col>
                        <Col span={8}><Form.Item name="le_db" label="LE (dB)" rules={[{ required: true }]}><InputNumber style={{ width: '100%' }} /></Form.Item></Col>
                    </Row>

                    <Divider orientation="left">Protectores y Otros</Divider>
                    <Row gutter={16}>
                        <Col span={8}>
                            <Form.Item name="uso_protectores" label="Uso de Protectores" valuePropName="checked">
                                <Switch checkedChildren="Sí" unCheckedChildren="No" />
                            </Form.Item>
                        </Col>
                        <Col span={16}>
                            <Form.Item name="tipo_protector" label="Tipo de Protector (si aplica)">
                                <Input placeholder="Orejeras pasivas / tapones, etc." />
                            </Form.Item>
                        </Col>
                    </Row>

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
            <Modal open={imageViewerOpen} onCancel={() => setImageViewerOpen(false)} footer={imageViewerList.length > 1 ? [<Button key="prev" onClick={() => setImageViewerIndex((prev) => (prev - 1 + imageViewerList.length) % imageViewerList.length)} > Anterior </Button>, <Button key="next" type="primary" onClick={() => setImageViewerIndex((prev) => (prev + 1) % imageViewerList.length)} > Siguiente </Button>,] : null} width={720} title="Imagen del registro" >
                {imageViewerList.length ? (<div style={{ textAlign: 'center' }}> <img src={imageViewerList[imageViewerIndex]} alt="registro" style={{ maxWidth: '100%', maxHeight: '60vh', objectFit: 'contain' }} /> <div style={{ marginTop: 8 }}> {imageViewerIndex + 1} / {imageViewerList.length} </div> </div>) : (<Text type="secondary">Sin imagen.</Text>)}
            </Modal>
        </>
    );
};

export default DosimetriaPage; // <<< HASTA AQUÍ EN EL REPOSITORIO ORIGINAL 08/11/2025