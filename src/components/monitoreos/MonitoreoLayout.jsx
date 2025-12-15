// src/components/monitoreos/MonitoreoLayout.jsx
import React from 'react';
import { Breadcrumb, Row, Col, Space, Button, Typography } from 'antd';
import { HomeOutlined, DatabaseOutlined, ArrowLeftOutlined } from '@ant-design/icons';
import { Link } from 'react-router-dom';

const { Title } = Typography;

/**
 * MonitoreoLayout
 * Props:
 *  - title: string (título de la página)
 *  - projectId: id del proyecto (para enlaces "volver")
 *  - onBack: function (volver al proyecto)
 *  - onBackToMonitoreos: function (volver a listado de monitoreos)
 *  - onDownloadImages: function
 *  - onExportExcel: function
 *  - onOpenPdf: function
 *  - onAdd: function
 *  - children: contenido (tabla, filtros, etc)
 *
 * Este layout centraliza el header para evitar duplicidad de botones.
 */

export default function MonitoreoLayout({
  title = 'Monitoreo',
  projectId,
  onBack,
  onBackToMonitoreos,
  onDownloadImages,
  onExportExcel,
  onOpenPdf,
  onAdd,
  children
}) {
  const breadcrumbItems = [
    { title: <Link to="/"><HomeOutlined /></Link> },
    { title: <Link to="/proyectos">Proyectos</Link> },
    { title: <Link to={`/proyectos/${projectId}/monitoreo`}><DatabaseOutlined /> Monitoreos</Link> },
    { title: title }
  ];

  return (
    <div style={{ padding: 16 }}>
      <Breadcrumb items={breadcrumbItems} style={{ marginBottom: 12 }} />
      <Row justify="space-between" align="middle" style={{ marginBottom: 12 }}>
        <Col>
          <Title level={2} style={{ margin: 0 }}>{title}</Title>
        </Col>
        <Col>
          <Space>
            <Button onClick={onBackToMonitoreos || (() => onBack && onBack())}><ArrowLeftOutlined /> Volver a Monitoreos</Button>
            {onDownloadImages ? <Button onClick={onDownloadImages}>Descargar Imágenes</Button> : null}
            {onExportExcel ? <Button onClick={onExportExcel}>Exportar a Excel</Button> : null}
            {onOpenPdf ? <Button onClick={onOpenPdf} style={{ backgroundColor: '#ff4d4f', color: 'white' }}>Reporte Fotos</Button> : null}
            {onAdd ? <Button type="primary" icon={<PlusOutlined />} onClick={onAdd}>Agregar</Button> : null}
          </Space>
        </Col>
      </Row>

      <div>
        {children}
      </div>
    </div>
  );
}

// Evitamos importar PlusOutlined arriba dos veces para keep minimal; si no lo encuentras, agrega:
// import { PlusOutlined } from '@ant-design/icons';

