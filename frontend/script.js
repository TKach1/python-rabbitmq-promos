const API_URL = "http://localhost:8000";

// Minimal UI: no debug panel. Notifications area used for important messages.

// Render promotions into the promotionsList container
function renderPromotions(promocoes) {
    const container = document.getElementById("promotionsList");
    if (!container) return;
    if (!promocoes || promocoes.length === 0) {
        container.innerHTML = '<p>Nenhuma promoção disponível.</p>';
        return;
    }
    // build category filter options
    const catSet = new Set();
    promocoes.forEach(p => { if (p.categoria) catSet.add(p.categoria); });
    const categoryFilter = document.getElementById('categoryFilter');
    if (categoryFilter) {
        const current = categoryFilter.value || '';
        categoryFilter.innerHTML = '<option value="">Todas as categorias</option>' + Array.from(catSet).map(c => `<option value="${c}" ${c===current? 'selected':''}>${c}</option>`).join('');
    }
    const rows = promocoes.map(p => {
        return `
            <div class="promo-card">
                <div class="promo-image">Imagem</div>
                <div class="promo-body">
                    <div class="promo-title">${p.titulo} <small style='color:#666'>(${p.id})</small></div>
                    <div class="promo-category">${p.categoria}</div>
                    <div class="promo-price">R$ ${Number(p.preco).toFixed(2)}</div>
                </div>
                <div class="promo-actions">
                    <div class="promo-score">Score: <span data-score-id="${p.id}">-</span></div>
                    <div>
                        <button data-id="${p.id}" class="vote-btn" data-vote="true">👍</button>
                        <button data-id="${p.id}" class="vote-btn down" data-vote="false">👎</button>
                    </div>
                </div>
            </div>
        `;
    }).join('');
    container.innerHTML = rows;

    // attach vote handlers
    document.querySelectorAll('.vote-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const id = btn.getAttribute('data-id');
            const voto = btn.getAttribute('data-vote');
            votarPromocao(id, voto);
        });
    });
}

// API calls
async function listarPromocoes() {
    try {
        const response = await fetch(`${API_URL}/listar_promocoes`);
        const data = await response.json();
        const promos = (data.payload && data.payload.promocoes) || [];
        renderPromotions(promos);
        return promos;
    } catch (error) {
        // silent on load errors
        return [];
    }
}

async function registrarPromocao(id, titulo, categoria, preco) {
    try {
        const response = await fetch(`${API_URL}/registrar_promocao`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id, titulo, categoria, preco: parseFloat(preco) })
        });
        const data = await response.json();
        // refresh list
        // refresh list
        await listarPromocoes();
    } catch (error) {
        // fail silently for a cleaner UI
    }
}

async function votarPromocao(promocao_id, positivo) {
    try {
        const response = await fetch(`${API_URL}/votar_promocao`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ promocao_id, positivo: positivo === "true" })
        });
        const data = await response.json();
        // update score if returned
        // update score if returned
        try {
            const payload = data.payload || {};
            const pontuacao = payload.pontuacao || null;
            const ranking = payload.ranking || null;
            if (pontuacao !== null) {
                // display on card
                const el = document.querySelector(`[data-score-id="${promocao_id}"]`);
                if (el) el.innerText = pontuacao;
            }
            if (ranking) {
                // ranking info available, but not shown to keep UI clean
            }
        } catch (e) {
            // ignore
        }
    } catch (error) {
        // silent
    }
}

async function registrarInteresse(usuario_id, categoria) {
    try {
        const response = await fetch(`${API_URL}/interesse/categoria`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ usuario_id, categoria })
        });
        const data = await response.json();
        // show minimal confirmation in notifications
        pushNotification({ mensagem: `Interesse registrado em ${categoria}`, promocao: { id: '', categoria } });
        saveLocalInterest(usuario_id, categoria);
    } catch (error) {
        // silent
    }
}

async function cancelarInteresse(usuario_id, categoria) {
    try {
        const response = await fetch(`${API_URL}/interesse/categoria`, {
            method: "DELETE",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ usuario_id, categoria })
        });
        const data = await response.json();
        pushNotification({ mensagem: `Interesse cancelado em ${categoria}`, promocao: { id: '', categoria } });
        removeLocalInterest(usuario_id, categoria);
    } catch (error) {
        // silent
    }
}

// Local subscription store to power polling notifications (SSE missing in gateway)
function getLocalInterests() {
    try {
        return JSON.parse(localStorage.getItem('interesses') || '{}');
    } catch {
        return {};
    }
}

function saveLocalInterest(usuario_id, categoria) {
    const db = getLocalInterests();
    if (!db[usuario_id]) db[usuario_id] = [];
    if (!db[usuario_id].includes(categoria)) db[usuario_id].push(categoria);
    localStorage.setItem('interesses', JSON.stringify(db));
}

function removeLocalInterest(usuario_id, categoria) {
    const db = getLocalInterests();
    if (!db[usuario_id]) return;
    db[usuario_id] = db[usuario_id].filter(c => c !== categoria);
    if (db[usuario_id].length === 0) delete db[usuario_id];
    localStorage.setItem('interesses', JSON.stringify(db));
}

function pushNotification(messageObj) {
    const container = document.getElementById('notifications');
    const el = document.createElement('div');
    el.style.border = '1px solid #ddd';
    el.style.padding = '10px';
    el.style.marginBottom = '8px';
    el.innerHTML = `<strong>${messageObj.mensagem}</strong><div style="font-size:12px;color:#333">Categoria: ${messageObj.promocao.categoria} • ID: ${messageObj.promocao.id}</div>`;
    if (container) {
        if (container.innerText === 'Nenhuma notificação ainda.') container.innerHTML = '';
        container.prepend(el);
    }
}

// Polling loop: fetch promotions periodically and detect new ones to notify subscribers
let lastSeenIds = new Set();
async function startPolling(intervalMs = 5000) {
    // initial load
    const initial = await listarPromocoes();
    initial.forEach(p => lastSeenIds.add(p.id));

    setInterval(async () => {
        const promos = await listarPromocoes();
        const interests = getLocalInterests();
        const clientIds = Object.keys(interests);
        const newPromos = promos.filter(p => !lastSeenIds.has(p.id));
        if (newPromos.length > 0) {
            newPromos.forEach(p => {
                // notify any user that has this category
                clientIds.forEach(uid => {
                    const cats = interests[uid] || [];
                    if (cats.includes(p.categoria)) {
                        pushNotification({ mensagem: `Nova promoção em ${p.categoria}: ${p.titulo}`, promocao: p });
                    }
                });
                lastSeenIds.add(p.id);
            });
        }
    }, intervalMs);
}

// Event listeners
document.addEventListener("DOMContentLoaded", function() {
    // Listar
    const btnListar = document.getElementById("btnListar");
    if (btnListar) btnListar.addEventListener("click", listarPromocoes);
    // search and category filter
    const searchInput = document.getElementById('searchInput');
    const categoryFilter = document.getElementById('categoryFilter');
    let currentPromos = [];
    if (searchInput) {
        searchInput.addEventListener('input', () => {
            const q = searchInput.value.trim().toLowerCase();
            const category = categoryFilter ? categoryFilter.value : '';
            const filtered = currentPromos.filter(p => {
                const matchQ = q === '' || (p.titulo && p.titulo.toLowerCase().includes(q)) || (p.id && p.id.toLowerCase().includes(q));
                const matchCat = !category || p.categoria === category;
                return matchQ && matchCat;
            });
            renderPromotions(filtered);
        });
    }
    if (categoryFilter) {
        categoryFilter.addEventListener('change', () => {
            const q = searchInput ? searchInput.value.trim().toLowerCase() : '';
            const category = categoryFilter.value;
            const filtered = currentPromos.filter(p => {
                const matchQ = q === '' || (p.titulo && p.titulo.toLowerCase().includes(q)) || (p.id && p.id.toLowerCase().includes(q));
                const matchCat = !category || p.categoria === category;
                return matchQ && matchCat;
            });
            renderPromotions(filtered);
        });
    }

    // Registrar Promoção
    const btnRegistrar = document.getElementById("btnRegistrar");
    if (btnRegistrar) {
        btnRegistrar.addEventListener("click", function() {
            const id = document.getElementById("inputPromoId").value.trim();
            const titulo = document.getElementById("inputPromoTitulo").value.trim();
            const categoria = document.getElementById("inputPromoCategoria").value.trim();
            const preco = document.getElementById("inputPromoPreco").value;
            if (!id || !titulo || !categoria || !preco) {
                pushNotification({ mensagem: 'Preencha todos os campos', promocao: { id:'', categoria:'' } });
                return;
            }
            registrarPromocao(id, titulo, categoria, preco);
        });
    }

    // Vote via quick buttons in each promo card (handled in render)

    // Registrar Interesse
    const btnRegistrarInteresse = document.getElementById("btnRegistrarInteresse");
    if (btnRegistrarInteresse) {
        btnRegistrarInteresse.addEventListener("click", function() {
            const usuario_id = document.getElementById("inputUsuarioId").value.trim();
            const categoria = document.getElementById("inputCategoria").value.trim();
            if (!usuario_id || !categoria) {
                pushNotification({ mensagem: 'Preencha todos os campos', promocao: { id:'', categoria:'' } });
                return;
            }
            registrarInteresse(usuario_id, categoria);
        });
    }

    // Cancelar Interesse
    const btnCancelarInteresse = document.getElementById("btnCancelarInteresse");
    if (btnCancelarInteresse) {
        btnCancelarInteresse.addEventListener("click", function() {
            const usuario_id = document.getElementById("inputUsuarioId").value.trim();
            const categoria = document.getElementById("inputCategoria").value.trim();
            if (!usuario_id || !categoria) {
                pushNotification({ mensagem: 'Preencha todos os campos', promocao: { id:'', categoria:'' } });
                return;
            }
            cancelarInteresse(usuario_id, categoria);
        });
    }

    // start polling for new promotions (acts as notifications when interests registered)
    // keep currentPromos in sync for filtering
    (async () => {
        currentPromos = await listarPromocoes();
        startPolling(5000);
    })();

    // Top header search + list button
    const btnListarTop = document.getElementById('btnListarTop');
    const searchInputTop = document.getElementById('searchInputTop');
    if (btnListarTop) btnListarTop.addEventListener('click', async () => {
        currentPromos = await listarPromocoes();
        // copy top search to main search
        const q = (searchInputTop && searchInputTop.value) || '';
        const searchInput = document.getElementById('searchInput');
        if (searchInput) searchInput.value = q;
        // trigger input event to filter
        if (searchInput) searchInput.dispatchEvent(new Event('input'));
    });
});
