// src/utils/images.js
// Utilities para normalizar y procesar imágenes (para PDFs / vista previa)

export const getImagesArray = (regOrVal) => {
  // regOrVal puede ser el registro completo o directamente la propiedad image_urls
  const raw = regOrVal && regOrVal.image_urls !== undefined ? regOrVal.image_urls : regOrVal;
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  if (typeof raw === 'string' && raw.trim() !== '') {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
      // si el parse retorna otra cosa, devolvemos el string original en array
      return [raw];
    } catch {
      // si no es JSON, asumimos CSV separado por comas
      return raw.split(',').map(s => s.trim()).filter(Boolean);
    }
  }
  return [];
};

/**
 * Reduce resolution / calidad para uso en PDF. Devuelve dataURL (jpeg) o la url original como fallback.
 * Opciones: { maxSize, quality, timeoutMs }
 */
export const processImageForPdf = (url, opts = {}) => {
  const MAX_SIZE = opts.maxSize || 800;
  const QUALITY = typeof opts.quality === 'number' ? opts.quality : 0.6;
  const TIMEOUT_MS = opts.timeoutMs || 4000;

  return new Promise((resolve) => {
    if (!url) return resolve(url);
    const timeoutId = setTimeout(() => resolve(url), TIMEOUT_MS);

    const img = new Image();
    img.crossOrigin = 'Anonymous';
    img.src = url;

    img.onload = () => {
      clearTimeout(timeoutId);
      try {
        let width = img.width, height = img.height;
        if (width > height) {
          if (width > MAX_SIZE) { height *= MAX_SIZE / width; width = MAX_SIZE; }
        } else {
          if (height > MAX_SIZE) { width *= MAX_SIZE / height; height = MAX_SIZE; }
        }
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.floor(width));
        canvas.height = Math.max(1, Math.floor(height));
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/jpeg', QUALITY);
        resolve(dataUrl);
      } catch (err) {
        // fallback: devuelve la URL original
        resolve(url);
      }
    };

    img.onerror = () => {
      clearTimeout(timeoutId);
      resolve(url);
    };
  });
};
