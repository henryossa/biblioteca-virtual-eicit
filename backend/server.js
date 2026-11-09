// backend/server.js
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const { createClient } = require('@supabase/supabase-js');
const jwt = require('jsonwebtoken');
const multer = require('multer');

const app = express();
const PORT = process.env.PORT || 3000;

// 1. Configuración de CORS
const allowedOrigins = [
  'https://biblioteca-virtual-eicit-frontend.vercel.app',
  'http://localhost:3000',
  'http://127.0.0.1:5500'
];

const corsOptions = {
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('No permitido por CORS'));
    }
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
};

app.use(cors(corsOptions)); // Aplica la configuración
app.use(express.json());

// 2. Configuración de Supabase y Base de Datos
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

// 3. Configuración de Multer
const upload = multer({ storage: multer.memoryStorage() });


app.use(cors({
  origin: function (origin, callback) {
    // Permite peticiones sin origen (como Postman) o si está en la lista
    if (!origin || allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('No permitido por CORS'));
    }
  }
}));

//app.use(cors());
app.use(express.json());

// --- MIDDLEWARE DE SEGURIDAD ---
function verificarToken(req, res, next) {
    const bearerHeader = req.headers['authorization'];
    if (typeof bearerHeader !== 'undefined') {
        const token = bearerHeader.split(' ')[1];
        jwt.verify(token, process.env.JWT_SECRET, (err, authData) => {
            if (err) res.status(403).json({ error: 'Token inválido o expirado.' });
            else { req.authData = authData; next(); }
        });
    } else {
        res.status(403).json({ error: 'Acceso denegado. No hay token.' });
    }
}

// --- RUTAS ---

app.post('/api/login', (req, res) => {
    const { password } = req.body;
    if (password === process.env.ADMIN_PASSWORD) { 
        const token = jwt.sign({ role: 'admin' }, process.env.JWT_SECRET, { expiresIn: '2h' });
        res.json({ token });
    } else {
        res.status(401).json({ error: 'Contraseña incorrecta' });
    }
});

app.get('/api/libros', async (req, res) => {
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
    let paramCount = 1;

    if (q) {
        query += ` AND (libros.titulo ILIKE $${paramCount} OR autores.nombre ILIKE $${paramCount} OR libros.sinopsis ILIKE $${paramCount})`;
        params.push(`%${q}%`);
        paramCount++;
    }
    if (area) {
        query += ` AND areas.nombre = $${paramCount}`;
        params.push(area);
    }
    query += ` ORDER BY libros.fecha_ingreso DESC`;

    try {
        const result = await pool.query(query, params);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/areas', async (req, res) => {
    try {
        const result = await pool.query(`SELECT nombre FROM areas ORDER BY nombre ASC`);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/libros', verificarToken, upload.fields([{ name: 'archivo_libro', maxCount: 1 }, { name: 'portada', maxCount: 1 }]), async (req, res) => {
    const { titulo, autor, area, año_publicacion, editorial, sinopsis, formato } = req.body;
    
    if (!req.files || !req.files['archivo_libro']) {
        return res.status(400).json({ error: 'El archivo del libro es obligatorio.' });
    }

    try {
        // 1. Subir Archivo del libro a Supabase
        const archivoLibro = req.files['archivo_libro'][0];
        const nombreArchivo = `${Date.now()}-${archivoLibro.originalname.replace(/\s+/g, '_')}`;
        const { error: errorSubidaLibro } = await supabase.storage.from('libros').upload(nombreArchivo, archivoLibro.buffer, { contentType: archivoLibro.mimetype });
        if (errorSubidaLibro) throw new Error('Error al subir el libro: ' + errorSubidaLibro.message);
        const { data: publicUrlLibro } = supabase.storage.from('libros').getPublicUrl(nombreArchivo);
        const rutaArchivo = publicUrlLibro.publicUrl;
        
        // 2. Subir Portada (si existe)
        let rutaPortada = null;
        if (req.files['portada']) {
            const portada = req.files['portada'][0];
            const nombrePortada = `${Date.now()}-${portada.originalname.replace(/\s+/g, '_')}`;
            const { error: errorSubidaPortada } = await supabase.storage.from('portadas').upload(nombrePortada, portada.buffer, { contentType: portada.mimetype });
            if (errorSubidaPortada) throw new Error('Error al subir la portada: ' + errorSubidaPortada.message);
            
            // Obtener la URL pública de la portada
            const { data: publicUrlData } = supabase.storage.from('portadas').getPublicUrl(nombrePortada);
            rutaPortada = publicUrlData.publicUrl;
        }

        // 3. Insertar en la Base de Datos PostgreSQL
        const client = await pool.connect();
        try {
            await client.query('BEGIN');
            
            // Autor
            let autorId;
            const resAutor = await client.query('SELECT id FROM autores WHERE nombre = $1', [autor]);
            if (resAutor.rows.length > 0) {
                autorId = resAutor.rows[0].id;
            } else {
                const nuevoAutor = await client.query('INSERT INTO autores (nombre) VALUES ($1) RETURNING id', [autor]);
                autorId = nuevoAutor.rows[0].id;
            }

            // Área
            let areaId;
            const resArea = await client.query('SELECT id FROM areas WHERE nombre = $1', [area]);
            if (resArea.rows.length > 0) {
                areaId = resArea.rows[0].id;
            } else {
                const nuevaArea = await client.query('INSERT INTO areas (nombre) VALUES ($1) RETURNING id', [area]);
                areaId = nuevaArea.rows[0].id;
            }

            // Libro
            const queryLibro = `INSERT INTO libros (titulo, autor_id, area_id, año_publicacion, editorial, sinopsis, ruta_archivo, formato, ruta_portada) 
                                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id`;
            const nuevoLibro = await client.query(queryLibro, [titulo, autorId, areaId, año_publicacion || null, editorial, sinopsis, rutaArchivo, formato, rutaPortada]);
            
            await client.query('COMMIT');
            res.status(201).json({ message: 'Libro agregado con éxito', id: nuevoLibro.rows[0].id });

        } catch (dbError) {
            await client.query('ROLLBACK');
            throw dbError;
        } finally {
            client.release();
        }

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: error.message });
    }
});

app.put('/api/libros/:id/portada', verificarToken, upload.fields([{ name: 'portada', maxCount: 1 }]), async (req, res) => {
    const { id } = req.params;
    if (!req.files || !req.files['portada']) {
        return res.status(400).json({ error: 'Debes subir una imagen de portada.' });
    }

    try {
        const portada = req.files['portada'][0];
        const nombrePortada = `${Date.now()}-${portada.originalname.replace(/\s+/g, '_')}`;
        
        // Subir a Supabase
        const { error: errorSubida } = await supabase.storage.from('portadas').upload(nombrePortada, portada.buffer, { contentType: portada.mimetype });
        if (errorSubida) throw new Error('Error al subir la portada');
        
        const { data: publicUrlData } = supabase.storage.from('portadas').getPublicUrl(nombrePortada);
        const nuevaRutaPortada = publicUrlData.publicUrl;

        // Actualizar en Base de Datos
        await pool.query('UPDATE libros SET ruta_portada = $1 WHERE id = $2', [nuevaRutaPortada, id]);
        
        res.json({ message: 'Portada actualizada', ruta_portada: nuevaRutaPortada });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.delete('/api/libros/:id', verificarToken, async (req, res) => {
    const { id } = req.params;
    try {
        // 1. Obtener rutas para borrar archivos de Supabase
        const result = await pool.query('SELECT ruta_archivo, ruta_portada FROM libros WHERE id = $1', [id]);
        if (result.rows.length > 0) {
            const { ruta_archivo, ruta_portada } = result.rows[0];
            
            // Borrar libro de Storage
            if (ruta_archivo) {
                await supabase.storage.from('libros').remove([ruta_archivo]);
            }
            // Borrar portada de Storage (si es una URL de Supabase)
            if (ruta_portada && ruta_portada.includes('supabase.co')) {
                const nombrePortada = ruta_portada.split('/').pop();
                await supabase.storage.from('portadas').remove([nombrePortada]);
            }
        }

        // 2. Borrar de la base de datos
        await pool.query('DELETE FROM libros WHERE id = $1', [id]);
        res.json({ message: 'Libro eliminado correctamente' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.listen(PORT, () => {
    console.log(`🚀 Servidor corriendo en http://localhost:${PORT}`);
});