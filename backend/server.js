// backend/server.js
const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const path = require('path');
const multer = require('multer');
const fs = require('fs');
const jwt = require('jsonwebtoken'); // <-- Importamos JWT

const app = express();
const PORT = 3000;
const SECRET_KEY = 'ClaveSuperSecretaBiblioteca2026'; // Clave para firmar los tokens

// Middlewares
app.use(cors());
app.use(express.json());

// Servir archivos estáticos
app.use('/files', express.static(path.join(__dirname, '../files')));

// 1. Configuración de Multer (Subida de archivos)
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        let folder = 'files/libros/'; 
        if (file.fieldname === 'portada') {
            folder = 'files/portadas/';
        }
        const dir = path.join(__dirname, '..', folder);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        cb(null, dir);
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    }
});
const upload = multer({ storage: storage });

// 2. Conectar a la Base de Datos
const dbPath = path.join(__dirname, 'db', 'biblioteca.sqlite');
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) console.error('Error al conectar a la base de datos:', err.message);
    else console.log('✅ Conectado a la base de datos SQLite.');
});

// 3. MIDDLEWARE DE SEGURIDAD (Debe ir ANTES de usarse en las rutas)
function verificarToken(req, res, next) {
    const bearerHeader = req.headers['authorization'];
    
    if (typeof bearerHeader !== 'undefined') {
        const token = bearerHeader.split(' ')[1]; // Formato: "Bearer <token>"
        
        jwt.verify(token, SECRET_KEY, (err, authData) => {
            if (err) {
                res.status(403).json({ error: 'Token inválido o expirado. Vuelve a iniciar sesión.' });
            } else {
                req.authData = authData;
                next(); // El token es válido, dejamos pasar
            }
        });
    } else {
        res.status(403).json({ error: 'Acceso denegado. No hay token.' });
    }
}

// 4. Rutas de la API

// RUTA DE LOGIN (Pública)
app.post('/api/login', (req, res) => {
    const { password } = req.body;
    
    if (password === 'admin123') { 
        const token = jwt.sign({ role: 'admin' }, SECRET_KEY, { expiresIn: '2h' });
        res.json({ token });
    } else {
        res.status(401).json({ error: 'Contraseña incorrecta' });
    }
});

// Obtener libros con filtros (Pública)
app.get('/api/libros', (req, res) => {
    const { q, area } = req.query;
    let query = `
        SELECT libros.id, libros.titulo, libros.año_publicacion, libros.editorial, 
        libros.sinopsis, libros.ruta_archivo, libros.formato, libros.ruta_portada,
        autores.nombre AS autor, areas.nombre AS area
        FROM libros
        LEFT JOIN autores ON libros.autor_id = autores.id
        LEFT JOIN areas ON libros.area_id = areas.id
        WHERE 1=1
    `;
    let params = [];

    if (q) {
        query += ` AND (libros.titulo LIKE ? OR autores.nombre LIKE ? OR libros.sinopsis LIKE ?)`;
        const searchTerm = `%${q}%`;
        params.push(searchTerm, searchTerm, searchTerm);
    }
    if (area) {
        query += ` AND areas.nombre = ?`;
        params.push(area);
    }
    query += ` ORDER BY libros.fecha_ingreso DESC`;

    db.all(query, params, (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

// Obtener áreas (Pública)
app.get('/api/areas', (req, res) => {
    db.all(`SELECT nombre FROM areas ORDER BY nombre ASC`, [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

// Agregar un libro (PROTEGIDA)
app.post('/api/libros', verificarToken, upload.fields([{ name: 'archivo_libro', maxCount: 1 }, { name: 'portada', maxCount: 1 }]), (req, res) => {
    const { titulo, autor, area, año_publicacion, editorial, sinopsis, formato } = req.body;
    
    if (!req.files || !req.files['archivo_libro']) {
        return res.status(400).json({ error: 'El archivo del libro es obligatorio.' });
    }

    const archivoLibro = req.files['archivo_libro'][0];
    const portada = req.files['portada'] ? req.files['portada'][0] : null;

    const rutaArchivo = 'libros/' + archivoLibro.filename;
    const rutaPortada = portada ? '/files/portadas/' + portada.filename : null;

    db.serialize(() => {
        db.run('BEGIN TRANSACTION');

        db.get(`SELECT id FROM autores WHERE nombre = ?`, [autor], (err, rowAutor) => {
            let autorId;
            if (!rowAutor) {
                db.run(`INSERT INTO autores (nombre) VALUES (?)`, [autor], function(err) {
                    autorId = this.lastID;
                    procesarArea(autorId);
                });
            } else {
                autorId = rowAutor.id;
                procesarArea(autorId);
            }

            function procesarArea(idAutorFinal) {
                db.get(`SELECT id FROM areas WHERE nombre = ?`, [area], (err, rowArea) => {
                    let areaId;
                    if (!rowArea) {
                        db.run(`INSERT INTO areas (nombre) VALUES (?)`, [area], function(err) {
                            areaId = this.lastID;
                            insertarLibro(idAutorFinal, areaId);
                        });
                    } else {
                        areaId = rowArea.id;
                        insertarLibro(idAutorFinal, areaId);
                    }
                });
            }

            function insertarLibro(idAutorFinal, idAreaFinal) {
                const query = `INSERT INTO libros (titulo, autor_id, area_id, año_publicacion, editorial, sinopsis, ruta_archivo, formato, ruta_portada) 
                               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`;
                db.run(query, [titulo, idAutorFinal, idAreaFinal, año_publicacion, editorial, sinopsis, rutaArchivo, formato, rutaPortada], function(err) {
                    if (err) {
                        db.run('ROLLBACK');
                        return res.status(500).json({ error: err.message });
                    }
                    db.run('COMMIT');
                    res.status(201).json({ message: 'Libro agregado con éxito', id: this.lastID });
                });
            }
        });
    });
});

// Actualizar portada (PROTEGIDA)
app.put('/api/libros/:id/portada', verificarToken, upload.fields([{ name: 'portada', maxCount: 1 }]), (req, res) => {
    const { id } = req.params;
    const nuevaPortada = req.files && req.files['portada'] ? req.files['portada'][0] : null;

    if (!nuevaPortada) {
        return res.status(400).json({ error: 'Debes subir una imagen de portada.' });
    }

    db.get('SELECT ruta_portada FROM libros WHERE id = ?', [id], (err, row) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!row) return res.status(404).json({ error: 'Libro no encontrado' });

        if (row.ruta_portada) {
            const rutaViejaFisica = path.join(__dirname, '..', row.ruta_portada);
            if (fs.existsSync(rutaViejaFisica)) fs.unlinkSync(rutaViejaFisica);
        }

        const nuevaRutaPortada = '/files/portadas/' + nuevaPortada.filename;
        
        db.run('UPDATE libros SET ruta_portada = ? WHERE id = ?', [nuevaRutaPortada, id], function(err) {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ message: 'Portada actualizada correctamente', ruta_portada: nuevaRutaPortada });
        });
    });
});

// Eliminar un libro (PROTEGIDA)
app.delete('/api/libros/:id', verificarToken, (req, res) => {
    const { id } = req.params;
    
    db.get('SELECT ruta_archivo, ruta_portada FROM libros WHERE id = ?', [id], (err, row) => {
        if (row) {
            if (row.ruta_archivo) {
                const rutaFisicaLibro = path.join(__dirname, '../files', row.ruta_archivo);
                if (fs.existsSync(rutaFisicaLibro)) fs.unlinkSync(rutaFisicaLibro);
            }
            if (row.ruta_portada) {
                const rutaFisicaPortada = path.join(__dirname, '..', row.ruta_portada);
                if (fs.existsSync(rutaFisicaPortada)) fs.unlinkSync(rutaFisicaPortada);
            }
        }

        db.run('DELETE FROM libros WHERE id = ?', [id], function(err) {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ message: 'Libro eliminado correctamente' });
        });
    });
});

app.listen(PORT, () => {
    console.log(`🚀 Servidor corriendo en http://localhost:${PORT}`);
});