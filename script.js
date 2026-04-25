/* =========================================
   KAMIKAZE FREAK SHOP - JAVASCRIPT
   ========================================= */

const SHEET_ID = '1fttJBDVd87_8hbVKHrU_8MPnQgwjgIRi734fJrC4cPo';
const SHEET_NAMES = {
    JUEGOS: 'Juegos',
    EVENTOS: 'Eventos',
    MTG: 'MTG'
};

// Estado de la app
let sheetData = {
    juegos: null,
    eventos: null,
    mtg: null
};

let mtgCardsRendered = false;

/* =========================================
   UTILIDADES
   ========================================= */

function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// Convierte "29/04/2026 0:00:00" a objeto Date (usando hora local)
function parseSheetDate(dateStr) {
    if (!dateStr) return null;
    if (dateStr instanceof Date) return dateStr;

    const str = dateStr.toString().trim();
    // Separa fecha y hora
    const [datePart, timePart = '0:00:00'] = str.split(' ');
    const [day, month, year] = datePart.split('/').map(Number);
    const [hours, minutes, seconds] = timePart.split(':').map(Number);

    // ¡Importante! Mes en JS es 0-indexado (0 = enero)
    return new Date(year, month - 1, day, hours || 0, minutes || 0, seconds || 0);
}

// Formatea un rango de fechas para mostrarlo bonito (ej: "29 abr, 10:30 - 12:00")
function formatDateRange(inicioStr, finStr) {
    const inicio = parseSheetDate(inicioStr);
    const fin = parseSheetDate(finStr);
    if (!inicio) return '';

    const opcionesFecha = { day: 'numeric', month: 'short' };
    const opcionesHora = { hour: '2-digit', minute: '2-digit' };

    const fechaInicio = inicio.toLocaleDateString('es-ES', opcionesFecha);
    const horaInicio = inicio.toLocaleTimeString('es-ES', opcionesHora);

    if (!fin) return `${fechaInicio} ${horaInicio}`;

    const mismoDia = inicio.toDateString() === fin.toDateString();
    const horaFin = fin.toLocaleTimeString('es-ES', opcionesHora);

    if (mismoDia) {
        return `${fechaInicio} ${horaInicio} - ${horaFin}`;
    } else {
        const fechaFin = fin.toLocaleDateString('es-ES', opcionesFecha);
        return `${fechaInicio} ${horaInicio} - ${fechaFin} ${horaFin}`;
    }
}

function getStatusBadgeClass(estado) {
    if (!estado) return 'badge-info';
    const e = estado.toString().toLowerCase().trim();
    if (e.includes('stock')) return 'badge-success';
    if (e.includes('agotado')) return 'badge-danger';
    if (e.includes('no disponible') || e.includes('temporal')) return 'badge-warning';
    if (e.includes('contactar') || e.includes('volver')) return 'badge-info';
    return 'badge-info';
}

function getStatusLabel(estado) {
    if (!estado) return 'Desconocido';
    return estado.toString().trim();
}

function formatPrice(val) {
    if (!val && val !== 0) return '';
    const s = val.toString().trim();
    if (s.includes('€') || s.includes('EUR')) return s;
    return s + '€';
}

/* =========================================
   GOOGLE SHEETS FETCH
   ========================================= */

async function fetchSheet(sheetName) {
    const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:json&sheet=${encodeURIComponent(sheetName)}`;
    const response = await fetch(url);
    const text = await response.text();

    // Extraer JSON del wrapper JSONP de Google Visualization
    const match = text.match(/google\.visualization\.Query\.setResponse\((.*)\);?\s*$/s);
    if (!match) throw new Error('Formato de respuesta inesperado');

    const data = JSON.parse(match[1]);
    const cols = data.table.cols.map(c => c.label || c.id || '');
    const rows = data.table.rows.map(row => {
        const obj = {};
        row.c.forEach((cell, i) => {
            // Preferir formatted value para fechas/textos legibles, 
            // pero usar v para números puros si f no existe
            if (cell) {
                // Para fechas, 'v' puede ser un objeto Date de Google, 'f' es el string formateado
                if (cell.f && (cols[i].toLowerCase().includes('hora') || cols[i].toLowerCase().includes('fecha'))) {
                    obj[cols[i]] = cell.f;
                } else {
                    obj[cols[i]] = cell.v !== null && cell.v !== undefined ? cell.v : '';
                }
            } else {
                obj[cols[i]] = '';
            }
        });
        return obj;
    });

    return rows;
}

async function fetchAllSheets() {
    try {
        const [juegos, eventos, mtg] = await Promise.all([
            fetchSheet(SHEET_NAMES.JUEGOS),
            fetchSheet(SHEET_NAMES.EVENTOS),
            fetchSheet(SHEET_NAMES.MTG)
        ]);
        sheetData.juegos = juegos;
        sheetData.eventos = eventos;
        sheetData.mtg = mtg;
    } catch (err) {
        console.error('Error cargando hojas de cálculo:', err);
        // Mostrar error en grids
        document.getElementById('juegos-grid').innerHTML = '<div class="loading-state">Error al cargar los datos. Intenta recargar la página.</div>';
        document.getElementById('eventos-grid').innerHTML = '<div class="loading-state">Error al cargar los datos. Intenta recargar la página.</div>';
        document.getElementById('mtg-grid').innerHTML = '<div class="loading-state">Error al cargar los datos. Intenta recargar la página.</div>';
    }
}

/* =========================================
   RENDERIZADO
   ========================================= */

function renderJuegos() {
    const grid = document.getElementById('juegos-grid');
    const empty = document.getElementById('juegos-empty');
    const data = sheetData.juegos;

    if (!data) {
        grid.innerHTML = '<div class="loading-state">Cargando juegos...</div>';
        return;
    }

    // Filtrar Agotado (ocultar) y filas vacías
    const items = data.filter(item => {
        const estado = (item['Estado'] || '').toString().toLowerCase().trim();
        const nombre = (item['Nombre del elemento'] || '').toString().trim();
        return nombre && estado !== 'agotado';
    });

    if (items.length === 0) {
        grid.innerHTML = '';
        empty.classList.remove('hidden');
        return;
    }

    empty.classList.add('hidden');

    grid.innerHTML = items.map(item => {
        const nombre = item['Nombre del elemento'] || '';
        const tipo = item['Tipo'] || '';
        const precio = item['Precio'] || '';
        const estado = item['Estado'] || '';
        const descripcion = item['Descripción'] || '';
        const imagen = item['URL Imagen'] || '';
        const badgeClass = getStatusBadgeClass(estado);
        const badgeLabel = getStatusLabel(estado);

        return `
            <article class="card">
                <div class="card-image-wrapper">
                    ${imagen ? `<img src="${imagen}" alt="${nombre}" loading="lazy" onerror="this.style.display='none'">` : '<div class="mtg-placeholder">Sin imagen</div>'}
                </div>
                <div class="card-body">
                    ${tipo ? `<span class="card-tag">${tipo}</span>` : ''}
                    <h3 class="card-title">${nombre}</h3>
                    ${descripcion ? `<p class="card-text">${descripcion}</p>` : ''}
                    <div class="card-footer">
                        <span class="badge ${badgeClass}">${badgeLabel}</span>
                        ${precio ? `<span class="card-price">${formatPrice(precio)}</span>` : ''}
                    </div>
                </div>
            </article>
        `;
    }).join('');
}

function renderEventos() {
    const grid = document.getElementById('eventos-grid');
    const empty = document.getElementById('eventos-empty');
    const data = sheetData?.eventos; // <- usa optional chaining por si sheetData es null

    if (!data || !Array.isArray(data)) {
        grid.innerHTML = '<div class="loading-state">Cargando eventos...</div>';
        return;
    }

    const now = new Date();

    // Filtra eventos cuya Hora de finalización sea mayor o igual a ahora
    let items = data.filter(item => {
        const actividad = (item['Actividad'] || '').toString().trim();
        const finStr = item['Hora de finalización'];
        const fin = parseSheetDate(finStr);
        return actividad && fin && fin >= now;
    });

    // Ordena por Hora de inicio ascendente
    items.sort((a, b) => {
        const da = parseSheetDate(a['Hora de inicio']);
        const db = parseSheetDate(b['Hora de inicio']);
        return (da?.getTime() || 0) - (db?.getTime() || 0);
    });

    if (items.length === 0) {
        grid.innerHTML = '';
        empty?.classList.remove('hidden');
        return;
    }

    empty?.classList.add('hidden');

    grid.innerHTML = items.map(item => {
        const actividad = escapeHtml(item['Actividad'] || '');
        const tipo = escapeHtml(item['Tipo de actividad'] || '');
        const inicio = item['Hora de inicio'];
        const fin = item['Hora de finalización'];
        const descripcion = escapeHtml(item['Descripción'] || '');
        const imagen = item['URL Imagen'] || '';
        const fechaTexto = formatDateRange(inicio, fin);

        return `
            <article class="card">
                <div class="card-image-wrapper">
                    ${imagen ? `<img src="${escapeHtml(imagen)}" alt="${actividad}" loading="lazy" onerror="this.style.display='none'">` : '<div class="mtg-placeholder">Sin imagen</div>'}
                </div>
                <div class="card-body">
                    ${tipo ? `<span class="card-tag">${tipo}</span>` : ''}
                    <h3 class="card-title">${actividad}</h3>
                    ${fechaTexto ? `<p class="card-meta">📅 ${fechaTexto}</p>` : ''}
                    ${descripcion ? `<p class="card-text">${descripcion}</p>` : ''}
                </div>
            </article>
        `;
    }).join('');
}

// Pequeña función para evitar inyección HTML (seguridad básica)
function escapeHtml(str) {
    return str.replace(/[&<>]/g, function(m) {
        if (m === '&') return '&amp;';
        if (m === '<') return '&lt;';
        if (m === '>') return '&gt;';
        return m;
    });
}

async function renderMTG() {
    const grid = document.getElementById('mtg-grid');
    const empty = document.getElementById('mtg-empty');
    const data = sheetData.mtg;

    if (!data) {
        grid.innerHTML = '<div class="loading-state">Cargando cartas...</div>';
        return;
    }

    // Filtrar vacíos
    const items = data.filter(item => (item['Nombre'] || '').toString().trim());

    if (items.length === 0) {
        grid.innerHTML = '';
        empty.classList.remove('hidden');
        return;
    }

    empty.classList.add('hidden');

    // Construir HTML base con placeholders para las imágenes
    grid.innerHTML = items.map((item, idx) => {
        const nombre = item['Nombre'] || '';
        const edicion = (item['Edición'] || '').toString().trim();
        const cantidad = item['Cantidad'] || '';
        const precio = item['Precio'] || '';

        return `
            <article class="card" data-mtg-index="${idx}">
                <div class="card-image-wrapper" style="aspect-ratio: 0.714 / 1; background: #1a1a1a;">
                    <div class="mtg-placeholder" id="mtg-img-${idx}">
                        <span>Buscando imagen...</span>
                    </div>
                </div>
                <div class="card-body">
                    <h3 class="card-title">${nombre}</h3>
                    ${edicion ? `<p class="card-meta">📦 ${edicion}</p>` : ''}
                    <div class="card-footer">
                        ${cantidad ? `<span class="card-meta">Cantidad: ${cantidad}</span>` : ''}
                        ${precio ? `<span class="card-price">${formatPrice(precio)}</span>` : ''}
                    </div>
                </div>
            </article>
        `;
    }).join('');


    function getScryfallImage(card) {
        // Cartas normales
        if (card.image_uris) {
            return card.image_uris.normal || card.image_uris.small || card.image_uris.large;
        }
        // Cartas de doble cara / transformables
        if (card.card_faces && card.card_faces[0] && card.card_faces[0].image_uris) {
            return card.card_faces[0].image_uris.normal || card.card_faces[0].image_uris.small || card.card_faces[0].image_uris.large;
        }
        return null;
    }

    for (let i = 0; i < items.length; i++) {
        const item = items[i];
        const nombre = item['Nombre'];
        const edicion = (item['Edición'] || '').toString().trim();
        const placeholder = document.getElementById(`mtg-img-${i}`);
        if (!placeholder) {
            // Si no hay placeholder, saltar a la siguiente iteración
            continue;
        }
        try {
            let url = `https://api.scryfall.com/cards/named?exact=${encodeURIComponent(nombre)}`;
            if (edicion) {
                url += `&set=${encodeURIComponent(edicion)}`;
            }
            const res = await fetch(url);
            if (!res.ok) {
                // Si falló con edición, intentar sin edición
                if (edicion) {
                    await delay(100);
                    const fallbackUrl = `https://api.scryfall.com/cards/named?exact=${encodeURIComponent(nombre)}`;
                    const fallbackRes = await fetch(fallbackUrl);
                    if (!fallbackRes.ok) throw new Error('Not found');
                    const card = await fallbackRes.json();
                    const img = getScryfallImage(card);
                    if (img) {
                        placeholder.outerHTML = `<img src="${img}" alt="${nombre}" loading="lazy" style="width:100%;height:100%;object-fit:cover;">`;
                    } else {
                        throw new Error('No image');
                    }
                } else {
                    throw new Error('Not found');
                }
            } else {
                const card = await res.json();
                const img = card.image_uris?.normal || card.image_uris?.small || card.image_uris?.large;
                if (img) {
                    placeholder.outerHTML = `<img src="${img}" alt="${nombre}" loading="lazy" style="width:100%;height:100%;object-fit:cover;">`;
                } else {
                    throw new Error('No image');
                }
            }
        } catch (e) {
            placeholder.innerHTML = `<span>Imagen no disponible</span>`;
            placeholder.style.opacity = '0.6';
        }
        // Delay respetuoso con Scryfall (100ms)
        if (i < items.length - 1) {
            await delay(100);
        }
    }


// Mobile menu toggle
const menuToggle = document.getElementById('menuToggle');
const mainNav = document.getElementById('mainNav');

menuToggle.addEventListener('click', () => {
    mainNav.classList.toggle('open');
    menuToggle.classList.toggle('active');
});

// Cerrar menú al hacer click en un link
mainNav.querySelectorAll('a').forEach(link => {
    link.addEventListener('click', () => {
        mainNav.classList.remove('open');
        menuToggle.classList.remove('active');
    });
});
}


// SPA Navigation y renderizado de datos
function showSection(sectionId) {
    // Ocultar todas las secciones
    document.querySelectorAll('.page-section').forEach(sec => {
        sec.classList.remove('active');
    });
    // Mostrar la seleccionada
    const target = document.getElementById(sectionId);
    if (target) {
        target.classList.add('active');
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }
    // Actualizar nav links
    document.querySelectorAll('.nav-link').forEach(link => {
        link.classList.toggle('active', link.dataset.nav === sectionId);
    });
    // Renderizar datos según sección
    if (sectionId === 'juegos') {
        renderJuegos();
    } else if (sectionId === 'eventos') {
        renderEventos();
    } else if (sectionId === 'mtg') {
        renderMTG();
    }
    // Actualizar hash
    history.replaceState(null, null, `#${sectionId}`);
}

function initNavigation() {
    // SPA: click en menú
    document.querySelectorAll('.nav-link').forEach(link => {
        link.addEventListener('click', e => {
            const sectionId = link.dataset.nav;
            if (sectionId) {
                showSection(sectionId);
            }
        });
    });
    // SPA: click en logo
    const logo = document.querySelector('.logo');
    if (logo) {
        logo.addEventListener('click', e => {
            showSection('inicio');
        });
    }
    // SPA: click en botones con data-nav
    document.querySelectorAll('[data-nav]').forEach(btn => {
        btn.addEventListener('click', e => {
            const sectionId = btn.dataset.nav;
            if (sectionId) {
                showSection(sectionId);
            }
        });
    });
    // Mobile menu toggle
    const menuToggle = document.getElementById('menuToggle');
    const mainNav = document.getElementById('mainNav');
    if (menuToggle && mainNav) {
        menuToggle.addEventListener('click', () => {
            mainNav.classList.toggle('open');
            menuToggle.classList.toggle('active');
        });
        mainNav.querySelectorAll('a').forEach(link => {
            link.addEventListener('click', () => {
                mainNav.classList.remove('open');
                menuToggle.classList.remove('active');
            });
        });
    }
}

async function init() {
    // Navegación SPA
    initNavigation();
    // Cargar datos
    await fetchAllSheets();
    // Detectar hash inicial
    const hash = window.location.hash.replace('#', '');
    const validSections = ['inicio', 'eventos', 'juegos', 'mtg', 'conocenos'];
    const initialSection = validSections.includes(hash) ? hash : 'inicio';
    showSection(initialSection);
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
