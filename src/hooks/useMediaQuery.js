import React, { useState, useEffect } from 'react';

/**
 * Hook personalizado para detectar media queries (responsive).
 * ESTA VERSIÓN ESTÁ CORREGIDA PARA EVITAR BUCLES INFINITOS.
 */
export const useMediaQuery = (query) => {
  // 1. Obtenemos la media query una sola vez
  const media = window.matchMedia(query);
  
  // 2. Usamos el estado inicial correcto
  const [matches, setMatches] = useState(media.matches);

  useEffect(() => {
    // 3. Creamos el 'listener'
    const listener = (event) => {
      setMatches(event.matches);
    };

    // 4. Usamos la API moderna para escuchar cambios
    media.addEventListener('change', listener);

    // 5. Limpiamos el 'listener' al desmontar
    return () => {
      media.removeEventListener('change', listener);
    };
    
    // 6. IMPORTANTE: El 'useEffect' solo depende de 'query'
    //    (la string de texto). No depende de 'matches'.
    //    Esto rompe el bucle infinito.
  }, [query]);

  return matches;
};


