// src/hooks/useHeaderInfo.js
import { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient.js';
import dayjs from 'dayjs';
import { message } from 'antd';

export default function useHeaderInfo({ projectId, monitoreoId }) {
  const [headerInfo, setHeaderInfo] = useState({
    empresa: '—',
    area: '—',
    fecha: '—',
    equipo: '',
    modelos: '',
    series: '',
    tipo_monitoreo: '',
    descripcion_proyecto: ''
  });
  const [loadingHeader, setLoadingHeader] = useState(true);

  useEffect(() => {
    (async () => {
      setLoadingHeader(true);
      try {
        if (monitoreoId) {
          const { data: m, error: em } = await supabase.from('monitoreos').select('id, tipo_monitoreo, proyecto_id, equipos_asignados').eq('id', monitoreoId).single();
          if (em) throw em;
          const { data: p } = await supabase.from('proyectos').select('id, nombre, created_at, descripcion').eq('id', m.proyecto_id).single();

          let equipos = [];
          let ids = m.equipos_asignados;
          if (typeof ids === 'string') { try { ids = JSON.parse(ids); } catch { ids = []; } }
          if (Array.isArray(ids) && ids.length) {
            const { data: eq } = await supabase.from('equipos').select('id, nombre_equipo, modelo, serie').in('id', ids);
            equipos = eq || [];
          }

          setHeaderInfo({
            empresa: p?.nombre || '—',
            fecha: p?.created_at ? dayjs(p.created_at).format('DD/MM/YYYY') : '—',
            equipo: equipos.length ? equipos.map(e => e.nombre_equipo || 's/n').join(', ') : '',
            modelos: equipos.length ? equipos.map(e => e.modelo || 's/n').join(', ') : '',
            series: equipos.length ? equipos.map(e => e.serie || 's/n').join(', ') : '',
            tipo_monitoreo: m.tipo_monitoreo || '',
            descripcion_proyecto: p?.descripcion || ''
          });
        } else if (projectId) {
          const { data: p } = await supabase.from('proyectos').select('id, nombre, created_at, descripcion').eq('id', projectId).single();
          setHeaderInfo((h) => ({
            ...h,
            empresa: p?.nombre || '—',
            fecha: p?.created_at ? dayjs(p.created_at).format('DD/MM/YYYY') : '—',
            descripcion_proyecto: p?.descripcion || ''
          }));
        }
      } catch (e) {
        console.error('Header error:', e);
        message.error('No se pudo cargar la cabecera.');
      } finally {
        setLoadingHeader(false);
      }
    })();
  }, [projectId, monitoreoId]);

  return { headerInfo, setHeaderInfo, loadingHeader };
}
