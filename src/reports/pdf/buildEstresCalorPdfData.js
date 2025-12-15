// src/reports/pdf/buildEstresCalorPdfData.js
import { getImagesArray, processImageForPdf } from '../../utils/images.js';
import { formatFechaUTC, formatHoraUTC } from '../../utils/date.js';

/**
 * buildEstresCalorPdfData(rows, selections, opts)
 * - rows: array of records
 * - selections: { [recordId]: selectedIndex }
 * - opts: { batchSize = 5, progressCallback = (percent, status) => {} }
 *
 * Returns: array of { imageUrl, area, puesto, codigo, fechaHora }
 */
export async function buildEstresCalorPdfData(rows = [], selections = {}, opts = {}) {
  const { batchSize = 5, progressCallback } = opts;
  const rowsWithImgs = rows.filter(r => getImagesArray(r).length > 0);
  const total = rowsWithImgs.length;
  const final = [];

  for (let i = 0; i < total; i += batchSize) {
    const batch = rowsWithImgs.slice(i, i + batchSize);
    const promises = batch.map(async (r, batchIndex) => {
      const imgs = getImagesArray(r);
      const idx = (selections && selections[r.id] !== undefined) ? selections[r.id] : 0;
      const finalIdx = (idx >= 0 && idx < imgs.length) ? idx : 0;
      const originalUrl = imgs[finalIdx];

      let processed = originalUrl;
      try { processed = await processImageForPdf(originalUrl); } catch (e) { /* ignore */ }

      const codigo = `CAL-${String(i + batchIndex + 1).padStart(2, '0')}`;
      return {
        imageUrl: processed,
        area: r.area || 'N/A',
        puesto: r.puesto_trabajo || '',
        codigo,
        fechaHora: `${formatFechaUTC(r.measured_at)} - ${formatHoraUTC(r.measured_at)}`
      };
    });

    const res = await Promise.all(promises);
    final.push(...res);
    if (typeof progressCallback === 'function') {
      const current = Math.min(i + batchSize, total);
      const percent = Math.round((current / total) * 100);
      progressCallback(percent, `Procesadas ${current} de ${total}`);
    }
    // short pause for UI responsiveness
    await new Promise(resolve => setTimeout(resolve, 30));
  }

  return final;
}
