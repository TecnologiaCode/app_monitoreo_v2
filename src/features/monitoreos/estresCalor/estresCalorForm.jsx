// src/features/monitoreos/estresCalor/components/estresCalorForm.jsx
// Formulario modular para agregar/editar registros de Estres por Calor.
// Recibe props:
//  - initialValues: objeto con valores para editar (o undefined para nuevo)
//  - visible: boolean (si el modal está abierto)
//  - onCancel: () => void
//  - onSubmit: async (values) => Promise
//  - loading: boolean (si se está guardando)

import React, { useEffect } from 'react';
import { Modal, Form, Row, Col, Input, Checkbox, TimePicker, InputNumber, Select } from 'antd';
import dayjs from 'dayjs';

const { TextArea } = Input;
const { Option } = Select;

export default function EstresCalorForm({ visible = false, initialValues = null, onCancel = () => {}, onSubmit = async () => {}, loading = false }) {
  const [form] = Form.useForm();

  // cuando cambian initialValues, setear en el form
  useEffect(() => {
    if (initialValues) {
      // convertimos measured_at a TimePicker (si existe)
      const horario = initialValues.measured_at ? dayjs(initialValues.measured_at) : null;
      form.setFieldsValue({ ...initialValues, horario });
    } else {
      form.resetFields();
    }
  }, [initialValues, form]);

  // manejar submit local y propagar payload
  const handleOk = async () => {
    try {
      const values = await form.validateFields();
      // mapear horario -> measured_at (ISO) si viene
      let measured_at = initialValues?.measured_at ?? null;
      if (values.horario) {
        const h = values.horario.hour();
        const m = values.horario.minute();
        const base = initialValues?.measured_at ? dayjs(initialValues.measured_at) : dayjs();
        measured_at = base.hour(h).minute(m).second(0).millisecond(0).format();
      }
      // mapear image_urls string -> array si es textarea
      let image_urls = values.image_urls;
      if (typeof image_urls === 'string' && image_urls.trim() !== '') {
        image_urls = image_urls.split(',').map(s => s.trim()).filter(Boolean);
      } else if (!image_urls) {
        image_urls = null;
      }

      // construir payload mínimo; la página puede completarlo si necesita
      const payload = {
        ...values,
        measured_at,
        image_urls
      };

      await onSubmit(payload);
    } catch (err) {
      // la validación de form mostrará errores automáticamente
      console.warn('EstresCalorForm submit error', err);
    }
  };

  return (
    <Modal
      title={initialValues ? 'Editar registro de Estrés Calor' : 'Agregar registro de Estrés Calor'}
      open={visible}
      onCancel={onCancel}
      onOk={handleOk}
      confirmLoading={loading}
      destroyOnHidden
      width={900}
    >
      <Form form={form} layout="vertical" preserve={false} initialValues={{}}>
        <Row gutter={12}>
          <Col span={12}>
            <Form.Item name="area" label="Área de Trabajo" rules={[{ required: true, message: 'Ingrese área' }]}>
              <Input />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="puesto_trabajo" label="Puesto de Trabajo" rules={[{ required: true, message: 'Ingrese puesto' }]}>
              <Input />
            </Form.Item>
          </Col>
        </Row>

        <Row gutter={12}>
          <Col span={12}>
            <Form.Item name="horario" label="Hora de medición" rules={[{ required: true, message: 'Ingrese hora' }]}>
              <TimePicker format="HH:mm" style={{ width: '100%' }} />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="interior_exterior" label="Interior / Exterior">
              <Select allowClear>
                <Option value="Interior">Interior</Option>
                <Option value="Exterior">Exterior</Option>
              </Select>
            </Form.Item>
          </Col>
        </Row>

        <Row gutter={12}>
          <Col span={8}>
            <Form.Item name="tasa_metabolica" label="Tasa metabólica (W)">
              <InputNumber style={{ width: '100%' }} />
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item name="hr_percent" label="% HR">
              <InputNumber style={{ width: '100%' }} />
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item name="vel_viento_ms" label="Vel. viento (m/s)">
              <InputNumber style={{ width: '100%' }} />
            </Form.Item>
          </Col>
        </Row>

        <Row gutter={12}>
          <Col span={8}>
            <Form.Item name="presion_mmhg" label="Presión (mmHg)">
              <InputNumber style={{ width: '100%' }} />
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item name="temp_c" label="Temp °C">
              <InputNumber style={{ width: '100%' }} />
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item name="wbgt_c" label="WBGT °C">
              <InputNumber style={{ width: '100%' }} />
            </Form.Item>
          </Col>
        </Row>

        <Row gutter={12}>
          <Col span={12}>
            <Form.Item name="tipo_ropa_cav" label="Tipo de ropa">
              <Input />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="capucha" valuePropName="checked" label="Capucha">
              <Checkbox />
            </Form.Item>
          </Col>
        </Row>

        <Form.Item name="image_urls" label="URLs Imágenes (separadas por coma)">
          <TextArea rows={3} placeholder="https://.../img1.jpg, https://.../img2.jpg" />
        </Form.Item>

        <Form.Item name="observaciones" label="Observaciones">
          <TextArea rows={3} />
        </Form.Item>
      </Form>
    </Modal>
  );
}
