// backend/server.js
const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = 3000;

// Middlewares
app.use(cors()); // Permite peticiones desde el frontend
app.use(express.json()); // Permite recibir datos en formato JSON

// 1. Servir archivos estáticos (PDFs e imágenes)
// Esto hace que la carpeta 'files' de la raíz sea accesible desde /files en el navegador
app.use('/files', express.static(path.join(__dirname, '../files')));

// 2. Conectar a la Base de Datos SQLite
const dbPath = path.join(__dirname, 'db', 'biblioteca.sqlite');
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Error al conectar a la base de datos:', err.message);
    } else {
        console.log('✅ Conectado a la base de datos SQLite.');
        // Crear tablas si no existen al iniciar (ejecuta el schema.sql)
        db.exec(`
            CREATE TABLE IF NOT EXISTS areas (id INTEGER PRIMARY KEY AUTOINCREMENT, nombre TEXT NOT NULL UNIQUE);
            CREATE TABLE IF NOT EXISTS autores (id INTEGER PRIMARY KEY AUTOINCREMENT, nombre TEXT NOT NULL UNIQUE);
            CREATE TABLE IF NOT EXISTS libros (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                titulo TEXT NOT NULL,
                autor_id INTEGER,
                area_id INTEGER,
                año_publicacion INTEGER,
                editorial TEXT,
                sinopsis TEXT,
                ruta_pdf TEXT NOT NULL,
                ruta_portada TEXT,
                fecha_ingreso DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (autor_id) REFERENCES autores (id) ON DELETE SET NULL,
                FOREIGN KEY (area_id) REFERENCES areas (id) ON DELETE SET NULL
            );
        `);
    }
});

// 3. Rutas de la API

// Ruta de prueba
app.get('/', (req, res) => {
    res.send('API de la Biblioteca Virtual funcionando 🚀');
});

// Ruta para obtener todos los libros (con el nombre del autor y el área)
app.get('/api/libros', (req, res) => {
    const query = `
        SELECT 
            libros.id, libros.titulo, libros.año_publicacion, libros.editorial, 
            libros.sinopsis, libros.ruta_pdf, libros.ruta_portada,
            autores.nombre AS autor, 
            areas.nombre AS area
        FROM libros
        LEFT JOIN autores ON libros.autor_id = autores.id
        LEFT JOIN areas ON libros.area_id = areas.id
    `;
    
    db.all(query, [], (err, rows) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json(rows);
    });
});

// Iniciar el servidor
app.listen(PORT, () => {
    console.log(`🚀 Servidor corriendo en http://localhost:${PORT}`);
});