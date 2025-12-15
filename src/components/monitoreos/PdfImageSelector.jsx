// src/components/monitoreos/PdfImageSelector.jsx
import React from 'react';
import { Checkbox, Button } from 'antd';

/**
 * Selector visual de imágenes para construir PDF.
 * Props:
 *  - rows: registros (con image_urls ya normalizado a array)
 *  - tempSelections: { id: indexSelected }
 *  - recordSelections: { id: boolean }
 *  - onToggleRecord, onPrevImage, onNextImage
 */
export default function PdfImageSelector({ rows = [], tempSelections = {}, recordSelections = {}, onToggleRecord = () => {}, onPrevImage = () => {}, onNextImage = () => {} }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, justifyContent: 'center' }}>
      {rows.filter(r => Array.isArray(r.image_urls) && r.image_urls.length > 0).map(r => {
        const imgs = r.image_urls || [];
        const idx = tempSelections[r.id] || 0;
        const isSel = recordSelections[r.id] === true;
        return (
          <div key={r.id} style={{ width: '23%', border: isSel ? '1px solid #ddd' : '1px dashed #999', opacity: isSel ? 1 : 0.6, padding: 8, position: 'relative', borderRadius: 6, background: '#fff' }}>
            <Checkbox checked={isSel} onChange={() => onToggleRecord(r.id)} style={{ position: 'absolute', top: 6, right: 6 }} />
            <div style={{ height: 140, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
              <img src={imgs[idx]} alt="" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }}>
              <Button size="small" onClick={() => onPrevImage(r.id, imgs.length)}>◀</Button>
              <div style={{ fontSize: 12, textAlign: 'center' }}>{r.puesto_trabajo}</div>
              <Button size="small" onClick={() => onNextImage(r.id, imgs.length)}>▶</Button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
