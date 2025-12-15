// src/features/monitoreos/estresCalor/hooks/useEstresCalorData.js
/**
 * Hook useEstresCalorData
 * - Encapsula la lógica de acceso a datos de la feature "Estres Calor"
 * - Exporta: rows, loading, headerInfo, loadingHeader, usersById, fetchRows, addRow, updateRow, deleteRow
 *
 * IMPORTANTE:
 *  - Requiere que tu src/supabaseClient.js exporte: export const supabase = createClient(...)
 *  - Las rutas usadas aquí asumen que el archivo está en:
 *      src/features/monitoreos/estresCalor/hooks/useEstresCalorData.js
 *    y por ello importa supabase desde ../../../../supabaseClient.js
 */

import { useState, useCallback, useEffect } from 'react';
import { supabase } from '../../../../supabaseClient.js'; // AJUSTA si tu supabaseClient está en otra ruta
import { getImagesArray } from '../../../../utils/images.js';
import dayjs from 'dayjs';

const TABLE_NAME = 'estres_calor';

export function useEstresCalorData(projectId, monitoreoId) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingHeader, setLoadingHeader] = useState(true);
  const [headerInfo, setHeaderInfo] = useState({
    empresa: '—',
    area: '—',
    fecha: '—',
    equipo: '',
    modelos: '',
    series: '',
    tipo_monitoreo: 'Estrés',
    descripcion_proyecto: ''
  });
  const [usersById, setUsersById] = useState({});

  // Fetch rows (con lógica condicional para .or(...))
  const fetchRows = useCallback(async (isBackground = false) => {
    if (!isBackground) setLoading(true);
    try {
      let q = supabase.from(TABLE_NAME).select('*').order('measured_at', { ascending: true });

      if (monitoreoId && projectId) q = q.or(`monitoreo_id.eq.${monitoreoId},proyecto_id.eq.${projectId}`);
      else if (monitoreoId) q = q.eq('monitoreo_id', monitoreoId);
      else if (projectId) q = q.eq('proyecto_id', projectId);

      const { data, error } = await q;
      if (error) throw error;

      const mapped = (data || []).map(r => ({ ...r, image_urls: getImagesArray(r) }));
      setRows(mapped);

      // Si hay datos, setear fecha del header con la primera medición (opcional)
      if (mapped.length && mapped[0].measured_at) {
        const raw = String(mapped[0].measured_at);
        const [yyyy, mm, dd] = raw.slice(0, 10).split('-');
        setHeaderInfo(h => ({ ...h, fecha: `${dd}/${mm}/${yyyy}` }));
      }

      // Cargar nombres de usuarios por created_by
      const ids = Array.from(new Set(mapped.map(m => m.created_by).filter(Boolean)));
      if (ids.length) {
        const { data: profs } = await supabase
          .from('profiles')
          .select('id, username, nombre_completo')
          .in('id', ids);
        const dict = {};
        (profs || []).forEach(u => {
          dict[u.id] = u.nombre_completo || u.username || u.id;
        });
        setUsersById(dict);
      } else {
        setUsersById({});
      }
    } catch (err) {
      console.error('useEstresCalorData.fetchRows error', err);
      setRows([]);
    } finally {
      if (!isBackground) setLoading(false);
    }
  }, [monitoreoId, projectId]);

  // Fetch header (info de monitoreo/proyecto/equipos)
  const fetchHeader = useCallback(async () => {
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
          .select('id, nombre, created_at, descripcion')
          .eq('id', m.proyecto_id)
          .single();

        let equipos = [];
        let ids = m.equipos_asignados;
        if (typeof ids === 'string') {
          try { ids = JSON.parse(ids); } catch { ids = []; }
        }
        if (Array.isArray(ids) && ids.length) {
          const { data: eq } = await supabase
            .from('equipos')
            .select('id, nombre_equipo, modelo, serie')
            .in('id', ids);
          equipos = eq || [];
        }

        setHeaderInfo(h => ({
          ...h,
          empresa: p?.nombre || '—',
          fecha: p?.created_at ? dayjs(p.created_at).format('DD/MM/YYYY') : h.fecha,
          equipo: equipos.length ? equipos.map(e => e.nombre_equipo || 's/n').join(', ') : '',
          modelos: equipos.length ? equipos.map(e => e.modelo || 's/n').join(', ') : '',
          series: equipos.length ? equipos.map(e => e.serie || 's/n').join(', ') : '',
          tipo_monitoreo: m?.tipo_monitoreo || h.tipo_monitoreo,
          descripcion_proyecto: p?.descripcion || h.descripcion_proyecto
        }));
      } else if (projectId) {
        const { data: p } = await supabase
          .from('proyectos')
          .select('id, nombre, created_at, descripcion')
          .eq('id', projectId)
          .single();
        setHeaderInfo(h => ({ ...h, empresa: p?.nombre || '—', fecha: p?.created_at ? dayjs(p.created_at).format('DD/MM/YYYY') : h.fecha, descripcion_proyecto: p?.descripcion || h.descripcion_proyecto }));
      }
    } catch (err) {
      console.error('useEstresCalorData.fetchHeader error', err);
    } finally {
      setLoadingHeader(false);
    }
  }, [monitoreoId, projectId]);

  // CRUD helpers (add, update, delete). Lanza excepción si falla.
  const addRow = async (payload) => {
    const { error } = await supabase.from(TABLE_NAME).insert(payload);
    if (error) throw error;
    await fetchRows(true);
  };
  const updateRow = async (id, payload) => {
    const { error } = await supabase.from(TABLE_NAME).update(payload).eq('id', id);
    if (error) throw error;
    await fetchRows(true);
  };
  const deleteRow = async (id) => {
    const { error } = await supabase.from(TABLE_NAME).delete().eq('id', id);
    if (error) throw error;
    await fetchRows(true);
  };

  // Efectos iniciales
  useEffect(() => {
    fetchHeader();
  }, [fetchHeader]);

  useEffect(() => {
    fetchRows();
    // Si quieres realtime, lo suscribes aquí. Si no, comenta o quita.
    let channel = null;
    try {
      channel = supabase.channel('rt-estres-calor').on('postgres_changes', { event: '*', schema: 'public', table: TABLE_NAME }, () => fetchRows(true)).subscribe();
    } catch (err) {
      // algunos clientes supabase pueden no exponer channel/removeChannel en versiones
      console.warn('Realtime subscribe not available or failed:', err);
    }
    return () => {
      if (channel && supabase.removeChannel) supabase.removeChannel(channel);
    };
  }, [fetchRows]);

  return {
    rows,
    loading,
    headerInfo,
    loadingHeader,
    usersById,
    fetchRows,
    addRow,
    updateRow,
    deleteRow
  };
}
