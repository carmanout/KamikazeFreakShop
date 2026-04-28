/* =========================================
   KAMIKAZE FREAK SHOP - JAVASCRIPT (CORREGIDO)
   ========================================= */

const SHEET_ID = '1fttJBDVd87_8hbVKHrU_8MPnQgwjgIRi734fJrC4cPo';
const SHEET_NAMES = {
    JUEGOS: 'Juegos',
    EVENTOS: 'Eventos',
    MTG: 'MTG'
};

let sheetData = {
    juegos: null,
    eventos: null,
    mtg: null
};

/* =========================================
   UTILIDADES
   ========================================= */

function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function parseSheetDate(dateStr) {
    if (!dateStr) return null;
    if (dateStr instanceof Date) return dateStr;
    const str = dateStr.toString().trim();
    const [datePart, timePart = '0:00:00'] = str.split(' ');
    const [day, month, year] = datePart.split('/').map(Number);
    const [hours, minutes, seconds] = timePart.split(':').map(Number);
    return new Date(year, month - 1, day, hours || 0, minutes || 0, seconds || 0);
}

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
    return 'badge-info';
}

function getStatusLabel(estado) {
    return estado ? estado.toString().trim() : 'Desconocido';
}

function formatPrice(val) {
    if (!val && val !== 0) return '';
    const s = val.toString().trim();
    if (s.includes('€') || s.includes('EUR')) return s;
    return s + '€';
}

function escapeHtml(str) {
    console.log('Escapando:', str);
    if (!str) return '';
    return str.replace(/[&<>]/g, function(m) {
        if (m === '&') return '&amp;';
        if (m === '<') return '&lt;';
        if (m === '>') return '&gt;';
        return m;
    });
}

/* =========================================
   GOOGLE SHEETS FETCH
   ========================================= */

async function fetchSheet(sheetName) {
    const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:json&sheet=${encodeURIComponent(sheetName)}`;
    const response = await fetch(url);
    const text = await response.text();
    const match = text.match(/google\.visualization\.Query\.setResponse\((.*)\);?\s*$/s);
    if (!match) throw new Error('Formato de respuesta inesperado');
    const data = JSON.parse(match[1]);
    const cols = data.table.cols.map(c => c.label || c.id || '');
    const rows = data.table.rows.map(row => {
        const obj = {};
        row.c.forEach((cell, i) => {
            if (cell) {
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
        document.getElementById('juegos-grid').innerHTML = '<div class="loading-state">Error al cargar los datos. Intenta recargar la página.</div>';
        document.getElementById('eventos-grid').innerHTML = '<div class="loading-state">Error al cargar los datos. Intenta recargar la página.</div>';
        document.getElementById('mtg-grid').innerHTML = '<div class="loading-state">Error al cargar los datos. Intenta recargar la página.</div>';
    }
}

/* =========================================
   FILTROS DE JUEGOS (inicialización)
   ========================================= */

function populateTipoFilter() {
    const tipoSelect = document.getElementById('filtro-tipo');
    if (!tipoSelect || !sheetData.juegos) return;
    // Limpiar opciones excepto la primera (Todos)
    while (tipoSelect.options.length > 1) tipoSelect.remove(1);
    const tipos = Array.from(new Set(sheetData.juegos.map(j => (j['Tipo'] || '').toString().trim()).filter(Boolean)));
    tipos.sort();
    for (const t of tipos) {
        const opt = document.createElement('option');
        opt.value = t;
        opt.textContent = t;
        tipoSelect.appendChild(opt);
    }
}

function initFilters() {
    const filtros = ['filtro-tipo', 'filtro-stock', 'filtro-jugabilidad'];
    filtros.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.addEventListener('change', () => renderJuegos());
        }
    });
    // También reaccionar a cambios en el filtro de tipo, pero ya se incluye arriba
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

    const tipoFiltro = document.getElementById('filtro-tipo')?.value || '';
    const stockFiltro = document.getElementById('filtro-stock')?.value || '';
    const jugabilidadFiltro = document.getElementById('filtro-jugabilidad')?.value || '';

    let items = data.filter(item => {
        const nombre = (item['Nombre del elemento'] || '').toString().trim();
        if (!nombre) return false;
        const tipo = (item['Tipo'] || '').toString().trim();
        const estado = (item['Estado'] || '').toString().toLowerCase().trim();
        const jugabilidad = (item['Jugabilidad'] || '').toString().trim();

        // Ocultar siempre los juegos agotados
        const esAgotado = estado.includes('agotado');
        if (esAgotado) return false;

        if (tipoFiltro && tipo !== tipoFiltro) return false;
        // Ocultar los no disponibles temporalmente solo si el filtro es 'en stock'
        if (stockFiltro === 'stock' && (estado.includes('no disponible') || estado.includes('temporal'))) return false;
        if (stockFiltro === 'agotado' && !esAgotado) return false;
        if (jugabilidadFiltro && jugabilidad !== jugabilidadFiltro) return false;
        return true;
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
        const jugabilidad = (item['Jugabilidad'] || '').toString().trim();
        const badgeClass = getStatusBadgeClass(estado);
        const badgeLabel = getStatusLabel(estado);
        return `
            <article class="card">
                <div class="card-image-wrapper">
                    ${imagen ? `<img src="${escapeHtml(imagen)}" alt="${escapeHtml(nombre)}" loading="lazy" onerror="this.style.display='none'">` : '<div class="mtg-placeholder">Sin imagen</div>'}
                </div>
                <div class="card-body">
                    ${tipo ? `<span class="card-tag">${escapeHtml(tipo)}</span>` : ''}
                    <h3 class="card-title">${escapeHtml(nombre)}</h3>
                    ${jugabilidad === 'Si' ? `<span class="badge badge-info badge-jugable">Disponible para jugar en tienda</span>` : ''}
                    ${descripcion ? `<p class="card-text">${escapeHtml(descripcion)}</p>` : ''}
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
    const data = sheetData.eventos;
    if (!data || !Array.isArray(data)) {
        grid.innerHTML = '<div class="loading-state">Cargando eventos...</div>';
        return;
    }
    const now = new Date();
    let items = data.filter(item => {
        const actividad = (item['Actividad'] || '').toString().trim();
        const finStr = item['Hora de finalización'];
        const fin = parseSheetDate(finStr);
        return actividad && fin && fin >= now;
    });
    items.sort((a, b) => {
        const da = parseSheetDate(a['Hora de inicio']);
        const db = parseSheetDate(b['Hora de inicio']);
        return (da?.getTime() || 0) - (db?.getTime() || 0);
    });
    if (items.length === 0) {
        grid.innerHTML = '';
        empty.classList.remove('hidden');
        return;
    }
    empty.classList.add('hidden');
    grid.innerHTML = items.map((item, idx) => {
        const actividad = escapeHtml(item['Actividad'] || '');
        const tipo = escapeHtml(item['Tipo de actividad'] || '');
        const inicio = item['Hora de inicio'];
        const fin = item['Hora de finalización'];
        const descripcion = escapeHtml(item['Descripción'] || '');
        const imagen = item['URL Imagen'] || '';
        const urlInfo = item['Url Info'] || '';
        const fechaTexto = formatDateRange(inicio, fin);
        let descripcionCorta = descripcion;
        let showMasInfo = false;
        if (descripcion.length > 100) {
            descripcionCorta = descripcion.slice(0, 100) + '...';
            showMasInfo = true;
        }
        return `
            <article class="card">
                <div class="card-image-wrapper">
                    ${imagen ? `<img src="${escapeHtml(imagen)}" alt="${actividad}" loading="lazy" onerror="this.style.display='none'">` : '<div class="mtg-placeholder">Sin imagen</div>'}
                </div>
                <div class="card-body">
                    ${tipo ? `<span class="card-tag">${tipo}</span>` : ''}
                    <h3 class="card-title">${actividad}</h3>
                    ${fechaTexto ? `<p class="card-meta">📅 ${fechaTexto}</p>` : ''}
                    <p class="card-text" id="desc-corta-${idx}">${descripcionCorta}</p>
                    <div class="event-buttons">
                        ${showMasInfo ? `<button class="btn btn-info btn-mas-info" data-idx="${idx}">Más información</button>` : ''}
                        ${urlInfo ? `<a class="btn btn-primary btn-meetup" href="${escapeHtml(urlInfo)}" target="_blank" rel="noopener">Ir a Meetup</a>` : ''}
                    </div>
                </div>
            </article>
        `;
    }).join('');
    // Delegación de eventos para los botones "Más información"
    grid.querySelectorAll('.btn-mas-info').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const idx = btn.getAttribute('data-idx');
            const item = items[idx];
            mostrarModalEvento(item);
        });
    });
}

function mostrarModalEvento(item) {
    const modal = document.getElementById('modal-evento');
    if (!modal) return;
    const actividad = escapeHtml(item['Actividad'] || '');
    const tipo = escapeHtml(item['Tipo de actividad'] || '');
    const inicio = item['Hora de inicio'];
    const fin = item['Hora de finalización'];
    const descripcion = escapeHtml(item['Descripción'] || '');
    const imagen = item['URL Imagen'] || '';
    const urlInfo = item['Url Info'] || '';
    const fechaTexto = formatDateRange(inicio, fin);
    modal.querySelector('.modal-title').innerText = actividad;
    modal.querySelector('.modal-fecha').innerText = fechaTexto;
    modal.querySelector('.modal-tipo').innerText = tipo;
    modal.querySelector('.modal-desc').innerText = descripcion;
    const imgEl = modal.querySelector('.modal-img');
    if (imagen) {
        imgEl.src = imagen;
        imgEl.alt = actividad;
        imgEl.style.display = '';
    } else {
        imgEl.style.display = 'none';
    }
    const btnMeetup = modal.querySelector('.modal-meetup');
    if (urlInfo) {
        btnMeetup.href = urlInfo;
        btnMeetup.style.display = '';
    } else {
        btnMeetup.style.display = 'none';
    }
    modal.classList.add('open');
    document.body.classList.add('modal-open');
}

async function renderMTG() {
    const grid = document.getElementById('mtg-grid');
    const empty = document.getElementById('mtg-empty');
    const data = sheetData.mtg;
    if (!data) {
        grid.innerHTML = '<div class="loading-state">Cargando cartas...</div>';
        return;
    }
    const items = data.filter(item => (item['Nombre'] || '').toString().trim());
    if (items.length === 0) {
        grid.innerHTML = '';
        empty.classList.remove('hidden');
        return;
    }
    empty.classList.add('hidden');
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
                    <h3 class="card-title">${escapeHtml(nombre)}</h3>
                    ${edicion ? `<p class="card-meta">📦 ${escapeHtml(edicion)}</p>` : ''}
                    <div class="card-footer">
                        ${cantidad ? `<span class="card-meta">Cantidad: ${cantidad}</span>` : ''}
                        ${precio ? `<span class="card-price">${formatPrice(precio)}</span>` : ''}
                    </div>
                </div>
            </article>
        `;
    }).join('');
    function getScryfallImage(card) {
        if (card.image_uris) return card.image_uris.normal || card.image_uris.small || card.image_uris.large;
        if (card.card_faces && card.card_faces[0] && card.card_faces[0].image_uris)
            return card.card_faces[0].image_uris.normal || card.card_faces[0].image_uris.small || card.card_faces[0].image_uris.large;
        return null;
    }
    for (let i = 0; i < items.length; i++) {
        const item = items[i];
        const nombre = item['Nombre'];
        const edicion = (item['Edición'] || '').toString().trim();
        const placeholder = document.getElementById(`mtg-img-${i}`);
        if (!placeholder) continue;
        try {
            let url = `https://api.scryfall.com/cards/named?exact=${encodeURIComponent(nombre)}`;
            if (edicion) url += `&set=${encodeURIComponent(edicion)}`;
            const res = await fetch(url);
            if (!res.ok) {
                if (edicion) {
                    await delay(100);
                    const fallbackUrl = `https://api.scryfall.com/cards/named?exact=${encodeURIComponent(nombre)}`;
                    const fallbackRes = await fetch(fallbackUrl);
                    if (!fallbackRes.ok) throw new Error('Not found');
                    const card = await fallbackRes.json();
                    const img = getScryfallImage(card);
                    if (img) placeholder.outerHTML = `<img src="${img}" alt="${nombre}" loading="lazy" style="width:100%;height:100%;object-fit:cover;">`;
                    else throw new Error('No image');
                } else {
                    throw new Error('Not found');
                }
            } else {
                const card = await res.json();
                const img = getScryfallImage(card);
                if (img) placeholder.outerHTML = `<img src="${img}" alt="${nombre}" loading="lazy" style="width:100%;height:100%;object-fit:cover;">`;
                else throw new Error('No image');
            }
        } catch (e) {
            placeholder.innerHTML = `<span>Imagen no disponible</span>`;
            placeholder.style.opacity = '0.6';
        }
        if (i < items.length - 1) await delay(100);
    }
}

/* =========================================
   SPA NAVIGATION
   ========================================= */

function showSection(sectionId) {
    document.querySelectorAll('.page-section').forEach(sec => sec.classList.remove('active'));
    const target = document.getElementById(sectionId);
    if (target) target.classList.add('active');
    window.scrollTo({ top: 0, behavior: 'smooth' });
    document.querySelectorAll('.nav-link').forEach(link => {
        link.classList.toggle('active', link.dataset.nav === sectionId);
    });
    if (sectionId === 'juegos') renderJuegos();
    else if (sectionId === 'eventos') renderEventos();
    else if (sectionId === 'mtg') renderMTG();
    history.replaceState(null, null, `#${sectionId}`);
}

function initNavigation() {
    document.querySelectorAll('.nav-link').forEach(link => {
        link.addEventListener('click', e => {
            const sectionId = link.dataset.nav;
            if (sectionId) showSection(sectionId);
        });
    });
    const logo = document.querySelector('.logo');
    if (logo) logo.addEventListener('click', e => showSection('inicio'));
    document.querySelectorAll('[data-nav]').forEach(btn => {
        btn.addEventListener('click', e => {
            const sectionId = btn.dataset.nav;
            if (sectionId) showSection(sectionId);
        });
    });
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
    // Cerrar modal al hacer clic fuera o en la X
    const modal = document.getElementById('modal-evento');
    if (modal) {
        modal.querySelector('.modal-close').addEventListener('click', () => {
            modal.classList.remove('open');
            document.body.classList.remove('modal-open');
        });
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.classList.remove('open');
                document.body.classList.remove('modal-open');
            }
        });
    }
}

/* =========================================
   INIT
   ========================================= */

async function init() {
    initNavigation();
    await fetchAllSheets();
    populateTipoFilter();   // Llenar el desplegable de tipos una sola vez
    initFilters();          // Conectar los event listeners de los filtros
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