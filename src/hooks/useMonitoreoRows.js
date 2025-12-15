// src/hooks/useMonitoreoRows.js
import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../supabaseClient.js';
import { message } from 'antd';
import { getImagesArray } from '../utils/images';

export default function useMonitoreoRows(tableName, { projectId, monitoreoId } = {}) {
  const [rows, setRows] = useState([]);
  const [usersById, setUsersById] = useState({});
  const [loading, setLoading] = useState(true);

  const fetchRows = useCallback(async (isBackground = false) => {
    if (!isBackground) setLoading(true);
    try {
      let q = supabase.from(tableName).select('*').order('measured_at', { ascending: true });

      if (monitoreoId && projectId) q = q.or(`monitoreo_id.eq.${monitoreoId},proyecto_id.eq.${projectId}`);
      else if (monitoreoId) q = q.eq('monitoreo_id', monitoreoId);
      else if (projectId) q = q.eq('proyecto_id', projectId);

      const { data, error } = await q;
      if (error) throw error;

      const mapped = (data || []).map((r) => ({ ...r, image_urls: getImagesArray(r) }));
      setRows(mapped);

      // cargar perfiles
      const ids = Array.from(new Set(mapped.map(m => m.created_by).filter(Boolean)));
      if (ids.length) {
        const { data: profs } = await supabase.from('profiles').select('id, username, nombre_completo').in('id', ids);
        const dict = {};
        (profs || []).forEach((u) => { dict[u.id] = u.nombre_completo || u.username || u.id; });
        setUsersById(dict);
      } else {
        setUsersById({});
      }
    } catch (e) {
      console.error('Fetch error:', e);
      if (!isBackground) message.error('No se pudo cargar registros.');
      setRows([]);
    } finally {
      if (!isBackground) setLoading(false);
    }
  }, [monitoreoId, projectId, tableName]);

  useEffect(() => {
    fetchRows();
    const ch = supabase.channel(`rt-${tableName}`).on('postgres_changes', { event: '*', schema: 'public', table: tableName }, () => fetchRows(true)).subscribe();
    return () => supabase.removeChannel(ch);
  }, [fetchRows, tableName]);

  return { rows, setRows, usersById, loading, refetch: fetchRows };
}
