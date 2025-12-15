import React from 'react';
import { Document, Page, Image, Text, View, StyleSheet } from '@react-pdf/renderer';

// Estilos Base Restaurados al Diseño Original
const styles = StyleSheet.create({
  page: {
    paddingTop: 70, // Espacio para el encabezado fijo
    paddingBottom: 40,
    paddingHorizontal: 20,
    flexDirection: 'row',
    flexWrap: 'wrap',
    backgroundColor: '#ffffff'
  },
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 60,
    backgroundColor: '#2a8bb6',
    paddingHorizontal: 25,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  headerLeft: {
    flexDirection: 'column',
  },
  headerRight: {
    flexDirection: 'column',
    alignItems: 'flex-end',
    maxWidth: '50%'
  },
  headerTitle: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
    fontFamily: 'Helvetica-Bold'
  },
  headerSubtitle: {
    color: 'white',
    fontSize: 11,
    fontFamily: 'Helvetica'
  },
  headerProjectText: {
    color: 'white',
    fontSize: 10,
    fontFamily: 'Helvetica',
    textAlign: 'right'
  },
  
  // --- ESTILOS DE LA TARJETA ---
  gridItem: {
    padding: 5,
    boxSizing: 'border-box',
  },
  // La tarjeta completa
  card: {
    border: '1pt solid #e0e0e0',
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-between', 
    borderRadius: 3,
    overflow: 'hidden'
  },
  // Encabezado de la tarjeta (celeste)
  cardHeader: {
    backgroundColor: '#f0f5ff', // Celeste claro
    paddingVertical: 4,
    paddingHorizontal: 2,
    borderBottom: '1pt solid #e0e0e0',
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0
  },
  cardHeaderText: {
    fontSize: 8,
    fontFamily: 'Helvetica',
    color: '#333',
    textAlign: 'center',
    marginBottom: 1
  },
  // Contenedor de la imagen (Original style)
  imageContainer: {
    flexGrow: 1, 
    width: '100%',
    padding: 2,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 0 
  },
  image: {
    objectFit: 'contain', // Mantiene proporción (Vertical/Horizontal)
    objectPosition: 'center',
    width: '100%',
    height: '100%'
  },
  // Footer de la tarjeta
  cardFooter: {
    borderTop: '1pt solid #e0e0e0',
    padding: 4,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    flexShrink: 0 
  },
  cardFooterText: {
    fontSize: 8,
    fontFamily: 'Helvetica',
    color: '#555'
  },
  footer: {
    position: 'absolute',
    bottom: 15,
    left: 30, 
    right: 30, 
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  footerLeft: {
    flexDirection: 'column',
  },
  footerText: {
    fontSize: 9,
    fontFamily: 'Helvetica',
    color: '#333',
  },
  footerBold: {
    fontFamily: 'Helvetica-Bold',
    color: '#000',
  },
  footerRight: {
    fontSize: 9,
    fontFamily: 'Helvetica',
    color: '#333',
  }
});

// Helper para paginar
const chunkArray = (array, size) => {
  const chunked = [];
  for (let i = 0; i < array.length; i += size) {
    chunked.push(array.slice(i, i + size));
  }
  return chunked;
};

export const ReporteFotografico = ({ data, empresa, layout = "2x4", tituloMonitoreo }) => {
  const [colsStr, rowsStr] = layout.split('x');
  const cols = parseInt(colsStr);
  const rows = parseInt(rowsStr);
  const itemsPerPage = cols * rows;
  const itemWidth = `${100 / cols}%`; 
  const itemHeight = `${100 / rows}%`;
  const pages = chunkArray(data, itemsPerPage);

  return (
    <Document>
      {pages.map((pageItems, i) => (
        <Page key={i} size="LETTER" style={styles.page}>
          
          {/* ENCABEZADO FIJO */}
          <View style={styles.header} fixed>
            <View style={styles.headerLeft}>
              <Text style={styles.headerTitle}>REPORTE FOTOGRÁFICO</Text>
              <Text style={styles.headerSubtitle}>
                MONITOREO DE: {tituloMonitoreo ? tituloMonitoreo.toUpperCase() : 'GENERAL'}
              </Text>
            </View>
            <View style={styles.headerRight}>
              <Text style={styles.headerProjectText}>
                PROYECTO: {empresa ? empresa.toUpperCase() : 'SIN PROYECTO'}
              </Text>
            </View>
          </View>

          {/* GRILLA DINÁMICA */}
          {pageItems.map((item, j) => (
            <View key={j} style={[styles.gridItem, { width: itemWidth, height: itemHeight }]}>
              
              <View style={styles.card}>
                {/* Encabezado con datos */}
                <View style={styles.cardHeader}>
                  <Text style={styles.cardHeaderText}>Código: {item.codigo || '-'}</Text>
                  <Text style={styles.cardHeaderText}>Área: {item.area || '-'}</Text>
                  <Text style={styles.cardHeaderText}>Punto: {item.puesto || '-'}</Text>
                </View>

                {/* Imagen */}
                <View style={styles.imageContainer}>
                  {item.imageUrl ? (
                    <Image 
                      src={item.imageUrl} 
                      style={styles.image} 
                    />
                  ) : (
                    <Text style={{ fontSize: 8, color: '#999' }}>Sin Imagen</Text>
                  )}
                </View>

                {/* Footer con Fecha/Hora */}
                <View style={styles.cardFooter}>
                  <Text style={styles.cardFooterText}>Fecha y hora: {item.fechaHora || '-'}</Text>
                </View>

              </View>
            </View>
          ))}

          {/* PIE DE PÁGINA */}
          <View style={styles.footer} fixed>
            <View style={styles.footerLeft}>
              <Text style={styles.footerText}>
                Realizado por: <Text style={styles.footerBold}>PACHABOL S.R.L.</Text>
              </Text>
              <Text style={styles.footerText}>
                Generado por: <Text style={styles.footerBold}>Metric v3.0</Text>
              </Text>
            </View>
            <Text style={styles.footerRight} render={({ pageNumber, totalPages }) => (
              `Página: ${pageNumber} de ${totalPages}`
            )} />
          </View>
          
        </Page>
      ))}
    </Document>
  );
};


