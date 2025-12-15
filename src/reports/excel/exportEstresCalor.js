import * as XLSX from 'xlsx';
import dayjs from 'dayjs';

/**
 * EXPORTA EXCEL DE ESTRÉS POR CALOR
 * - Todas las filas tienen 21 columnas
 * - Hora LOCAL (sin UTC)
 * - Cabecera completa (como tu imagen)
 */
export function exportEstresCalor(rows = [], header = {}) {
  try {
    const COLS = 21;
    const EMPTY = Array(COLS).fill({ v: '' });

    const empresa = header?.empresa || '—';
    const fechaMonitoreo = header?.fecha || '';

    const border = {
      top: { style: 'thin' },
      bottom: { style: 'thin' },
      left: { style: 'thin' },
      right: { style: 'thin' },
    };

    const th = {
      font: { bold: true },
      alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
      fill: { fgColor: { rgb: 'FFFF00' } },
      border,
    };

    const tdC = {
      alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
      border,
    };

    const tdL = {
      alignment: { horizontal: 'left', vertical: 'center', wrapText: true },
      border,
    };

    const wsData = [];

    // ===== TÍTULO (21 columnas reales) =====
    wsData.push([
      { v: 'PLANILLA DE MEDICIÓN DE ESTRÉS POR CALOR', s: { font: { bold: true, sz: 14 }, alignment: { horizontal: 'center' } } },
      ...EMPTY.slice(1),
    ]);

    // ===== CABECERA =====
    wsData.push([
      { v: 'NOMBRE DE LA EMPRESA', s: th },
      { v: empresa, s: tdL },
      { v: 'FECHA DE MONITOREO', s: th },
      { v: fechaMonitoreo, s: tdL },
      ...EMPTY.slice(4),
    ]);

    wsData.push([
      { v: 'EQUIPO', s: th },
      { v: header?.equipo || '', s: tdL },
      { v: 'MODELO DEL EQUIPO', s: th },
      { v: header?.modelos || '', s: tdL },
      ...EMPTY.slice(4),
    ]);

    wsData.push([
      { v: 'SERIE DEL EQUIPO', s: th },
      { v: header?.series || '', s: tdL },
      { v: 'ÁREA DE TRABAJO', s: th },
      { v: header?.area || '', s: tdL },
      ...EMPTY.slice(4),
    ]);

    wsData.push([...EMPTY]); // fila en blanco REAL

    // ===== ENCABEZADOS TABLA =====
    wsData.push([
      { v: 'N°', s: th },
      { v: 'ÁREA DE TRABAJO', s: th },
      { v: 'PUESTO DE TRABAJO', s: th },
      { v: 'INTERIOR/EXTERIOR', s: th },
      { v: 'ACLIMATADO', s: th },
      { v: 'FECHA', s: th },
      { v: 'HORA', s: th },
      { v: 'DESCRIPCIÓN DE ACTIVIDADES', s: th },
      { v: 'TIPO DE ROPA CAV °C', s: th },
      { v: 'CAPUCHA', s: th },
      { v: 'TASA METABÓLICA W', s: th },
      { v: '%HR', s: th },
      { v: 'VEL. VIENTO (m/s)', s: th },
      { v: 'P (mmHg)', s: th },
      { v: 'TEMP °C', s: th },
      { v: 'WBGT °C', s: th },
      { v: 'WB °C', s: th },
      { v: 'GT °C', s: th },
      { v: 'IMÁGENES', s: th },
      { v: 'COORDENADAS UTM', s: th },
      { v: 'OBSERVACIÓN', s: th },
    ]);

    const siNo = (v) =>
      v === true || String(v) === 'true' ? 'Sí'
        : v === false || String(v) === 'false' ? 'No'
          : '';

    // ===== DATOS =====
    rows.forEach((r, i) => {
      wsData.push([
        { v: i + 1, s: tdC },
        { v: r.area || '', s: tdL },
        { v: r.puesto_trabajo || '', s: tdL },
        { v: r.interior_exterior || '', s: tdC },
        { v: siNo(r.aclimatado), s: tdC },
        {
          v: dayjs(r.measured_at).utc().format('DD/MM/YYYY'),
          s: tdC
        },
        {
          v: dayjs(r.measured_at).utc().format('HH:mm'),
          s: tdC
        },

        { v: r.desc_actividades || '', s: tdL },
        { v: r.tipo_ropa_cav || '', s: tdL },
        { v: siNo(r.capucha), s: tdC },
        { v: r.tasa_metabolica ?? '', s: tdL },
        { v: r.hr_percent ?? '', s: tdC },
        { v: r.vel_viento_ms ?? '', s: tdC },
        { v: r.presion_mmhg ?? '', s: tdC },
        { v: r.temp_c ?? '', s: tdC },
        { v: r.wbgt_c ?? '', s: tdC },
        { v: r.wb_c ?? '', s: tdC },
        { v: r.gt_c ?? '', s: tdC },
        { v: Array.isArray(r.image_urls) ? r.image_urls.join(', ') : '', s: tdL },
        { v: r.location ? JSON.stringify(r.location) : '', s: tdL },
        { v: r.observaciones || '', s: tdL },
      ]);
    });

    const ws = XLSX.utils.aoa_to_sheet(wsData);

    // Merge SOLO el título
    ws['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 21 } }];

    ws['!cols'] = Array.from({ length: COLS }, () => ({ wch: 21 }));

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Estrés por Calor');
    XLSX.writeFile(wb, 'reporte_estres_calor.xlsx');

  } catch (err) {
    console.error('Excel error:', err);
    throw err;
  }
}
