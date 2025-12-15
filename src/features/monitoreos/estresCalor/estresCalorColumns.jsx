// src/features/monitoreos/estresCalor/components/estresCalorColumns.jsx
// Este archivo exporta una función que crea las columnas para la tabla
// de Estres por Calor. Recibe un objeto con dependencias (handlers, estados)
// para no acoplar la definición de columnas con el resto de la página.

import React from 'react';
import { Button, Space, Tooltip, Typography } from 'antd';
import { EditOutlined, DeleteOutlined, EyeOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';

// desestructuramos Text para usar en renderizados
const { Text } = Typography;

/**
 * getEstresCalorColumns
 * @param {Object} deps - Dependencias e handlers inyectados
 * @param {Function} deps.handleEdit - (record) => void
 * @param {Function} deps.handleDelete - (record) => void
 * @param {Function} deps.openImageViewer - (imgs, idx) => void
 * @param {Object} deps.usersById - mapping id -> displayName
 * @param {Number} deps.pageSize
 * @param {Number} deps.currentPage
 *
 * Devuelve: Array columnas para <Table />
 */
export default function getEstresCalorColumns({
  handleEdit = () => {},
  handleDelete = () => {},
  openImageViewer = () => {},
  usersById = {},
  pageSize = 10,
  currentPage = 1
} = {}) {
  // helper local para formatear fecha/hora (evita duplicar lógica)
  const formatFechaUTC = (v) => {
    if (!v) return '';
    try { return dayjs(v).utc().format('DD/MM/YYYY'); } catch { return String(v); }
  };
  const formatHoraUTC = (v) => {
    if (!v) return '';
    try { return dayjs(v).utc().format('HH:mm'); } catch { return String(v); }
  };

  return [
    {
      title: 'N°',
      key: 'n',
      width: 40,
      // calculamos índice global en base a page + pageSize
      render: (_, __, i) => (currentPage - 1) * pageSize + i + 1
    },
    {
      title: 'FECHA',
      dataIndex: 'measured_at',
      width: 90,
      sorter: (a, b) => dayjs(a.measured_at).unix() - dayjs(b.measured_at).unix(),
      defaultSortOrder: 'ascend',
      render: (t) => formatFechaUTC(t)
    },
    {
      title: 'HORA',
      dataIndex: 'measured_at',
      key: 'measured_time',
      width: 60,
      sorter: (a, b) => dayjs(a.measured_at).unix() - dayjs(b.measured_at).unix(),
      render: (t) => formatHoraUTC(t)
    },
    { 
      title: 'AREA DE TRABAJO', 
      dataIndex: 'area', 
      key: 'area', 
      width: 200, 
      ellipsis: true 
    },
    { 
      title: 'PUESTO DE TRABAJO', 
      dataIndex: 'puesto_trabajo', 
      key: 'puesto_trabajo', 
      width: 250, 
      ellipsis: true 
    },
    { 
      title: 'INTERIOR/EXTERIOR', 
      dataIndex: 'interior_exterior', 
      key: 'interior_exterior', 
      width: 150 
    },
    {
      title: 'ACLIMATADO',
      dataIndex: 'aclimatado',
      key: 'aclimatado',
      width: 100,
      render: (v) =>
        (String(v) === 'true' ? 'Sí' : String(v) === 'false' ? 'No' : String(v ?? ''))
    },
    {
      title: 'DESCRIPCIÓN DE ACTIVIDADES',
      dataIndex: 'desc_actividades',
      key: 'desc_actividades',
      width: 260,
      ellipsis: true
    },
    {
      title: 'TASA METABÓLICA W',
      dataIndex: 'tasa_metabolica',
      key: 'tasa_metabolica',
      width: 200,
      ellipsis: true
    },
    {
      title: 'RESULTADOS DEL EQUIPO',
      children: [
        { title: '%HR', dataIndex: 'hr_percent', key: 'hr_percent', width: 90 },
        { title: 'VEL. VIENTO (m/s)', dataIndex: 'vel_viento_ms', key: 'vel_viento_ms', width: 140 },
        { title: 'P (mmHg)', dataIndex: 'presion_mmhg', key: 'presion_mmhg', width: 110 },
        { title: 'TEMP °C', dataIndex: 'temp_c', key: 'temp_c', width: 100 },
        { title: 'WBGT °C', dataIndex: 'wbgt_c', key: 'wbgt_c', width: 100 },
        { title: 'WB °C', dataIndex: 'wb_c', key: 'wb_c', width: 100 },
        { title: 'GT °C', dataIndex: 'gt_c', key: 'gt_c', width: 100 }
      ]
    },
    {
      title: 'COORDENADAS UTM',
      dataIndex: 'location',
      key: 'location',
      width: 240,
      render: (v) => {
        // renderizamos texto simple; no intentamos parseo complejo aquí
        if (!v) return <Text type="secondary">N/A</Text>;
        try {
          if (typeof v === 'object') {
            const lat = v.lat ?? v.latitude ?? '';
            const lng = v.lng ?? v.longitude ?? '';
            if (lat !== '' || lng !== '') return <span>lat: {lat}{lng !== '' ? `, lng: ${lng}` : ''}</span>;
            const e = v.easting ?? '';
            const n = v.northing ?? '';
            const z = v.utm_zone ?? '';
            if (e !== '' || n !== '' || z !== '') return <span>{`E: ${e}${n !== '' ? `, N: ${n}` : ''}${z ? `, Z: ${z}` : ''}`}</span>;
            if (Array.isArray(v)) return v.join(', ');
            return <span>{JSON.stringify(v)}</span>;
          }
          const parsed = JSON.parse(v);
          return <span>{JSON.stringify(parsed)}</span>;
        } catch {
          return <span>{String(v)}</span>;
        }
      }
    },
    {
      title: 'IMÁGENES',
      dataIndex: 'image_urls',
      key: 'image_urls',
      width: 140,
      render: (imgs) => {
        const list = Array.isArray(imgs) ? imgs : [];
        if (!list.length) return <Text type="secondary">Ninguna</Text>;
        // boton para abrir visor (handler inyectado)
        return (
          <Button type="link" icon={<EyeOutlined />} onClick={() => openImageViewer(list, 0)} size="small">
            Ver imagen
          </Button>
        );
      }
    },
    { 
      title: 'OBSERVACIÓN', 
      dataIndex: 'observaciones', 
      key: 'observaciones', 
      width: 240, 
      ellipsis: true 
    },
    
    {
      title: 'Registrado por',
      dataIndex: 'created_by',
      key: 'created_by',
      width: 120,
      fixed: 'right',
      render: (v) => {
        if (!v) return <Text type="secondary">N/A</Text>;
        const display = usersById[v];
        return display ? <Text>{display}</Text> : <Text type="secondary">{v}</Text>;
      }
    },
    {
      title: 'Acciones',
      key: 'acciones',
      fixed: 'right',
      width: 120,
      render: (_, record) => (
        <Space size="small">
          <Tooltip title="Editar"><Button icon={<EditOutlined />} onClick={() => handleEdit(record)} /></Tooltip>
          <Tooltip title="Eliminar"><Button danger icon={<DeleteOutlined />} onClick={() => handleDelete(record)} /></Tooltip>
        </Space>
      )
    }
  ];
}
