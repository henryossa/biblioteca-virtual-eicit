// backend/seed.js
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'db', 'biblioteca.sqlite');
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
    // 1. Insertar Áreas
    db.run(`INSERT OR IGNORE INTO areas (nombre) VALUES ('Ciencias Sociales'), ('Literatura'), ('Filosofía')`);
    
    // 2. Insertar Autores
    db.run(`INSERT OR IGNORE INTO autores (nombre) VALUES ('Arantza Portabales'), ('Edgar Cantero'), ('Ernst Cassirer')`);

    // 3. Insertar Libros (Usamos los IDs de las tablas anteriores)
    // Nota: Asegúrate de tener estos archivos en la carpeta 'files' o cambia las rutas.
    const stmt = db.prepare(`INSERT INTO libros 
        (titulo, autor_id, area_id, año_publicacion, editorial, sinopsis, ruta_archivo, formato, ruta_portada) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`);

    // Libro 1 (PDF)
    stmt.run(
        'Asesinato en el Molino', 1, 2, 1984, 'Editorial Ejemplo', 
        'Una noche de 1984, tiene lugar una salvaje matanza en Loeiro. Los habitantes lloran la muerte de Berta, una niña de nueve años...', 
        'literatura/asesinato.pdf', 'PDF', 'https://via.placeholder.com/150x220?text=Portada+PDF'
    );

    // Libro 2 (EPUB)
    stmt.run(
        'Meddling Kids', 2, 2, 2017, 'Otra Editorial', 
        'En el verano de 1977, el Club de Detectives de Verano de Blyton desenmascaró al monstruo del lago Sleepy...', 
        'literatura/meddling.epub', 'EPUB', 'https://via.placeholder.com/150x220?text=Portada+EPUB'
    );

    // Libro 3 (PDF)
    stmt.run(
        'Kant, vida y doctrina', 3, 3, 1918, 'Fondo de Cultura', 
        'Ernst Cassirer trabajó en una peculiar biografía del filósofo de Königsberg que no sólo transita por distintas etapas de su vida sino...', 
        'filosofia/kant.pdf', 'PDF', 'https://via.placeholder.com/150x220?text=Portada+PDF'
    );

    stmt.finalize();
    console.log('✅ Datos de prueba insertados correctamente.');
});

db.close();