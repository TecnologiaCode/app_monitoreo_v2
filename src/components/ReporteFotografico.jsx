import React from 'react';
import { Page, Text, View, Document, StyleSheet, Image } from '@react-pdf/renderer';

// Estilos Base actualizados para el nuevo diseño
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
  
  // --- ESTILOS DE LA TARJETA MODIFICADOS ---
  gridItem: {
    padding: 5,
    boxSizing: 'border-box',
  },
  // La tarjeta ahora no tiene padding, el borde lo es todo
  card: {
    border: '1pt solid #e0e0e0',
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'flex-start', // Alinea al inicio
    borderRadius: 3
  },
  // Nuevo: Encabezado de la tarjeta (celeste)
  cardHeader: {
    backgroundColor: '#f0f5ff', // Celeste claro
    padding: 5,
    borderBottom: '1pt solid #e0e0e0',
    width: '100%',
    alignItems: 'center' // <-- AÑADIDO: Centra los bloques de texto
  },
  cardHeaderText: {
    fontSize: 9,
    fontFamily: 'Helvetica',
    color: '#333',
    textAlign: 'center' // <-- AÑADIDO: Centra el texto dentro del bloque
  },
  // La imagen ocupa el espacio restante
  imageContainer: {
    flexGrow: 1, // Ocupa el espacio disponible
    padding: 5,
    width: '100%',
    height: '70%', // Damos altura para que se calcule
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center'
  },
  image: {
    objectFit: 'contain',
    width: '100%',
    height: '100%'
  },
  // Nuevo: Footer de la tarjeta
  cardFooter: {
    borderTop: '1pt solid #e0e0e0',
    padding: 4,
    width: '100%',
    alignItems: 'center'
  },
  cardFooterText: {
    fontSize: 8,
    fontFamily: 'Helvetica',
    color: '#555'
  },
footer: {
    position: 'absolute',
    bottom: 15,
    left: 30, // Alineado con el padding de la página
    right: 30, // Alineado con el padding de la página
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

// Helper para paginar (sin cambios)
const chunkArray = (array, size) => {
  const chunked = [];
  for (let i = 0; i < array.length; i += size) {
    chunked.push(array.slice(i, i + size));
  }
  return chunked;
};

// Componente (sin cambios en props)
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
          
          {/* ENCABEZADO FIJO (Sin cambios) */}
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
              
              {/* --- ESTRUCTURA DE TARJETA ACTUALIZADA --- */}
              <View style={styles.card}>
                
                {/* Encabezado con datos */}
                <View style={styles.cardHeader}>
                  <Text style={styles.cardHeaderText}>Código: {item.codigo || '-'}</Text>
                  <Text style={styles.cardHeaderText}>Área: {item.area || '-'}</Text>
                  <Text style={styles.cardHeaderText}>Punto de monitoreo: {item.puesto || '-'}</Text>
                </View>

                {/* Imagen */}
                <View style={styles.imageContainer}>
                  <Image 
                    src={item.imageUrl} 
                    style={styles.image} 
                  />
                </View>

                {/* Footer con Fecha/Hora */}
                <View style={styles.cardFooter}>
                  <Text style={styles.cardFooterText}>Fecha y hora: {item.fechaHora || '-'}</Text>
                </View>

              </View>
            </View>
          ))}

          {/* PIE DE PÁGINA ACTUALIZADO */}
          <View style={styles.footer} fixed>
            
            {/* Lado Izquierdo */}
            <View style={styles.footerLeft}>
              <Text style={styles.footerText}>
                Realizado por: <Text style={styles.footerBold}>PACHABOL S.R.L.</Text>
              </Text>
              <Text style={styles.footerText}>
                Generado por: <Text style={styles.footerBold}>Metric v3.0</Text>
              </Text>
            </View>

            {/* Lado Derecho */}
            <Text style={styles.footerRight} render={({ pageNumber, totalPages }) => (
              `Página: ${pageNumber} de ${totalPages}`
            )} />
          </View>
          
        </Page>
      ))}
    </Document>
  );
};