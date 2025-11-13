// src/pages/MapaPage.jsx

import React from 'react';
import {
    Table, Input, Button, Modal, Form,
    Select, Typography, Tag, Space, Tooltip, message
} from 'antd';

const { Title, Text } = Typography; // Importamos 'Text' para la etiqueta

// Color Naranja Suave para acento: #feac46
const ACCENT_ORANGE = '#feac46';

// Color Azul Primario para acentos y encabezados: #2a8bb6
const PRIMARY_BLUE = '#2a8bb6';

const MapaPage = () => {
    // Definimos el enlace de la ubicación que quieres mostrar.
    // Usamos el formato de incrustación (embed) de Google Maps.
    // IMPORTANTE: Un enlace de Google Maps normal (maps.app.goo.gl) no funciona. 
    // Necesitas el código de incrustación de Google Maps (que empieza con https://www.google.com/maps/embed/v1/place?key=...).
    // Por simplicidad, usaremos un iframe genérico o simulado, ya que la API Key es necesaria para un mapa real.

    const googleMapsEmbedUrl = "https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d15278.43577319323!2d-68.125717!3d-16.500200!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x915f206e14a2736b%3A0x6b77d6117565c400!2sLa%20Paz%2C%20Bolivia!5e0!3m2!1sen!2sus!4v1700000000000!5m2!1sen!2sus";

    return (

        <div>
            <Title level={1}> <h1 style={{ color: PRIMARY_BLUE, fontWeight: 'bold' }}>🗺️ Mapa en Tiempo Real</h1></Title>
            <Typography.Text type="secondary">
                Vista satelital y ubicación de los puntos de monitoreo.
            </Typography.Text>


            <div style={{
                height: '500px',
                border: `2px solid ${ACCENT_ORANGE}`, // Enfatizamos el contenedor con el color de acento
                borderRadius: '8px',
                overflow: 'hidden',
                marginTop: '20px'
            }}>

                {/* EXPLICACIÓN: 
                  Usamos un iframe para incrustar un mapa interactivo directamente.
                  El atributo 'frameborder="0"' y 'style' asegura que el mapa ocupe todo el div contenedor.
                */}
                <iframe
                    title="Ubicación de Monitoreo" // Título accesible
                    src="https://articles-img.sftcdn.net/t_article_cover_xl/auto-mapping-folder/sites/2/2023/11/maps.jpg" // La URL de incrustación del mapa
                    width="100%" // Ocupa el 100% del ancho del div padre
                    height="100%" // Ocupa el 100% de la altura del div padre
                    style={{ border: 0 }} // Eliminamos el borde predeterminado del iframe
                    allowFullScreen="" // Permite al usuario ver el mapa en pantalla completa
                    loading="lazy" // Carga diferida para optimizar el rendimiento
                    referrerPolicy="no-referrer-when-downgrade"
                />*
            </div>
        </div>
    );
};

export default MapaPage;