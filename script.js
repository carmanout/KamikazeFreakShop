/* =========================================
   KAMIKAZE FREAK SHOP - JAVASCRIPT (CORREGIDO)
   ========================================= */

const SHEET_ID = '1qGOW2QyCU5q9IEplIIGzHcf0cQhwazm2qYP_bpqBhM4';
const SHEET_NAMES = {
    JUEGOS: 'Juegos',
    EVENTOS: 'Eventos',
    MTG: 'MTG',
    LIBROS: 'Libros'
};

let sheetData = {
    juegos: null,
    eventos: null,
    mtg: null,
    libros: null
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
    if (e.includes('novedad')) return 'badge-novedad';
    if (e.includes('agotado')) return 'badge-danger';
    if (e.includes('no disponible') || e.includes('temporal')) return 'badge-warning';
    return 'badge-info';
}

function getStatusLabel(estado) {
    return estado ? estado.toString().trim() : 'Desconocido';
}

function normalizeText(str) {
    if (!str) return '';
    return str.toString().trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function getApellido(autor) {
    if (!autor) return '';
    const partes = autor.trim().split(' ');
    return partes[partes.length - 1].toLowerCase();
}

function getEventStatusField(item) {
    return item['Cancelado'] ? 'cancelado' : 'activo';
}

function getEventStatusBadgeClass(status) {
    if (status === 'cancelado') return 'badge-danger';
    if (status === 'activo') return 'badge-success';
    return 'badge-info';
}

function getEventStatusBadgeLabel(status) {
    if (status === 'cancelado') return 'Cancelado';
    if (status === 'activo') return 'Activo';
    return 'Desconocido';
}

function formatPrice(val) {
    if (val === null || val === undefined || val === '') return '';
    let str = val.toString().trim();
    str = str.replace(/€/g, '').replace(/EUR/gi, '').trim();
    str = str.replace(/\s+/g, '');

    if (str === '') return '';

    if (str.includes(',') && str.includes('.')) {
        const lastComma = str.lastIndexOf(',');
        const lastDot = str.lastIndexOf('.');
        if (lastComma > lastDot) {
            str = str.replace(/\./g, '').replace(/,/g, '.');
        } else {
            str = str.replace(/,/g, '');
        }
    } else if (str.includes(',')) {
        str = str.replace(/,/g, '.');
    }

    const numeric = parseFloat(str.replace(/[^0-9.-]/g, ''));
    if (Number.isNaN(numeric)) {
        return `${val.toString().trim()}€`;
    }

    const formatted = new Intl.NumberFormat('es-ES', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    }).format(numeric);
    return `${formatted}€`;
}

function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/[&<>]/g, function(m) {
        if (m === '&') return '&amp;';
        if (m === '<') return '&lt;';
        if (m === '>') return '&gt;';
        return m;
    });
}

function getScryfallImage(card) {
    if (!card || typeof card !== 'object') return null;
    if (card.image_uris) return card.image_uris.normal || card.image_uris.small || card.image_uris.large;
    if (card.card_faces && card.card_faces[0] && card.card_faces[0].image_uris)
        return card.card_faces[0].image_uris.normal || card.card_faces[0].image_uris.small || card.card_faces[0].image_uris.large;
    return null;
}

const mtgImageObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        const placeholder = entry.target;
        if (placeholder.dataset.loaded) {
            mtgImageObserver.unobserve(placeholder);
            return;
        }
        placeholder.dataset.loaded = 'true';
        const nombre = placeholder.dataset.mtgName || '';
        const edicion = placeholder.dataset.mtgSet || '';
        loadMtgImage(placeholder, nombre, edicion).finally(() => {
            mtgImageObserver.unobserve(placeholder);
        });
    });
}, {
    rootMargin: '250px 0px 250px 0px',
    threshold: 0.1
});

async function safeFetchJson(url) {
    try {
        const response = await fetch(url);
        if (!response.ok) return null;
        return await response.json();
    } catch (e) {
        return null;
    }
}

async function fetchScryfallCardImage(nombre) {
    if (!nombre) return null;
    const urlsToTry = [
        `https://api.scryfall.com/cards/named?fuzzy=${encodeURIComponent(nombre)}&lang=es`,
        `https://api.scryfall.com/cards/search?q=${encodeURIComponent(`!"${nombre}" lang:es`)}&order=usd&dir=asc`,
        `https://api.scryfall.com/cards/search?q=${encodeURIComponent(nombre)}&order=usd&dir=asc`
    ];

    for (const url of urlsToTry) {
        let card = await safeFetchJson(url);
        if (!card) {
            const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`;
            card = await safeFetchJson(proxyUrl);
        }
        if (card) {
            if (Array.isArray(card.data) && card.data.length > 0) {
                card = card.data[0];
            }
            const img = getScryfallImage(card);
            if (img) return img;
        }
        await delay(80);
    }
    return null;
}

async function loadMtgImage(placeholder, nombre, edicion) {
    placeholder.classList.add('loading');
    const imgUrl = await fetchScryfallCardImage(nombre, edicion);
    if (!imgUrl) {
        placeholder.classList.remove('loading');
        placeholder.classList.add('failed');
        placeholder.innerHTML = `<span>Imagen no disponible</span>`;
        return;
    }
    const imgEl = document.createElement('img');
    imgEl.src = imgUrl;
    imgEl.alt = nombre;
    imgEl.loading = 'lazy';
    imgEl.decoding = 'async';
    imgEl.style.width = '100%';
    imgEl.style.height = '100%';
    imgEl.style.objectFit = 'cover';
    imgEl.style.opacity = '0';
    imgEl.style.transition = 'opacity 0.3s ease';
    imgEl.className = 'mtg-card-image';
    imgEl.onload = () => {
        imgEl.style.opacity = '1';
    };
    imgEl.onerror = () => {
        const fallbackEl = document.createElement('div');
        fallbackEl.className = 'mtg-placeholder failed';
        fallbackEl.style.width = '100%';
        fallbackEl.style.height = '100%';
        fallbackEl.innerHTML = `<span>Imagen no disponible</span>`;
        imgEl.replaceWith(fallbackEl);
    };
    placeholder.replaceWith(imgEl);
}

/* =========================================
   GOOGLE SHEETS FETCH
   ========================================= */

async function fetchSheet(sheetName) {
    const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:json&headers=1&sheet=${encodeURIComponent(sheetName)}`;
    const response = await fetch(url);
    const text = await response.text();
    const match = text.match(/google\.visualization\.Query\.setResponse\((.*)\);?\s*$/s);
    if (!match) throw new Error('Formato de respuesta inesperado');
    const data = JSON.parse(match[1]);
    
    // Debug para Libros
    if (sheetName === 'Libros') {
        console.log('DEBUG fetchSheet Libros - cols:', data.table.cols.map(c => c.label || c.id));
        console.log('DEBUG fetchSheet Libros - first row:', data.table.rows[0]);
    }
    
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
        const [juegos, eventos, mtg, libros] = await Promise.all([
            fetchSheet(SHEET_NAMES.JUEGOS),
            fetchSheet(SHEET_NAMES.EVENTOS),
            fetchSheet(SHEET_NAMES.MTG),
            fetchSheet(SHEET_NAMES.LIBROS).catch(err => {
                console.error('Error cargando hoja Libros:', err);
                return [];
            })
        ]);
        sheetData.juegos = juegos;
        sheetData.eventos = eventos;
        sheetData.mtg = mtg;
        sheetData.libros = libros;
    } catch (err) {
        console.error('Error cargando hojas de cálculo:', err);
        document.getElementById('juegos-grid').innerHTML = '<div class="loading-state">Error al cargar los datos. Intenta recargar la página.</div>';
        document.getElementById('eventos-grid').innerHTML = '<div class="loading-state">Error al cargar los datos. Intenta recargar la página.</div>';
        document.getElementById('mtg-grid').innerHTML = '<div class="loading-state">Error al cargar los datos. Intenta recargar la página.</div>';
        document.getElementById('libros-grid').innerHTML = '<div class="loading-state">Error al cargar los datos. Intenta recargar la página.</div>';
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
    // Agregar eventos de cambio para filtros
    const filtros = ['filtro-tipo', 'filtro-stock', 'filtro-ludoteca'];
    filtros.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.addEventListener('change', () => {
                renderJuegos._page = 1;
                renderJuegos();
            });
        }
    });

    // Agregar evento de búsqueda
    const searchInput = document.getElementById('filtro-busqueda');
    const clearBtn = document.getElementById('clear-search');
    if (searchInput) {
        searchInput.addEventListener('input', () => {
            renderJuegos._page = 1;
            renderJuegos();
            // Mostrar/ocultar botón de limpiar
            if (clearBtn) {
                clearBtn.style.display = searchInput.value.trim() ? 'block' : 'none';
            }
        });
    }
    if (clearBtn) {
        clearBtn.addEventListener('click', () => {
            if (searchInput) {
                searchInput.value = '';
                searchInput.focus();
                renderJuegos._page = 1;
                renderJuegos();
                clearBtn.style.display = 'none';
            }
        });
    }
}

/* =========================================
   RENDERIZADO
   ========================================= */

function renderJuegos() {
    const grid = document.getElementById('juegos-grid');
    const empty = document.getElementById('juegos-empty');
    const pagination = document.getElementById('juegos-paginacion');
    const data = sheetData.juegos;
    if (!data) {
        grid.innerHTML = '<div class="loading-state">Cargando juegos...</div>';
        if (pagination) pagination.style.display = 'none';
        return;
    }

    const tipoFiltro = document.getElementById('filtro-tipo')?.value || '';
    const stockFiltro = document.getElementById('filtro-stock')?.value || '';
    const ludotecaFiltro = document.getElementById('filtro-ludoteca')?.value || '';
    const busquedaTerm = (document.getElementById('filtro-busqueda')?.value || '').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

    let items = data.filter(item => {
        const nombre = (item['Nombre del elemento'] || '').toString().trim();
        if (!nombre) return false;
        const tipo = (item['Tipo'] || '').toString().trim();
        const estado = (item['Estado'] || '').toString().toLowerCase().trim();
        const ludoteca = (item['Ludoteca'] || '').toString().trim();

        // Ocultar siempre los juegos agotados
        const esAgotado = estado.includes('agotado');
        if (esAgotado) return false;

        // Filtro de búsqueda por nombre
        if (busquedaTerm && !nombre.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').includes(busquedaTerm)) return false;

        if (tipoFiltro && tipo !== tipoFiltro) return false;
        if (stockFiltro === 'novedad' && !estado.includes('novedad')) return false;
        if (stockFiltro === 'stock' && !(estado.includes('stock') || estado.includes('novedad'))) return false;
        if (stockFiltro === 'agotado' && !esAgotado) return false;
        if (ludotecaFiltro && ludoteca !== ludotecaFiltro) return false;
        return true;
    });

    // Paginación
    const PAGE_SIZE = 12;
    let page = 1;
    if (renderJuegos._page) page = renderJuegos._page;
    const totalPages = Math.ceil(items.length / PAGE_SIZE);
    if (page > totalPages) page = 1;
    renderJuegos._page = page;

    if (items.length === 0) {
        grid.innerHTML = '';
        empty.classList.remove('hidden');
        if (pagination) pagination.style.display = 'none';
        return;
    }
    empty.classList.add('hidden');

    let pagedItems = items;
    if (items.length > PAGE_SIZE) {
        pagedItems = items.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
    }

    grid.innerHTML = pagedItems.map((item, idx) => {
        const nombre = item['Nombre del elemento'] || '';
        const tipo = item['Tipo'] || '';
        const precio = item['Precio'] || '';
        const estado = item['Estado'] || '';
        const descripcion = item['Descripción'] || '';
        const imagen = item['URL Imagen'] || '';
        const ludoteca = (item['Ludoteca'] || '').toString().trim();
        const badgeClass = getStatusBadgeClass(estado);
        const badgeLabel = getStatusLabel(estado);
        const globalIdx = (page - 1) * PAGE_SIZE + idx;
        return `
            <article class="card juego-card-clickable" data-juego-index="${globalIdx}">
                <div class="card-image-wrapper">
                    ${imagen ? `<img src="${escapeHtml(imagen)}" alt="${escapeHtml(nombre)}" loading="lazy" onerror="this.style.display='none'">` : '<div class="mtg-placeholder">Sin imagen</div>'}
                </div>
                <div class="card-body">
                    ${tipo ? `<span class="card-tag">${escapeHtml(tipo)}</span>` : ''}
                    <h3 class="card-title">${escapeHtml(nombre)}</h3>
                    ${ludoteca === 'Si' ? `<span class="badge badge-info badge-jugable">Disponible para jugar en tienda</span>` : ''}
                    ${descripcion ? `<p class="card-text">${escapeHtml(descripcion)}</p>` : ''}
                    <div class="card-footer">
                        <span class="badge ${badgeClass}">${badgeLabel}</span>
                        ${precio ? `<span class="card-price">${formatPrice(precio)}</span>` : ''}
                    </div>
                </div>
            </article>
        `;
    }).join('');

    // Paginación visual
    if (pagination) {
        if (items.length > PAGE_SIZE) {
            pagination.style.display = 'flex';
            let pagBtns = '';
            if (page > 1) {
                pagBtns += `<button class="btn-pagination" data-page="prev">&laquo; Anterior</button>`;
            }
            for (let i = 1; i <= totalPages; i++) {
                if (i === 1 || i === totalPages || Math.abs(i - page) <= 2) {
                    pagBtns += `<button class="btn-pagination${i === page ? ' btn-pagination-active' : ''}" data-page="${i}">${i}</button>`;
                } else if (i === page - 3 || i === page + 3) {
                    pagBtns += `<span class="pagination-ellipsis">...</span>`;
                }
            }
            if (page < totalPages) {
                pagBtns += `<button class="btn-pagination" data-page="next">Siguiente &raquo;</button>`;
            }
            pagination.innerHTML = pagBtns;
            Array.from(pagination.querySelectorAll('button[data-page]')).forEach(btn => {
                btn.onclick = (e) => {
                    let newPage = page;
                    if (btn.dataset.page === 'prev') newPage = page - 1;
                    else if (btn.dataset.page === 'next') newPage = page + 1;
                    else newPage = parseInt(btn.dataset.page);
                    renderJuegos._page = newPage;
                    renderJuegos();
                    window.scrollTo({top: document.getElementById('juegos').offsetTop - 80, behavior: 'smooth'});
                };
            });
        } else {
            pagination.style.display = 'none';
        }
    }

    const modal = document.getElementById('modal-juego');
    if (modal) {
        const modalImg = modal.querySelector('.modal-img');
        const modalTitle = modal.querySelector('.modal-title');
        const modalPrice = modal.querySelector('.modal-price');
        const closeBtn = modal.querySelector('.modal-close');

        grid.onclick = function(event) {
            const card = event.target.closest('.juego-card-clickable');
            if (!card) return;
            const index = Number(card.dataset.juegoIndex);
            const item = items[index];
            if (!item) return;
            const nombre = item['Nombre del elemento'] || '';
            const precio = item['Precio'] || '';
            const imagen = item['URL Imagen'] || '';

            if (modalTitle) modalTitle.textContent = nombre;
            if (modalPrice) modalPrice.textContent = precio ? formatPrice(precio) : '';
            if (modalImg) {
                if (imagen) {
                    modalImg.src = imagen;
                    modalImg.alt = nombre;
                    modalImg.style.display = '';
                } else {
                    modalImg.style.display = 'none';
                }
            }
            modal.style.display = 'flex';
            setTimeout(() => modal.classList.add('open'), 10);
            document.body.classList.add('modal-open');
        };

        if (closeBtn) {
            closeBtn.onclick = () => {
                modal.classList.remove('open');
                document.body.classList.remove('modal-open');
                setTimeout(() => { modal.style.display = 'none'; }, 200);
            };
        }

        modal.onclick = (e) => {
            if (e.target === modal) {
                modal.classList.remove('open');
                document.body.classList.remove('modal-open');
                setTimeout(() => { modal.style.display = 'none'; }, 200);
            }
        };
    }
}

function renderEventos() {
    const grid = document.getElementById('eventos-grid');
    const cardsEmpty = document.getElementById('eventos-cards-empty');
    const calendarContainer = document.getElementById('eventos-calendar');
    const calendarEmpty = document.getElementById('eventos-calendar-empty');
    const data = sheetData.eventos;
    if (!data || !Array.isArray(data)) {
        grid.innerHTML = '<div class="loading-state">Cargando eventos...</div>';
        if (calendarContainer) calendarContainer.innerHTML = '';
        return;
    }

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekStart = new Date(today);
    const dayOfWeek = weekStart.getDay();
    weekStart.setDate(weekStart.getDate() + (dayOfWeek === 0 ? -6 : 1 - dayOfWeek));
    const calendarEnd = new Date(weekStart);
    calendarEnd.setDate(calendarEnd.getDate() + 27);

    const cardEvents = data
        .map(item => {
            const inicio = parseSheetDate(item['Hora de inicio']);
            const fin = parseSheetDate(item['Hora de finalización']);
            const statusRaw = getEventStatusField(item);
            return {
                ...item,
                inicio,
                fin,
                statusRaw,
                statusLabel: getEventStatusBadgeLabel(statusRaw),
                statusClass: getEventStatusBadgeClass(statusRaw)
            };
        })
        .filter(item => item.inicio && item.fin && item.fin >= today)
        .sort((a, b) => (a.inicio?.getTime() || 0) - (b.inicio?.getTime() || 0));

    const calendarEvents = data
        .map(item => {
            const inicio = parseSheetDate(item['Hora de inicio']);
            const fin = parseSheetDate(item['Hora de finalización']);
            const statusRaw = getEventStatusField(item);
            return {
                ...item,
                inicio,
                fin,
                statusRaw,
                statusLabel: getEventStatusBadgeLabel(statusRaw),
                statusClass: getEventStatusBadgeClass(statusRaw)
            };
        })
        .filter(item => item.inicio && !item.fin && item.inicio >= weekStart && item.inicio <= calendarEnd)
        .sort((a, b) => (a.inicio?.getTime() || 0) - (b.inicio?.getTime() || 0));

    grid.innerHTML = cardEvents.length ? cardEvents.map((item, idx) => {
        const actividad = escapeHtml(item['Actividad'] || '');
        const tipo = escapeHtml(item['Tipo de actividad'] || '');
        const inicio = item['Hora de inicio'];
        const fin = item['Hora de finalización'];
        const descripcion = escapeHtml(item['Descripción'] || '');
        const imagen = item['URL Imagen'] || '';
        const urlInfo = item['Url Info'] || '';
        const fechaTexto = formatDateRange(inicio, fin);
        const badge = `<span class="badge ${item.statusClass}">${item.statusLabel}</span>`;
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
                    <div class="event-card-header">
                        ${tipo ? `<span class="card-tag">${tipo}</span>` : ''}
                        ${badge}
                    </div>
                    <h3 class="card-title">${actividad}</h3>
                    ${fechaTexto ? `<p class="card-meta">📅 ${fechaTexto}</p>` : ''}
                    <p class="card-text">${descripcionCorta}</p>
                    <div class="event-buttons">
                        ${showMasInfo ? `<button class="btn btn-info btn-mas-info" data-idx="${idx}">Más información</button>` : ''}
                        ${urlInfo ? `<a class="btn btn-primary btn-meetup" href="${escapeHtml(urlInfo)}" target="_blank" rel="noopener">Ir a Meetup</a>` : ''}
                    </div>
                </div>
            </article>
        `;
    }).join('') : '';

    cardsEmpty.classList.toggle('hidden', cardEvents.length > 0);

    if (calendarContainer) {
        if (calendarEvents.length === 0) {
            calendarContainer.innerHTML = '';
        } else {
            calendarContainer.innerHTML = buildEventCalendar(calendarEvents, weekStart, 4);
        }
    }
    if (calendarEmpty) calendarEmpty.classList.toggle('hidden', calendarEvents.length > 0);

    if (cardEvents.length > 0) {
        grid.querySelectorAll('.btn-mas-info').forEach(btn => {
            btn.addEventListener('click', () => {
                const idx = btn.getAttribute('data-mas-idx') || btn.getAttribute('data-idx');
                const item = cardEvents[idx];
                mostrarModalEvento(item);
            });
        });
    }

    if (calendarEvents.length > 0) {
    // Listeners para vista desktop
    calendarContainer.querySelectorAll('.calendar-desktop .calendar-event-item').forEach(item => {
        item.addEventListener('click', () => {
            const eventIdx = parseInt(item.getAttribute('data-event-idx'));
            const eventItem = calendarEvents[eventIdx];
            mostrarModalEvento(eventItem);
        });
    });
    
    // Listeners para vista móvil
    calendarContainer.querySelectorAll('.calendar-mobile .calendar-mobile-event').forEach(item => {
        item.addEventListener('click', () => {
            const eventIdx = parseInt(item.getAttribute('data-event-idx'));
            const eventItem = calendarEvents[eventIdx];
            mostrarModalEvento(eventItem);
        });
    });
}
}

function buildEventCalendar(events, weekStart, weeks) {
    const locale = 'es-ES';
    const weekdays = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
    
    // --- VISTA DESKTOP: Calendario de semanas ---
    let desktopHTML = '';
    
    desktopHTML += `<div class="calendar-weekdays-header">`;
    weekdays.forEach(day => {
        desktopHTML += `<div class="calendar-weekday-label">${day}</div>`;
    });
    desktopHTML += `</div>`;

    const monthColors = new Map();
    const monthOrder = [];

    for (let w = 0; w < weeks; w++) {
        const weekBegin = new Date(weekStart);
        weekBegin.setDate(weekBegin.getDate() + w * 7);
        
        const weekMonth = `${weekBegin.getFullYear()}-${weekBegin.getMonth()}`;
        if (!monthColors.has(weekMonth)) {
            monthOrder.push(weekMonth);
        }
        
        const monthIndex = monthOrder.indexOf(weekMonth);
        const monthColorClass = monthIndex === 0 ? 'month-current' : 
                                monthIndex === 1 ? 'month-next' : 
                                monthIndex === 2 ? 'month-future' : '';
        
        const weekLabel = weekBegin.toLocaleDateString(locale, { day: 'numeric', month: 'short' });
        desktopHTML += `<div class="calendar-week ${monthColorClass}">
            <div class="calendar-week-title">Semana del ${weekLabel}</div>
            <div class="calendar-days-grid">`;

        for (let d = 0; d < 7; d++) {
            const date = new Date(weekBegin);
            date.setDate(date.getDate() + d);
            const dayEvents = events.filter(ev => ev.inicio && ev.inicio.toDateString() === date.toDateString());
            const dateLabel = date.toLocaleDateString(locale, { day: 'numeric', month: 'short' });
            desktopHTML += `<div class="calendar-day">
                    <div class="calendar-day-header">
                        <span class="calendar-day-date">${dateLabel}</span>
                    </div>`;
            if (dayEvents.length > 0) {
                dayEvents.forEach(ev => {
                    const eventIdx = events.indexOf(ev);
                    const timeLabel = ev.inicio ? ev.inicio.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' }) : '';
                    desktopHTML += `<div class="calendar-event-item event-${normalizeText(ev['Tipo de actividad'] || '').toLowerCase().replace(/\s+/g, '-')}" data-event-idx="${eventIdx}">
                            <div class="calendar-event-title">${escapeHtml(ev['Actividad'] || '')}</div>
                            ${timeLabel ? `<div class="calendar-event-time">${timeLabel}</div>` : ''}
                            <span class="badge ${ev.statusClass}">${ev.statusLabel}</span>
                        </div>`;
                });
            } else {
                desktopHTML += `<div class="calendar-event-empty">Sin eventos</div>`;
            }
            desktopHTML += `</div>`;
        }
        desktopHTML += `</div></div>`;
    }

    // --- VISTA MÓVIL: Lista cronológica por días ---
    let mobileHTML = '';
    
    // Agrupar eventos por día
    const eventsByDay = new Map();
    events.forEach((ev, idx) => {
        if (!ev.inicio) return;
        const dateKey = ev.inicio.toDateString();
        if (!eventsByDay.has(dateKey)) {
            eventsByDay.set(dateKey, { date: ev.inicio, events: [] });
        }
        eventsByDay.get(dateKey).events.push({ ...ev, originalIdx: idx });
    });
    
    // Ordenar días
    const sortedDays = Array.from(eventsByDay.values()).sort((a, b) => a.date - b.date);
    
    sortedDays.forEach(day => {
        const dateStr = day.date.toLocaleDateString(locale, { 
            weekday: 'long', 
            day: 'numeric', 
            month: 'long' 
        });
        
        mobileHTML += `<div class="calendar-mobile-day">
            <div class="calendar-mobile-date">${dateStr}</div>
            <div class="calendar-mobile-events">`;
        
        day.events.forEach(ev => {
            const timeLabel = ev.inicio ? ev.inicio.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' }) : '';
            const tipo = escapeHtml(ev['Tipo de actividad'] || 'Evento');
            
            mobileHTML += `<div class="calendar-mobile-event" data-event-idx="${ev.originalIdx}">
                <div class="calendar-mobile-event-title">${escapeHtml(ev['Actividad'] || '')}</div>
                ${timeLabel ? `<div class="calendar-mobile-event-time">🕐 ${timeLabel}</div>` : ''}
                <span class="calendar-mobile-event-type event-${normalizeText(tipo).toLowerCase().replace(/\s+/g, '-')}">${tipo}</span>
                <span class="badge ${ev.statusClass}">${ev.statusLabel}</span>
            </div>`;
        });
        
        mobileHTML += `</div></div>`;
    });
    
    if (sortedDays.length === 0) {
        mobileHTML = '<div class="empty-state"><p>No hay eventos programados.</p></div>';
    }

    return `
        <div class="calendar-desktop">${desktopHTML}</div>
        <div class="calendar-mobile">${mobileHTML}</div>
    `;
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
    const status = getEventStatusField(item);
    const statusClass = getEventStatusBadgeClass(status);
    const statusLabel = getEventStatusBadgeLabel(status);
    modal.querySelector('.modal-title').innerText = actividad;
    modal.querySelector('.modal-fecha').innerText = fechaTexto;
    modal.querySelector('.modal-tipo').innerText = tipo;
    modal.querySelector('.modal-status').innerHTML = status ? `<span class="badge ${statusClass}">${statusLabel}</span>` : '';
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
    const searchInput = document.getElementById('mtg-search');
    const pagination = document.getElementById('mtg-pagination');
    const data = sheetData.mtg;
    if (!data) {
        grid.innerHTML = '<div class="loading-state"><div class="spinner"></div><p>Cargando cartas...</p></div>';
        if (pagination) pagination.style.display = 'none';
        return;
    }

    // Filtro por búsqueda
    let searchTerm = '';
    if (searchInput) searchTerm = normalizeText(searchInput.value);

    let items = data.filter(item => (item['Nombre'] || '').toString().trim());
    if (searchTerm) {
        items = items.filter(item => {
            const nombre = normalizeText(item['Nombre'] || '');
            const nombreCastellano = normalizeText(item['Castellano'] || '');
            return nombre.includes(searchTerm) || nombreCastellano.includes(searchTerm);
        });
    }

    // Paginación
    const PAGE_SIZE = 12;
    let page = 1;
    if (renderMTG._page) page = renderMTG._page;
    const totalPages = Math.ceil(items.length / PAGE_SIZE);
    if (page > totalPages) page = 1;
    renderMTG._page = page;

    if (items.length === 0) {
        grid.innerHTML = '';
        empty.classList.remove('hidden');
        if (pagination) pagination.style.display = 'none';
        return;
    }
    empty.classList.add('hidden');

    let pagedItems = items;
    if (items.length > PAGE_SIZE) {
        pagedItems = items.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
    }

    function toTitleCase(str) {
        return str.replace(/\w\S*/g, (txt) => txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase());
    }
    grid.innerHTML = pagedItems.map((item, idx) => {
        const nombre = item['Nombre'] || '';
        const nombreCastellano = (item['Castellano'] || '').toString().trim();
        const globalIdx = (page-1)*PAGE_SIZE + idx;
        return `
            <article class="card mtg-card-clickable" data-mtg-index="${globalIdx}">
                <div class="card-image-wrapper" style="aspect-ratio: 0.714 / 1; background: #1a1a1a; cursor:pointer;">
                    <div class="mtg-placeholder" id="mtg-img-${globalIdx}" data-mtg-name="${escapeHtml(nombre)}" data-mtg-set="${escapeHtml(nombreCastellano)}">
                        <span>Buscando imagen...</span>
                    </div>
                </div>
                <div class="card-body">
                    <h3 class="card-title">${escapeHtml(toTitleCase(nombre))}</h3>
                    ${nombreCastellano ? `<p class="card-meta"> ${escapeHtml(toTitleCase(nombreCastellano))}</p>` : ''}
                </div>
            </article>
        `;
    }).join('');

    grid.querySelectorAll('.mtg-placeholder').forEach(placeholder => mtgImageObserver.observe(placeholder));

    // Modal de imagen ampliada
    const modal = document.getElementById('mtg-modal');
    const modalImg = document.getElementById('mtg-modal-img');
    const modalLoading = modal.querySelector('.modal-loading');
    const modalLoadingText = modalLoading ? modalLoading.querySelector('p') : null;
    const modalTitle = document.getElementById('mtg-modal-title');
    const modalEdition = document.getElementById('mtg-modal-edition');
    const closeBtn = document.getElementById('mtg-modal-close');

    const clearModalPoll = () => {
        if (modal._pollId) {
            clearInterval(modal._pollId);
            modal._pollId = null;
        }
    };

    const showModal = () => {
        modal.style.display = 'flex';
        setTimeout(() => { modal.classList.add('open'); }, 10);
    };

    const prepareModal = (title, edition) => {
        modalTitle.textContent = title;
        modalEdition.textContent = edition;
        if (modalImg) {
            modalImg.style.display = 'none';
            modalImg.src = '';
        }
        if (modalLoading) {
            modalLoading.classList.remove('hidden');
            if (modalLoadingText) modalLoadingText.textContent = 'Cargando imagen...';
        }
    };

    const completeModalWithImage = (imgEl, title, edition) => {
        if (!modal) return;
        if (modalImg) {
            modalImg.src = imgEl.src;
            modalImg.alt = title;
            modalImg.style.display = '';
        }
        if (modalLoading) {
            modalLoading.classList.add('hidden');
        }
        modalTitle.textContent = title;
        modalEdition.textContent = edition;
    };

    grid.onclick = function(event) {
        const card = event.target.closest('.mtg-card-clickable');
        if (!card) return;
        const index = Number(card.dataset.mtgIndex);
        const item = items[index];
        if (!item) return;
        clearModalPoll();
        const titleText = toTitleCase(item['Nombre'] || '');
        const editionText = (item['Edición'] || '').toString().trim().toUpperCase();
        prepareModal(titleText, editionText);
        showModal();

        const updateModalImage = () => {
            const loadedImg = card.querySelector('img');
            const failedPlaceholder = card.querySelector('.mtg-placeholder.failed');
            if (loadedImg && loadedImg.complete && loadedImg.naturalWidth !== 0) {
                completeModalWithImage(loadedImg, titleText, editionText);
                clearModalPoll();
            } else if (failedPlaceholder) {
                if (modalLoadingText) modalLoadingText.textContent = 'Imagen no disponible';
                clearModalPoll();
            }
        };

        updateModalImage();
        modal._pollId = setInterval(updateModalImage, 250);
        setTimeout(() => {
            if (modal._pollId) {
                if (modalLoadingText) modalLoadingText.textContent = 'La imagen tarda más de lo esperado...';
            }
        }, 3000);
        setTimeout(() => {
            if (modal._pollId) {
                const currentImg = card.querySelector('img');
                const failedPlaceholder = card.querySelector('.mtg-placeholder.failed');
                if (!currentImg && !failedPlaceholder) {
                    if (modalLoadingText) modalLoadingText.textContent = 'Sigue cargando, espera un momento.';
                }
            }
        }, 6500);
    };
    if (closeBtn) closeBtn.onclick = function() {
        clearModalPoll();
        modal.classList.remove('open');
        setTimeout(() => { modal.style.display = 'none'; }, 200);
    };
    if (modal) {
        modal.onclick = function(e) {
            if (e.target === modal) {
                modal.classList.remove('open');
                setTimeout(() => { modal.style.display = 'none'; }, 200);
            }
        };
    }

    // Paginación visual
    if (pagination) {
        if (items.length > PAGE_SIZE) {
            pagination.style.display = 'flex';
            let pagBtns = '';
            if (page > 1) {
                pagBtns += `<button class="btn-pagination" data-page="prev">&laquo;</button>`;
            }
            for (let i = 1; i <= totalPages; i++) {
                if (i === 1 || i === totalPages || Math.abs(i - page) <= 2) {
                    pagBtns += `<button class="btn-pagination${i === page ? ' btn-pagination-active' : ''}" data-page="${i}">${i}</button>`;
                } else if (i === page - 3 || i === page + 3) {
                    pagBtns += `<span class="pagination-ellipsis">...</span>`;
                }
            }
            if (page < totalPages) {
                pagBtns += `<button class="btn-pagination" data-page="next">&raquo;</button>`;
            }
            pagination.innerHTML = pagBtns;
            Array.from(pagination.querySelectorAll('button[data-page]')).forEach(btn => {
                btn.onclick = (e) => {
                    let newPage = page;
                    if (btn.dataset.page === 'prev') newPage = page - 1;
                    else if (btn.dataset.page === 'next') newPage = page + 1;
                    else newPage = parseInt(btn.dataset.page);
                    renderMTG._page = newPage;
                    renderMTG();
                    window.scrollTo({top: document.getElementById('mtg').offsetTop - 80, behavior: 'smooth'});
                };
            });
        } else {
            pagination.style.display = 'none';
        }
    }
    // Si hay input de búsqueda, enfocar y añadir evento
    if (searchInput && !searchInput._mtgSearchInit) {
        searchInput.addEventListener('input', () => {
            renderMTG._page = 1;
            renderMTG();
        });
        searchInput._mtgSearchInit = true;
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
    else if (sectionId === 'libros') renderLibros(); 
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
    initLibrosSearch();
    const hash = window.location.hash.replace('#', '');
    const validSections = ['inicio', 'eventos', 'juegos', 'mtg', 'libros', 'conocenos'];
    const initialSection = validSections.includes(hash) ? hash : 'inicio';
    showSection(initialSection);
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}


function renderLibros() {
    const grid = document.getElementById('libros-grid');
    const empty = document.getElementById('libros-empty');
    const pagination = document.getElementById('libros-paginacion');
    const data = sheetData.libros;

    if (!data || !Array.isArray(data)) {
        grid.innerHTML = '<div class="loading-state">Cargando libros...</div>';
        if (pagination) pagination.style.display = 'none';
        return;
    }

    // ── BÚSQUEDA MEJORADA ──
    const searchInput = document.getElementById('libros-search');
    let searchTerm = '';
    if (searchInput) {
        searchTerm = normalizeText(searchInput.value);
    }

    // Preprocesamos los items: creamos campos combinados para búsqueda
    let items = data
        .filter(item => item && typeof item === 'object')
        .map(item => {
            const nombre = (item['NombreLibro'] || '').toString().trim();
            const nombreAutor = (item['NombreAutor'] || '').toString().trim();
            const apellidoAutor = (item['ApellidoAutor'] || '').toString().trim();
            
            // Campos combinados para búsqueda
            const autorCompleto = [nombreAutor, apellidoAutor].filter(Boolean).join(' ');
            const autorCompletoInvertido = [apellidoAutor, nombreAutor].filter(Boolean).join(', ');
            
            return {
                ...item,
                _nombreLibro: nombre,
                _autorCompleto: autorCompleto,
                _autorInvertido: autorCompletoInvertido,
                _busquedaGlobal: normalizeText([nombre, autorCompleto, apellidoAutor, nombreAutor].join(' '))
            };
        })
        .filter(item => item._nombreLibro.length > 0);

    // Declaramos terminos AQUÍ, fuera del if, para que esté disponible en todo el ámbito de la función
    let terminos = [];

    // Filtro por búsqueda: busca en título, autor completo, o palabras sueltas
    if (searchTerm) {
        terminos = searchTerm.split(/\s+/).filter(t => t.length > 0);
        
        items = items.filter(item => {
            // Búsqueda exacta de frase completa (prioritaria)
            const matchExacto = item._busquedaGlobal.includes(searchTerm);
            if (matchExacto) return true;
            
            // Búsqueda por términos individuales (todos deben coincidir)
            const matchTerminos = terminos.every(term => 
                item._busquedaGlobal.includes(term)
            );
            
            return matchTerminos;
        });
    }

    // ── ORDENAMIENTO ──
    const sortType = document.getElementById('libros-sort-type')?.value || 'titulo';
    const sortDirection = document.getElementById('libros-sort-direction')?.value || 'asc';
    const isAsc = sortDirection === 'asc';

    items.sort((a, b) => {
        if (sortType === 'titulo') {
            return isAsc 
                ? a._nombreLibro.localeCompare(b._nombreLibro, 'es', { sensitivity: 'base' })
                : b._nombreLibro.localeCompare(a._nombreLibro, 'es', { sensitivity: 'base' });
        } else {
            // Ordenar por apellido del autor (usando el campo separado si existe, o extrayéndolo)
            const apellidoA = normalizeText(a['ApellidoAutor'] || getApellido(a['NombreAutor'] || ''));
            const apellidoB = normalizeText(b['ApellidoAutor'] || getApellido(b['NombreAutor'] || ''));
            return isAsc 
                ? apellidoA.localeCompare(apellidoB, 'es', { sensitivity: 'base' })
                : apellidoB.localeCompare(apellidoA, 'es', { sensitivity: 'base' });
        }
    });

    // ── PAGINACIÓN ──
    const PAGE_SIZE = 16;
    let page = 1;
    if (renderLibros._page) page = renderLibros._page;
    const totalPages = Math.ceil(items.length / PAGE_SIZE);
    if (page > totalPages) page = totalPages > 0 ? totalPages : 1;
    if (page < 1) page = 1;
    renderLibros._page = page;

    // Mostrar contador de resultados
    const resultadosInfo = searchTerm 
        ? `<div class="resultados-info">🔍 ${items.length} resultado${items.length !== 1 ? 's' : ''} para "<strong>${escapeHtml(searchInput.value.trim())}</strong>"</div>`
        : '';

    if (items.length === 0) {
        grid.innerHTML = resultadosInfo + '';
        empty.innerHTML = searchTerm 
            ? `<p>No se encontraron libros que coincidan con "<strong>${escapeHtml(searchInput.value.trim())}</strong>".</p><p style="font-size:0.9rem;color:#888;margin-top:0.5rem;">Prueba con otro término o revisa la ortografía.</p>`
            : '<p>No hay libros disponibles en este momento.</p>';
        empty.classList.remove('hidden');
        if (pagination) pagination.style.display = 'none';
        return;
    }
    
    empty.classList.add('hidden');

    let pagedItems = items;
    if (items.length > PAGE_SIZE) {
        pagedItems = items.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
    }

    // Función para resaltar coincidencias en el texto
    function resaltarCoincidencias(texto, terminosBusqueda) {
        if (!terminosBusqueda || !terminosBusqueda.length) return escapeHtml(texto);
        let resultado = escapeHtml(texto);
        // Escapar caracteres especiales de regex en los términos
        const terminosRegex = terminosBusqueda.map(t => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
        const regex = new RegExp(`(${terminosRegex.join('|')})`, 'gi');
        return resultado.replace(regex, '<mark>$1</mark>');
    }

    grid.innerHTML = resultadosInfo + pagedItems.map(item => {
        const nombre = item._nombreLibro;
        const autorCompleto = item._autorCompleto;
        const precio = item['Precio €'] || item['Precio'] || item['PVP'] || '';
        
        // Resaltar coincidencias si hay búsqueda activa
        const nombreMostrado = searchTerm 
            ? resaltarCoincidencias(nombre, terminos)
            : escapeHtml(nombre);
        
        const autorMostrado = searchTerm && autorCompleto
            ? resaltarCoincidencias(autorCompleto, terminos)
            : escapeHtml(autorCompleto);

        const detalles = [];
        if (autorCompleto) detalles.push(autorMostrado);
        if (precio) detalles.push(escapeHtml(formatPrice(precio)));

        return `
            <article class="card libro-card">
                <div class="card-body">
                    <div class="card-header">
                        <h3 class="card-title">${nombreMostrado}</h3>
                    </div>
                    ${detalles.length ? `<p class="card-meta">${detalles.join(' • ')}</p>` : ''}
                </div>
            </article>
        `;
    }).join('');

    // ── PAGINACIÓN VISUAL ──
    if (pagination) {
        if (items.length > PAGE_SIZE) {
            pagination.style.display = 'flex';
            let pagBtns = '';
            if (page > 1) {
                pagBtns += `<button class="btn-pagination" data-page="prev">&laquo; Anterior</button>`;
            }
            for (let i = 1; i <= totalPages; i++) {
                if (i === 1 || i === totalPages || Math.abs(i - page) <= 2) {
                    pagBtns += `<button class="btn-pagination${i === page ? ' btn-pagination-active' : ''}" data-page="${i}">${i}</button>`;
                } else if (i === page - 3 || i === page + 3) {
                    pagBtns += `<span class="pagination-ellipsis">...</span>`;
                }
            }
            if (page < totalPages) {
                pagBtns += `<button class="btn-pagination" data-page="next">Siguiente &raquo;</button>`;
            }
            pagination.innerHTML = pagBtns;
            Array.from(pagination.querySelectorAll('button[data-page]')).forEach(btn => {
                btn.onclick = (e) => {
                    let newPage = page;
                    if (btn.dataset.page === 'prev') newPage = page - 1;
                    else if (btn.dataset.page === 'next') newPage = page + 1;
                    else newPage = parseInt(btn.dataset.page);
                    renderLibros._page = newPage;
                    renderLibros();
                    window.scrollTo({top: document.getElementById('libros').offsetTop - 80, behavior: 'smooth'});
                };
            });
        } else {
            pagination.style.display = 'none';
        }
    }
}

function initLibrosSearch() {
    const searchInput = document.getElementById('libros-search');
    if (searchInput) {
        searchInput.addEventListener('input', () => {
            renderLibros._page = 1; // Reset a página 1 al buscar
            renderLibros();
        });
    }
    const sortTypeSelect = document.getElementById('libros-sort-type');
    if (sortTypeSelect) {
        sortTypeSelect.addEventListener('change', () => {
            renderLibros._page = 1; // Reset a página 1 al ordenar
            renderLibros();
        });
    }
    const sortDirectionSelect = document.getElementById('libros-sort-direction');
    if (sortDirectionSelect) {
        sortDirectionSelect.addEventListener('change', () => {
            renderLibros._page = 1; // Reset a página 1 al ordenar
            renderLibros();
        });
    }
}