// src/utils/buildPdfData.js
import { getImagesArray, processImageForPdf } from './images.js';
import { toNumberOrString } from './numbers.js'; // si lo necesitas

/**
 * buildPdfData(rows, tempSelections, recordSelections, options)
 * - rows: array de registros
 * - tempSelections: { [id]: index }
 * - recordSelections: { [id]: boolean }
 * - options.processImages: true/false (if true will call processImageForPdf)
 *
 * Returns array de objetos { imageUrl, area, puesto, codigo, fechaHora }
 */
export async function buildPdfData(rows = [], tempSelections = {}, recordSelections = {}, options = { processImages: false }) {
  const selectedRows = rows.filter(r => recordSelections[r.id] === true && getImagesArray(r).length > 0);
  const result = [];
  for (let i = 0; i < selectedRows.length; i++) {
    const r = selectedRows[i];
    const imgs = getImagesArray(r);
    const idx = tempSelections[r.id] ?? 0;
    const finalIdx = (idx >= 0 && idx < imgs.length) ? idx : 0;
    const originalUrl = imgs[finalIdx];

    let processedUrl = originalUrl;
    if (options.processImages) {
      try { processedUrl = await processImageForPdf(originalUrl); } catch (e) { processedUrl = originalUrl; }
    }

    const fecha = r.measured_at ? new Date(r.measured_at) : null;
    const fechaStr = fecha ? fecha.toLocaleDateString('es-PE') : '';
    const horaStr = fecha ? fecha.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' }) : '';
    result.push({
      imageUrl: processedUrl,
      area: r.area || 'N/A',
      puesto: r.puesto_trabajo || '',
      codigo: `CAL-${String(i + 1).padStart(2, '0')}`,
      fechaHora: `${fechaStr} - ${horaStr}`
    });
  }
  return result;
}
