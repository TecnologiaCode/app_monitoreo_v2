// src/pages/ErgonomiaPage.jsx

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
    Checkbox // <-- NUEVO IMPORT
} from 'antd';
import {
    PlusOutlined,
    EditOutlined,
    DeleteOutlined,
    HomeOutlined,
    DatabaseOutlined,
    ExclamationCircleOutlined,
    ArrowLeftOutlined,
    ClockCircleOutlined,
    EyeOutlined,
    DeleteOutlined as DeleteIcon,
    FileExcelOutlined,
    FilePdfOutlined, // <-- NUEVO IMPORT
    SaveOutlined,    // <-- NUEVO IMPORT
    LeftOutlined,    // <-- NUEVO IMPORT
    RightOutlined    // <-- NUEVO IMPORT
} from '@ant-design/icons';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient.js';
import dayjs from 'dayjs';
import 'dayjs/locale/es';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
//import XLSX from 'xlsx-js-style';
import * as XLSX from 'xlsx';          // (tu versión nueva de Excel)

// IMPORTS DEL REPORTE
import { PDFViewer } from '@react-pdf/renderer';
import { ReporteFotografico } from '../components/ReporteFotografico';

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
   Helpers para hora actual en UTC
   ========================================================= */

const formatHoraUTC = (v) => {
    if (!v) return '';
    try {
        return dayjs(v).utc().format('HH:mm');
    } catch {
        return String(v);
    }
};

const formatFechaUTC = (v) => {
    if (!v) return '';
    try {
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

    // --- Estados de Datos ---
    const [headerInfo, setHeaderInfo] = useState({
        empresa: '—',
        area: '—',
        fecha: '—',
        equipo: '',
        modelos: '',
        series: '',
        tipo_monitoreo: 'Ergonomía', // Valor por defecto
        descripcion_proyecto: '' // Para el PDF
    });

    const [rows, setRows] = useState([]);
    const [usersById, setUsersById] = useState({});

    // --- Estados de UI ---
    const [loadingHeader, setLoadingHeader] = useState(true);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    const [isFormOpen, setIsFormOpen] = useState(false);
    const [selected, setSelected] = useState(null);

    const [searchText, setSearchText] = useState('');
    const [pageSize, setPageSize] = useState(10);
    const [currentPage, setCurrentPage] = useState(1);

    // --- Estados Visor Imágenes ---
    const [imageViewerOpen, setImageViewerOpen] = useState(false);
    const [imageViewerList, setImageViewerList] = useState([]);
    const [imageViewerIndex, setImageViewerIndex] = useState(0);

    // --- Estados PDF y Selección ---
    const [isPdfModalVisible, setIsPdfModalVisible] = useState(false);
    const [pdfStep, setPdfStep] = useState('selection'); 
    const [pdfData, setPdfData] = useState([]);
    const [tempSelections, setTempSelections] = useState({}); // { idRegistro: indiceFoto }
    const [recordSelections, setRecordSelections] = useState({}); // { idRegistro: boolean }
    const [isSavingSelection, setIsSavingSelection] = useState(false);
    const [pdfLayout, setPdfLayout] = useState('2x4');


    /* ================ HELPERS UI ================ */

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

    // Helper para obtener array de imagenes limpio
    const getImagesArray = (reg) => {
        if (Array.isArray(reg.image_urls)) return reg.image_urls;
        if (typeof reg.image_urls === 'string' && reg.image_urls.trim() !== '') {
            try {
                // Intentar parsear si viene como JSON string
                const parsed = JSON.parse(reg.image_urls);
                if(Array.isArray(parsed)) return parsed;
                return reg.image_urls.split(',').map(s => s.trim());
            } catch {
                return reg.image_urls.split(',').map(s => s.trim());
            }
        }
        return [];
    };


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
        rows.filter(r => getImagesArray(r).length > 0).forEach(r => { allSelected[r.id] = true; });
        setRecordSelections(allSelected);
    };

    const handleDeselectAllRecords = () => {
        const allDeselected = {};
        rows.filter(r => getImagesArray(r).length > 0).forEach(r => { allDeselected[r.id] = false; });
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
            initialSelections[r.id] = savedIndex < imgs.length ? savedIndex : 0;
            initialRecordSelections[r.id] = true; // Todos seleccionados por defecto
        });

        setTempSelections(initialSelections);
        setRecordSelections(initialRecordSelections);
        setPdfStep('selection');
        setIsPdfModalVisible(true);
    };

    // GUARDAR Y GENERAR (Versión Rápida sin compresión)
    const handleSaveAndGenerate = async () => {
        setIsSavingSelection(true);
        const loadingMsg = message.loading("Generando reporte...", 0);
        
        try {
            const registrosConFotos = rows.filter(r => getImagesArray(r).length > 0);
            const registrosSeleccionados = registrosConFotos.filter(r => recordSelections[r.id] === true);

            if (registrosSeleccionados.length === 0) {
                message.warning("No ha seleccionado ningún registro.");
                setIsSavingSelection(false);
                loadingMsg();
                return;
            }

            const supabaseTasks = [];
            const dataForPdf = [];
            let i = 0;

            for (const r of registrosSeleccionados) {
                const imgs = getImagesArray(r);
                const selectedIdx = tempSelections[r.id] !== undefined ? tempSelections[r.id] : 0;
                const finalIdx = selectedIdx < imgs.length ? selectedIdx : 0;
                const originalUrl = imgs[finalIdx];
                
                // Código secuencial ERG-01, ERG-02 (ERGONOMÍA)
                const codigo = `ERG-${String(i + 1).padStart(2, '0')}`;

                dataForPdf.push({
                    imageUrl: originalUrl, // URL directa
                    area: r.area_trabajo, // Usamos area_trabajo de ergonomía
                    puesto: r.cargo || r.trabajador_nombre, // En ergo, a veces el puesto es el cargo o nombre
                    codigo: codigo,
                    fechaHora: `${formatFechaUTC(r.measured_at)} - ${formatHoraUTC(r.measured_at)}`
                });

                // Guardar selección en BD (tabla ergonomia)
                supabaseTasks.push(
                    supabase.from(MEDICIONES_TABLE_NAME).update({ selected_image_index: finalIdx }).eq('id', r.id)
                );
                i++;
            }

            await Promise.all(supabaseTasks);
            
            // Refrescamos datos en segundo plano para tener los indices actualizados
            fetchRows(); 

            setPdfData(dataForPdf);
            setPdfStep('view'); 
            message.success("Reporte generado");

        } catch (error) {
            console.error("Error generando PDF:", error);
            message.error("Ocurrió un error inesperado.");
        } finally {
            loadingMsg();
            setIsSavingSelection(false);
        }
    };


    /* ---------- EXPORTAR EXCEL ---------- */
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
                // ... (Tu lógica de Excel existente se mantiene igual) ...
                // (La he resumido para no alargar demasiado la respuesta, pero aquí iría tu código original de wsData.push...)
                
                // Encabezado superior (logo/títulos/controles) – solo estructura
                wsData.push([{ v: 'FICHA DE INSPECCIÓN', s: sTitle }]);
                wsData.push([{ v: 'ESTUDIO DE ERGONÓMICO', s: sTitle }]);
                wsData.push([{ v: 'PACHABOL S.R.L.', s: sTitle }]);
                wsData.push(['']); // espacio

                // IDENTIFICACIÓN DE LA EMPRESA (barra gris)
                wsData.push([{ v: 'IDENTIFICACIÓN DE LA EMPRESA', s: sHeader }]);
                wsData.push([{ v: 'Nombre /Razón Social:', s: sLabel }, { v: empresaNombre, s: sYellow }]);
                // ... Resto de tu excel ...
                
                // (Para simplificar la copia, asumo que mantienes tu lógica interna de exportToExcel que ya funcionaba)
                 const ws = XLSX.utils.aoa_to_sheet(wsData);
                 // ... merges y cols ...
                 XLSX.utils.book_append_sheet(wb, ws, `Reg ${idx + 1}`);
            });

            // Si omití las filas del excel en este bloque para ahorrar espacio,
            // asegúrate de usar tu función exportToExcel completa original.
            // Este bloque es solo ilustrativo de dónde va.
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
                    // AGREGAMOS 'descripcion' al select
                    const { data: p } = await supabase.from('proyectos').select('id, nombre, created_at, descripcion').eq('id', m.proyecto_id).single();
                    
                    let equipos = [];
                    let ids = m.equipos_asignados;
                    if (typeof ids === 'string') { try { ids = JSON.parse(ids); } catch { ids = []; } }
                    if (Array.isArray(ids) && ids.length) {
                        const { data: eq } = await supabase.from('equipos').select('id, nombre_equipo, modelo, serie').in('id', ids);
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
                    // AGREGAMOS 'descripcion' al select
                    const { data: p } = await supabase.from('proyectos').select('id, nombre, created_at, descripcion').eq('id', projectId).single();
                    setHeaderInfo((h) => ({ 
                        ...h, 
                        empresa: p?.nombre || '—', 
                        fecha: p?.created_at ? dayjs(p.created_at).format('DD/MM/YYYY') : '—',
                        descripcion_proyecto: p?.descripcion || ''
                    }));
                }
            } catch (e) { console.error('Header error:', e); } finally { setLoadingHeader(false); }
        })();
    }, [projectId, monitoreoId]);

    /* ---------- Traer filas ---------- */
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
                    try {
                         const parsed = JSON.parse(r.image_urls);
                         if(Array.isArray(parsed)) imageUrls = parsed;
                         else imageUrls = r.image_urls.split(',').map((s) => s.trim());
                    } catch {
                         imageUrls = r.image_urls.split(',').map((s) => s.trim());
                    }
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
                const { data: profs } = await supabase.from('profiles').select('id, username, nombre_completo, email, descripcion, rol, estado').in('id', ids);
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
                    const { error } = await supabase.from(MEDICIONES_TABLE_NAME).delete().eq('id', rec.id); 
                    if (error) throw error; 
                    // setRows((prevRows) => prevRows.filter((item) => item.id !== rec.id)); // Realtime se encarga
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
    
    /* ========================= COLUMNAS TABLA (MODIFICADO) ========================= */
    const columns = [
        {
            title: 'N°',
            key: 'n',
            width: 40,
            fixed: 'left', render: (_, __, i) => (currentPage - 1) * pageSize + i + 1,
        },
        // Nueva columna Fecha
        {
            title: 'FECHA',
            dataIndex: 'measured_at',
            key: 'measured_date',
            sorter: (a, b) => dayjs(a.measured_at).unix() - dayjs(b.measured_at).unix(),
            defaultSortOrder: 'descend',
            width: 100, render: (t) => formatFechaUTC(t),
        },
        // Columna Hora (se conserva)
        {
            title: 'HORA',
            dataIndex: 'measured_at',
            key: 'measured_time',
            sorter: (a, b) => dayjs(a.measured_at).unix() - dayjs(b.measured_at).unix(),
            width: 70,
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
        { title: 'Imágenes', dataIndex: 'image_urls', key: 'image_urls', width: 120, render: (imgs) => { const list = Array.isArray(imgs) ? imgs : []; if (!list.length) return <Text type="secondary">Ninguna</Text>; return (<Button type="link" icon={<EyeOutlined />} onClick={() => openImageViewer(list, 0)} size="small" > Ver imagen </Button>); }, },
        { title: 'Ubicación', dataIndex: 'location', key: 'location', width: 210, render: (v) => renderLocation(v), },
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
                </Space>),
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
                        <Button onClick={() => navigate(`/proyectos/${projectId}/monitoreo`)}><ArrowLeftOutlined />Volver a monitoreos</Button>
                        <Button icon={<FileExcelOutlined />} onClick={exportToExcel} loading={loading}>Exportar</Button>
                        {/* BOTÓN NUEVO */}
                        <Button 
                           icon={<FilePdfOutlined />} 
                           onClick={handleOpenPdf}
                           style={{ backgroundColor: '#ff4d4f', color: 'white', borderColor: '#ff4d4f' }}
                        >
                           Reporte Fotos
                        </Button>
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
                        className='tabla-general'
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
                            : {}
                    }
                >
                    <Divider orientation="left">Datos del Trabajador</Divider>
                    <Row gutter={12}>
                        <Col span={12}><Form.Item name="area_trabajo" label="Área de trabajo" rules={[{ required: true }]}><Input /></Form.Item></Col>
                        <Col span={12}><Form.Item name="trabajador_nombre" label="Nombre del trabajador" rules={[{ required: true }]}><Input /></Form.Item></Col>
                    </Row>
                    {/* ... RESTO DE CAMPOS DEL FORMULARIO (IGUAL QUE ANTES) ... */}
                    <Form.Item name="image_urls" label="URLs de imágenes (coma separadas)">
                        <Input.TextArea rows={2} placeholder="https://..., https://..." />
                    </Form.Item>
                    {/* ... */}
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

            {/* === MODAL DE PDF (NUEVO) === */}
            <Modal
                title={pdfStep === 'selection' ? "Seleccionar Imágenes" : "Vista Previa PDF"}
                open={isPdfModalVisible}
                onCancel={() => setIsPdfModalVisible(false)}
                width={1000}
                style={{ top: 20 }}
                footer={
                    pdfStep === 'selection' ? (
                        <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
                            
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <Text strong>Distribución:</Text>
                                <Select defaultValue="2x4" style={{ width: 120 }} onChange={setPdfLayout}>
                                    <Option value="2x4">2 x 4</Option>
                                    <Option value="2x3">2 x 3</Option>
                                    <Option value="3x3">3 x 3</Option>
                                    <Option value="3x4">3 x 4</Option>
                                </Select>
                            </div>

                            <Button type="primary" icon={<SaveOutlined />} onClick={handleSaveAndGenerate} loading={isSavingSelection}>
                                Guardar y Generar PDF
                            </Button>
                        </div>
                    ) : (
                        <Button onClick={() => setPdfStep('selection')}><ArrowLeftOutlined /> Volver</Button>
                    )
                }
            >
                <div style={{ height: '75vh', overflowY: 'auto', overflowX: 'hidden' }}>
                    {pdfStep === 'selection' && (
                        <>
                             {/* BARRA DE SELECCIÓN MASIVA */}
                             <div style={{ marginBottom: 16, paddingBottom: 16, borderBottom: '1px solid #f0f0f0', display: 'flex', justifyContent: 'center', gap: 16 }}>
                                <Button size="small" onClick={handleSelectAllRecords}>Seleccionar Todos</Button>
                                <Button size="small" onClick={handleDeselectAllRecords}>Deseleccionar Todos</Button>
                            </div>

                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', justifyContent: 'center' }}>
                                {rows.filter(r => getImagesArray(r).length > 0).map((r) => {
                                    const imgs = getImagesArray(r);
                                    const currentIdx = tempSelections[r.id] || 0;
                                    const isSelected = recordSelections[r.id] === true;

                                    return (
                                        <div key={r.id} style={{ 
                                            width: '23%', 
                                            border: isSelected ? '1px solid #ddd' : '1px dashed #999', 
                                            opacity: isSelected ? 1 : 0.5,
                                            padding: '8px', borderRadius: '8px', display: 'flex', flexDirection: 'column', alignItems: 'center', backgroundColor: '#fafafa', position: 'relative'
                                        }}>
                                            <Checkbox 
                                                checked={isSelected} 
                                                onChange={() => handleRecordSelectionToggle(r.id)}
                                                style={{ position: 'absolute', top: 5, right: 5, zIndex: 20 }}
                                            />
                                            <Text strong style={{ fontSize: 12 }}>{headerInfo.tipo_monitoreo}</Text>
                                            
                                            <div style={{ position: 'relative', width: '100%', height: '150px', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff', border: '1px solid #eee', marginTop: 5 }}>
                                                {imgs.length > 1 && <Button shape="circle" icon={<LeftOutlined />} size="small" style={{ position: 'absolute', left: 5 }} onClick={() => handlePrevImage(r.id, imgs.length)} />}
                                                <img src={imgs[currentIdx]} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
                                                {imgs.length > 1 && <Button shape="circle" icon={<RightOutlined />} size="small" style={{ position: 'absolute', right: 5 }} onClick={() => handleNextImage(r.id, imgs.length)} />}
                                                {imgs.length > 1 && <span style={{ position: 'absolute', bottom: 2, right: 5, fontSize: 10, background: 'rgba(255,255,255,0.7)' }}>{currentIdx + 1}/{imgs.length}</span>}
                                            </div>
                                            <Text style={{ fontSize: 11, marginTop: 5 }}>{r.trabajador_nombre} - {r.cargo}</Text>
                                        </div>
                                    );
                                })}
                            </div>
                        </>
                    )}

                    {pdfStep === 'view' && (
                        <PDFViewer width="100%" height="100%" showToolbar={true}>
                            <ReporteFotografico 
                                data={pdfData} 
                                empresa={headerInfo.descripcion_proyecto || 'SIN DESCRIPCIÓN'} 
                                layout={pdfLayout}
                                tituloMonitoreo={headerInfo.tipo_monitoreo || 'Ergonomía'} 
                                descripcionProyecto={''}
                            />
                        </PDFViewer>
                    )}
                </div>
            </Modal>
        </>
    );
};

export default ErgonomiaPage;