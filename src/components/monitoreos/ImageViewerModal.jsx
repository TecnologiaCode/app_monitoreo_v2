// src/components/monitoreos/ImageViewerModal.jsx
import React from 'react';
import { Modal, Button, Typography } from 'antd';
const { Text } = Typography;

export default function ImageViewerModal({ open, images = [], index = 0, onClose = () => {}, onIndexChange = () => {} }) {
  const len = Array.isArray(images) ? images.length : 0;
  const safeIndex = Math.min(Math.max(0, index || 0), Math.max(0, len - 1));
  return (
    <Modal
      open={open}
      onCancel={onClose}
      centered
      width={720}
      title="Imagen del registro"
      footer={
        len > 1 ? [
          <Button key="prev" onClick={() => onIndexChange((safeIndex - 1 + len) % len)}>Anterior</Button>,
          <Button key="next" type="primary" onClick={() => onIndexChange((safeIndex + 1) % len)}>Siguiente</Button>
        ] : null
      }
    >
      {len > 0 ? (
        <div style={{ textAlign: 'center' }}>
          <img src={images[safeIndex]} alt={`img-${safeIndex}`} style={{ maxWidth: '100%', maxHeight: '70vh', objectFit: 'contain' }} />
          <div style={{ marginTop: 12 }}><Text>{safeIndex + 1} / {len}</Text></div>
        </div>
      ) : (
        <Text type="secondary">Sin imagen.</Text>
      )}
    </Modal>
  );
}
