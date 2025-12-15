// src/hooks/useImageDownloader.js
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import { message } from 'antd';

export default function useImageDownloader() {
  const downloadAll = async (rows = [], headerInfo = {}, folderName = 'images') => {
    try {
      const allUrls = [];
      rows.forEach((r) => {
        const imgs = Array.isArray(r.image_urls) ? r.image_urls : (r.image_urls || []);
        imgs.forEach(u => allUrls.push(u));
      });

      if (!allUrls.length) {
        message.warning('No hay imágenes registradas en este monitoreo.');
        return;
      }

      message.loading({ content: 'Preparando descarga de imágenes...', key: 'zipDownload', duration: 0 });

      const uniqueUrls = Array.from(new Set(allUrls.filter(Boolean)));
      const zip = new JSZip();
      const folder = zip.folder(folderName);

      const downloadPromises = uniqueUrls.map(async (url, index) => {
        try {
          const resp = await fetch(url);
          if (!resp.ok) {
            console.warn('No se pudo descargar', url);
            return;
          }
          const blob = await resp.blob();
          let fileName = url.split('/').pop() || `imagen_${index + 1}.jpg`;
          fileName = fileName.split('?')[0];
          folder.file(fileName, blob);
        } catch (err) {
          console.error('Error descargando', url, err);
        }
      });

      await Promise.all(downloadPromises);
      const content = await zip.generateAsync({ type: 'blob' });

      const empresaSafe = (headerInfo.empresa || 'empresa').replace(/[^\w\-]+/g, '_').substring(0, 40);
      const fechaSafe = (headerInfo.fecha || '').replace(/[^\d]/g, '');
      const zipName = `${folderName}_imagenes_${empresaSafe}_${fechaSafe || 'monitoreo'}.zip`;

      saveAs(content, zipName);
      message.success({ content: 'Descarga lista.', key: 'zipDownload' });
    } catch (err) {
      console.error(err);
      message.error({ content: 'No se pudieron descargar las imágenes.', key: 'zipDownload' });
    }
  };

  return { downloadAll };
}
