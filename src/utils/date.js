// src/utils/date.js
// Formateo de fecha/hora (usa dayjs, asume que dayjs está instalado)
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import 'dayjs/locale/es';

dayjs.extend(utc);
dayjs.locale('es');

/**
 * Devuelve hora en formato HH:mm (asume UTC si viene con zona)
 */
export const formatHoraUTC = (v) => {
  if (!v) return '';
  try { return dayjs(v).utc().format('HH:mm'); } catch { return String(v); }
};

/**
 * Devuelve fecha en formato DD/MM/YYYY (asume UTC)
 */
export const formatFechaUTC = (v) => {
  if (!v) return '';
  try { return dayjs(v).utc().format('DD/MM/YYYY'); } catch { return String(v); }
};
