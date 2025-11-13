import React from 'react';
import { Page, Text, View, Document, StyleSheet, Image } from '@react-pdf/renderer';

// Estilos Base
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
    backgroundColor: '#2a8bb6', // Tu azul corporativo
    padding: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  headerTitle: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
    marginLeft: 20,
  },
  headerSubtitle: {
    color: '#e0e0e0',
    fontSize: 10,
    marginRight: 20,
  },
  // La celda base (el tamaño se sobreescribirá dinámicamente)
  gridItem: {
    padding: 5,
    boxSizing: 'border-box',
  },
  card: {
    border: '1pt solid #e0e0e0',
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 5,
    borderRadius: 4
  },
  imageContainer: {
    width: '95%',
    height: '75%', // Ajustamos un poco para dar aire
    marginBottom: 5,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center'
  },
  image: {
    objectFit: 'contain',
    width: '100%',
    height: '100%'
  },
  textContainer: {
    width: '100%',
    alignItems: 'center'
  },
  areaText: {
    fontSize: 9,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 2,
    color: '#2a8bb6',
    backgroundColor: '#f0f8ff',
    paddingHorizontal: 4,
    borderRadius: 2,
    width: '100%'
  },
  puestoText: {
    fontSize: 8,
    textAlign: 'center',
    color: '#333',
  },
  pageNumber: {
    position: 'absolute',
    fontSize: 8,
    bottom: 15,
    left: 0,
    right: 0,
    textAlign: 'center',
    color: 'grey',
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

export const ReporteFotografico = ({ data, empresa, layout = "2x4" }) => {
  // 1. Desglosamos el layout (ej: "2x4" -> cols=2, rows=4)
  const [colsStr, rowsStr] = layout.split('x');
  const cols = parseInt(colsStr);
  const rows = parseInt(rowsStr);

  // 2. Calculamos items por página
  const itemsPerPage = cols * rows;

  // 3. Calculamos ancho y alto dinámico
  // Restamos un pelín para márgenes seguros
  const itemWidth = `${100 / cols}%`; 
  const itemHeight = `${100 / rows}%`;

  const pages = chunkArray(data, itemsPerPage);

  return (
    <Document>
      {pages.map((pageItems, i) => (
        <Page key={i} size="LETTER" style={styles.page}>
          
          {/* ENCABEZADO FIJO */}
          <View style={styles.header} fixed>
             <View>
                <Text style={styles.headerTitle}>Resumen Fotográfico</Text>
                <Text style={{...styles.headerSubtitle, marginLeft: 20, fontSize: 8}}>
                    Generado por Metric
                </Text>
             </View>
             <Text style={styles.headerSubtitle}>{empresa}</Text>
          </View>

          {/* GRILLA DINÁMICA */}
          {pageItems.map((item, j) => (
            <View key={j} style={[styles.gridItem, { width: itemWidth, height: itemHeight }]}>
              <View style={styles.card}>
                
                {/* Título (Area) */}
                <Text style={styles.areaText} numberOfLines={1}>
                    {item.area || 'General'}
                </Text>
                
                {/* Imagen */}
                <View style={styles.imageContainer}>
                  <Image 
                    src={item.imageUrl} 
                    style={styles.image} 
                  />
                </View>

                {/* Pie (Puesto) */}
                <View style={styles.textContainer}>
                    <Text style={styles.puestoText} numberOfLines={2}>
                        {item.puesto}
                    </Text>
                </View>

              </View>
            </View>
          ))}

          {/* NUMERO DE PÁGINA */}
          <Text style={styles.pageNumber} render={({ pageNumber, totalPages }) => (
            `Página ${pageNumber} de ${totalPages}`
          )} fixed />
          
        </Page>
      ))}
    </Document>
  );
};