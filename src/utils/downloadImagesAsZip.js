// src/utils/downloadImagesAsZip.js
// Función utilitaria para descargar todas las imágenes de un conjunto de filas como ZIP.
// Usa jszip y file-saver (asegúrate de tenerlas instaladas).

import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import { message } from 'antd';

export const downloadImagesAsZip = async (rows = [], headerInfo = {}) => {
  try {
    const allUrls = [];
    rows.forEach(r => {
      const imgs = Array.isArray(r.image_urls) ? r.image_urls : (r.image_urls ? [r.image_urls] : []);
      imgs.forEach(u => u && allUrls.push(u));
    });
    if (!allUrls.length) {
      message.warning('No hay imágenes registradas en este monitoreo.');
      return { ok: false, message: 'No hay imágenes' };
    }

    const uniqueUrls = Array.from(new Set(allUrls.filter(Boolean)));
    const zip = new JSZip();
    const folder = zip.folder('estres_calor_images') || zip;

    await Promise.all(uniqueUrls.map(async (url, index) => {
      try {
        const resp = await fetch(url);
        if (!resp.ok) { console.warn('No se pudo descargar', url); return; }
        const blob = await resp.blob();
        let fileName = url.split('/').pop() || `imagen_${index + 1}.jpg`;
        fileName = fileName.split('?')[0];
        folder.file(fileName, blob);
      } catch (err) {
        console.error('Error descargando', url, err);
      }
    }));

    const content = await zip.generateAsync({ type: 'blob' });
    const empresaSafe = (headerInfo.empresa || 'empresa').replace(/[^\w\-]+/g, '_').substring(0, 40);
    const fechaSafe = (headerInfo.fecha || '').replace(/[^\d]/g, '') || 'monitoreo';
    const zipName = `estres_calor_imagenes_${empresaSafe}_${fechaSafe}.zip`;
    saveAs(content, zipName);
    message.success('Descarga lista.');
    return { ok: true };
  } catch (err) {
    console.error('downloadImagesAsZip error', err);
    message.error('No se pudieron descargar las imágenes.');
    return { ok: false, message: String(err) };
  }
};
