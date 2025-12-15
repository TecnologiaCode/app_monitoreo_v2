// src/utils/location.js
// Formateo de location a texto (no JSX) para usos en export a Excel u otras utilidades.

export const formatLocationString = (v) => {
  if (!v) return '';
  try {
    if (typeof v === 'object') {
      const lat = v.lat ?? v.latitude ?? '';
      const lng = v.lng ?? v.longitude ?? '';
      if (lat !== '' || lng !== '') return `lat: ${lat}${lng !== '' ? `, lng: ${lng}` : ''}`;
      const e = v.easting ?? '';
      const n = v.northing ?? '';
      const z = v.utm_zone ?? '';
      if (e !== '' || n !== '' || z !== '') return `E: ${e}${n !== '' ? `, N: ${n}` : ''}${z ? `, Z: ${z}` : ''}`;
      if (Array.isArray(v)) return v.join(', ');
      return JSON.stringify(v);
    }
    // si es string, intentar parse
    const parsed = JSON.parse(v);
    return formatLocationString(parsed);
  } catch {
    return String(v);
  }
};

