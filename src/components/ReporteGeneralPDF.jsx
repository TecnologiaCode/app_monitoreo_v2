import React from 'react';
import { Page, Text, View, Document, StyleSheet, Image } from '@react-pdf/renderer';

// Estilos
const styles = StyleSheet.create({
  page: { padding: 30, backgroundColor: '#fff' },
  header: { 
    fontSize: 24, 
    marginBottom: 20, 
    textAlign: 'center', 
    color: '#2a8bb6',
    fontWeight: 'bold'
  },
  section: { marginBottom: 15 },
  monitoreoTitle: {
    fontSize: 16,
    backgroundColor: '#f0f0f0',
    padding: 5,
    marginBottom: 10,
    fontWeight: 'bold'
  },
  row: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#eee', paddingVertical: 4 },
  cell: { fontSize: 10, width: '25%' }, // Ajustar anchos según necesidad
  imageGrid: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 10 },
  imageWrapper: { width: '33%', padding: 2 },
  image: { width: '100%', height: '100%', objectFit: 'contain' }
});

export const ReporteGeneralPDF = ({ data, proyectoInfo }) => {
  return (
    <Document>
      {/* PORTADA */}
      <Page size="LETTER" style={styles.page}>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
            <Text style={styles.header}>REPORTE GENERAL DE MONITOREO</Text>
            <Text style={{ fontSize: 14, marginTop: 10 }}>Proyecto: {proyectoInfo?.nombre || 'General'}</Text>
            <Text style={{ fontSize: 12, marginTop: 5, color: 'grey' }}>
                Fecha de generación: {new Date().toLocaleDateString()}
            </Text>
        </View>
      </Page>

      {/* CONTENIDO POR MONITOREO */}
      {data.map((item, index) => (
        <Page key={index} size="LETTER" style={styles.page}>
            <Text style={styles.monitoreoTitle}>{item.titulo}</Text>
            <Text style={{ fontSize: 10, marginBottom: 10, color: '#555' }}>
                {item.descripcion || 'Sin descripción'} - Puntos Totales: {item.puntosTotales}
            </Text>

            {/* TABLA DE DATOS BÁSICA */}
            <View style={{ marginBottom: 10 }}>
                <View style={[styles.row, { backgroundColor: '#e6f7ff', borderBottomWidth: 2 }]}>
                    <Text style={styles.cell}>Fecha</Text>
                    <Text style={styles.cell}>Área</Text>
                    <Text style={styles.cell}>Puesto</Text>
                    {/* Puedes agregar columnas dinámicas aquí si quieres */}
                </View>
                
                {item.datos.map((d, i) => (
                    <View key={i} style={styles.row}>
                        <Text style={styles.cell}>
                            {d.measured_at ? new Date(d.measured_at).toLocaleDateString() : '-'}
                        </Text>
                        <Text style={styles.cell}>{d.area || '-'}</Text>
                        <Text style={styles.cell}>{d.puesto_trabajo || '-'}</Text>
                    </View>
                ))}
            </View>

            {/* SECCIÓN DE FOTOS (Si se seleccionó en la config) */}
            {item.config.incluirFotos && (
                <View break={false}>
                    <Text style={{ fontSize: 12, fontWeight: 'bold', marginTop: 10 }}>Evidencia Fotográfica</Text>
                    <View style={styles.imageGrid}>
                        {item.datos.map((d) => {
                            // Extraer primera imagen si existe (ajusta según tu lógica de arrays/strings)
                            let imgUrl = null;
                            if(Array.isArray(d.image_urls) && d.image_urls.length > 0) imgUrl = d.image_urls[0];
                            else if (typeof d.image_urls === 'string' && d.image_urls) imgUrl = d.image_urls.split(',')[0];

                            if (!imgUrl) return null;

                            return (
                                <View key={d.id} style={styles.imageWrapper}>
                                    {/* Usamos encodeURI y timestamp para evitar problemas de caché/caracteres */}
                                    <Image src={encodeURI(imgUrl.trim()) + "?t=" + new Date().getTime()} style={styles.image} />
                                    <Text style={{ fontSize: 8, textAlign: 'center' }}>{d.puesto_trabajo}</Text>
                                </View>
                            );
                        })}
                    </View>
                </View>
            )}
        </Page>
      ))}
    </Document>
  );
};