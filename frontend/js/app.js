// frontend/js/app.js

const API_URL = 'http://localhost:3000/api/libros';
const API_AREAS = 'http://localhost:3000/api/areas';

document.addEventListener('DOMContentLoaded', () => {
    cargarAreas(); // Llena el desplegable
    cargarLibros(); // Carga los libros iniciales

    // Eventos para buscar
    document.getElementById('btn-buscar').addEventListener('click', aplicarFiltros);
    
    // Permite buscar presionando "Enter" en el teclado
    document.getElementById('input-busqueda').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') aplicarFiltros();
    });

    // Permite buscar al cambiar la opción del desplegable
    document.getElementById('select-area').addEventListener('change', aplicarFiltros);
});

function aplicarFiltros() {
    const texto = document.getElementById('input-busqueda').value;
    const area = document.getElementById('select-area').value;
    cargarLibros(texto, area);
}

async function cargarAreas() {
    try {
        const respuesta = await fetch(API_AREAS);
        const areas = await respuesta.json();
        const select = document.getElementById('select-area');
        
        areas.forEach(area => {
            const option = document.createElement('option');
            option.value = area.nombre;
            option.textContent = area.nombre;
            select.appendChild(option);
        });
    } catch (error) {
        console.error('Error al cargar áreas:', error);
    }
}

async function cargarLibros(busqueda = '', area = '') {
    const contenedor = document.getElementById('contenedor-libros');
    contenedor.innerHTML = `<p class="text-gray-500 col-span-3 text-center py-10">Buscando...</p>`;

    try {
        // Construimos la URL con los parámetros de búsqueda
        const url = new URL(API_URL);
        if (busqueda) url.searchParams.append('q', busqueda);
        if (area) url.searchParams.append('area', area);

        const respuesta = await fetch(url);
        const libros = await respuesta.json();

        if (libros.length === 0) {
            contenedor.innerHTML = `<p class="text-gray-500 col-span-3 text-center py-10">No se encontraron libros con esos criterios.</p>`;
            return;
        }

        contenedor.innerHTML = '';

        libros.forEach(libro => {
            const portadaUrl = libro.ruta_portada ? libro.ruta_portada : 'https://via.placeholder.com/150x220?text=Sin+Portada';
            
            let botonAccionHTML = '';
            
            // Al usar libro.ruta_archivo directamente, usamos la URL completa de Supabase
            if (libro.formato === 'PDF') {
                botonAccionHTML = `
                    <a href="${libro.ruta_archivo}" target="_blank" class="flex-1 bg-blue-50 text-blue-700 hover:bg-blue-100 text-xs font-semibold py-1 px-2 rounded border border-blue-200 transition text-center flex items-center justify-center">
                        Leer PDF
                    </a>
                `;
            } else {
                botonAccionHTML = `
                    <a href="${libro.ruta_archivo}" download class="flex-1 bg-purple-50 text-purple-700 hover:bg-purple-100 text-xs font-semibold py-1 px-2 rounded border border-purple-200 transition text-center flex items-center justify-center">
                        Descargar EPUB
                    </a>
                `;
            }

            const tarjetaHTML = `
                <div class="bg-white rounded-lg shadow-md flex overflow-hidden hover:shadow-lg transition duration-300 h-64">
                    <div class="w-1/3 bg-gray-200 flex-shrink-0">
                        <img src="${portadaUrl}" alt="Portada de ${libro.titulo}" class="w-full h-full object-cover">
                    </div>
                    <div class="w-2/3 p-4 flex flex-col justify-between">
                        <div>
                            <h2 class="text-lg font-bold text-gray-900 leading-tight mb-1" title="${libro.titulo}">${libro.titulo}</h2>
                            <p class="text-sm text-gray-500 mb-2">${libro.autor || 'Autor desconocido'}</p>
                            <p class="text-xs text-gray-600 line-clamp-3">${libro.sinopsis || 'Sin sinopsis disponible.'}</p>
                        </div>
                        <div class="flex gap-2 mt-2">
                            ${botonAccionHTML}
                            <!-- Aquí también cambiamos el enlace de descarga general -->
                            <a href="${libro.ruta_archivo}" download class="flex-1 bg-green-50 text-green-700 hover:bg-green-100 text-xs font-semibold py-1 px-2 rounded border border-green-200 transition text-center flex items-center justify-center">
                                Descargar
                            </a>
                        </div>
                    </div>
                </div>
            `;
            contenedor.innerHTML += tarjetaHTML;
        });

    } catch (error) {
        console.error('Error:', error);
        contenedor.innerHTML = `<p class="text-red-500 col-span-3 text-center py-10">Error al conectar con el servidor.</p>`;
    }
}