// src/utils/downloadImagesAsZip.js
import JSZip from 'jszip';
import { saveAs } from 'file-saver';

/**
 * Descarga un conjunto de imágenes (urls) en un solo ZIP.
 *
 * @param {string[]} urls - lista de URLs (pueden repetirse entre registros)
 * @param {Object} options
 * @param {string} options.zipName - nombre del archivo zip (ej: 'particulas_imagenes.zip')
 * @param {string} [options.folderName] - carpeta interna dentro del zip (opcional)
 */
export async function downloadImagesAsZip(urls, { zipName, folderName = '' } = {}) {
  if (!urls || !urls.length) {
    throw new Error('No hay imágenes para descargar');
  }

  const uniqueUrls = Array.from(new Set(urls.filter(Boolean)));

  const zip = new JSZip();
  const folder = folderName ? zip.folder(folderName) : zip;

  // Descargamos cada imagen y la metemos al ZIP
  const downloadPromises = uniqueUrls.map(async (url, index) => {
    try {
      const response = await fetch(url);
      if (!response.ok) {
        console.warn('No se pudo descargar', url);
        return;
      }
      const blob = await response.blob();

      // Sacamos un nombre “bonito” a partir de la URL
      let fileName = url.split('/').pop() || `imagen_${index + 1}.jpg`;
      // Evitar querystrings tipo ?token=...
      fileName = fileName.split('?')[0];

      folder.file(fileName, blob);
    } catch (err) {
      console.error('Error descargando', url, err);
    }
  });

  await Promise.all(downloadPromises);

  const content = await zip.generateAsync({ type: 'blob' });
  saveAs(content, zipName || 'imagenes.zip');
}
