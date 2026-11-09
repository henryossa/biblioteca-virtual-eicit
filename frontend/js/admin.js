// frontend/js/admin.js

const API_URL = 'https://biblioteca-backend-zxjv.onrender.com/api';
let TOKEN = localStorage.getItem('adminToken'); // Busca si ya hay una sesión guardada

document.addEventListener('DOMContentLoaded', () => {
    // 1. Verificar si ya está logueado
    if (TOKEN) {
        document.getElementById('pantalla-login').classList.add('hidden');
        cargarLibrosParaEliminar();
    }

    // 2. Eventos
    document.getElementById('form-login').addEventListener('submit', hacerLogin);
    document.getElementById('form-agregar-libro').addEventListener('submit', subirLibro);
    document.getElementById('form-editar-portada').addEventListener('submit', actualizarPortada);
});

// --- LOGIN ---
async function hacerLogin(e) {
    e.preventDefault();
    const password = document.getElementById('input-password').value;
    
    try {
        const respuesta = await fetch(`${API_URL}/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ password })
        });
        
        const data = await respuesta.json();
        
        if (respuesta.ok) {
            TOKEN = data.token;
            localStorage.setItem('adminToken', TOKEN); // Guarda la llave
            document.getElementById('pantalla-login').classList.add('hidden');
            cargarLibrosParaEliminar();
        } else {
            document.getElementById('error-login').classList.remove('hidden');
        }
    } catch (error) {
        alert("Error de conexión con el servidor");
    }
}

// Helper para los headers de autorización
function getHeaders() {
    return { 'Authorization': `Bearer ${TOKEN}` };
}

// --- AGREGAR LIBRO ---
async function subirLibro(e) {
    e.preventDefault();
    const form = e.target;
    const formData = new FormData(form);
    const mensajeDiv = document.getElementById('mensaje-formulario');

    try {
        const respuesta = await fetch(`${API_URL}/libros`, {
            method: 'POST',
            headers: getHeaders(), // <--- AQUÍ ENVIAMOS LA LLAVE
            body: formData
        });
        const data = await respuesta.json();

        if (respuesta.ok) {
            mensajeDiv.className = "mt-4 text-center font-semibold text-green-600 block";
            mensajeDiv.textContent = "✅ ¡Libro agregado correctamente!";
            form.reset();
            cargarLibrosParaEliminar();
        } else {
            throw new Error(data.error || 'Error al subir');
        }
    } catch (error) {
        mensajeDiv.className = "mt-4 text-center font-semibold text-red-600 block";
        mensajeDiv.textContent = "❌ Error: " + error.message;
    }
}

// --- LISTA DE LIBROS ---
async function cargarLibrosParaEliminar() {
    const contenedor = document.getElementById('lista-libros-admin');
    
    try {
        // Esta ruta GET es pública (no necesita token para ver qué libros hay)
        const respuesta = await fetch(`${API_URL}/libros`);
        const libros = await respuesta.json();

        if (libros.length === 0) {
            contenedor.innerHTML = '<p class="text-gray-500">No hay libros registrados.</p>';
            return;
        }

        contenedor.innerHTML = libros.map(libro => `
            <div class="flex justify-between items-center bg-gray-50 p-3 rounded border mb-2">
                <div>
                    <p class="font-semibold text-sm">${libro.titulo}</p>
                    <p class="text-xs text-gray-500">${libro.autor} - ${libro.formato}</p>
                </div>
                <div class="flex gap-2">
                    <button onclick="abrirModalEditar(${libro.id}, '${libro.titulo}')" class="bg-blue-100 text-blue-700 hover:bg-blue-200 px-3 py-1 rounded text-sm font-semibold transition">
                        Editar
                    </button>
                    <button onclick="eliminarLibro(${libro.id})" class="bg-red-100 text-red-700 hover:bg-red-200 px-3 py-1 rounded text-sm font-semibold transition">
                        Eliminar
                    </button>
                </div>
            </div>
        `).join('');

    } catch (error) {
        contenedor.innerHTML = '<p class="text-red-500">Error al cargar la lista.</p>';
    }
}

// --- ELIMINAR ---
async function eliminarLibro(id) {
    if (!confirm('¿Estás seguro de que deseas eliminar este libro?')) return;

    try {
        const respuesta = await fetch(`${API_URL}/libros/${id}`, { 
            method: 'DELETE',
            headers: getHeaders() // <--- AQUÍ ENVIAMOS LA LLAVE
        });
        
        if (respuesta.ok) {
            alert('Libro eliminado');
            cargarLibrosParaEliminar();
        } else {
            alert('Error al eliminar (¿Sesión expirada?)');
            if (respuesta.status === 403) location.reload(); // Si expiró, recarga para pedir login
        }
    } catch (error) {
        alert('Error de conexión');
    }
}

// --- MODAL EDITAR ---
function abrirModalEditar(id, titulo) {
    document.getElementById('edit-libro-id').value = id;
    document.getElementById('modal-titulo-libro').textContent = `Libro: ${titulo}`;
    document.getElementById('form-editar-portada').reset();
    document.getElementById('modal-editar').classList.remove('hidden');
}

function cerrarModal() {
    document.getElementById('modal-editar').classList.add('hidden');
}

function cerrarSesion() {
    localStorage.removeItem('adminToken'); // Borra la llave
    location.reload(); // Recarga la página para que aparezca el login
}

async function actualizarPortada(e) {
    e.preventDefault();
    const id = document.getElementById('edit-libro-id').value;
    const fileInput = document.getElementById('edit-portada-file');
    
    if (fileInput.files.length === 0) return;

    const formData = new FormData();
    formData.append('portada', fileInput.files[0]);

    try {
        const respuesta = await fetch(`${API_URL}/libros/${id}/portada`, {
            method: 'PUT',
            headers: getHeaders(), // <--- AQUÍ ENVIAMOS LA LLAVE
            body: formData
        });

        if (respuesta.ok) {
            alert('✅ Portada actualizada');
            cerrarModal();
            cargarLibrosParaEliminar();
        } else {
            alert('❌ Error al actualizar (¿Sesión expirada?)');
            if (respuesta.status === 403) location.reload();
        }
    } catch (error) {
        alert('Error de conexión');
    }
}