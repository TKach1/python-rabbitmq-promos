const API_URL = "http://localhost:8000";
const CLIENT_SESSION_KEY = 'clientSessionId';

function getClientSessionId(){
    let id = sessionStorage.getItem(CLIENT_SESSION_KEY);
    if(!id){
        id = `${Date.now()}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
        sessionStorage.setItem(CLIENT_SESSION_KEY, id);
    }
    return id;
}

const clientSessionId = getClientSessionId();

function pushNotification(messageObj){
    const container = document.getElementById('notifications');
    const el = document.createElement('div');
    el.style.border='1px solid #ddd';el.style.padding='8px';el.style.marginBottom='8px';
    el.innerHTML = `<strong>${messageObj.mensagem}</strong><div style="font-size:12px">Categoria: ${messageObj.promocao.categoria} • ID: ${messageObj.promocao.id}</div>`;
    if(container && container.innerText==='Nenhuma notificação ainda.') container.innerHTML='';
    if(container) container.prepend(el);
}

function renderPromotions(promocoes){
    const container = document.getElementById('promotionsList');
    if(!container) return;
    if(!promocoes || promocoes.length===0){ container.innerHTML='<p>Nenhuma promoção disponível.</p>'; return; }
    const catSet = new Set(); promocoes.forEach(p=>{ if(p.categoria) catSet.add(p.categoria); });
    const categoryFilter = document.getElementById('categoryFilter');
    if(categoryFilter){ const current = categoryFilter.value||''; categoryFilter.innerHTML = '<option value="">Todas as categorias</option>' + Array.from(catSet).map(c=>`<option value="${c}" ${c===current? 'selected':''}>${c}</option>`).join(''); }
    container.innerHTML = promocoes.map(p=>`<div class="promo-card"><div class="promo-title">${p.titulo} <small>(${p.id})</small></div><div>${p.categoria}</div><div>R$ ${Number(p.preco).toFixed(2)}</div><div style="margin-top:8px">Score: <span data-score-id="${p.id}">-</span> <button data-id="${p.id}" class="vote-btn" data-vote="true">👍</button> <button data-id="${p.id}" class="vote-btn down" data-vote="false">👎</button></div></div>`).join('');
    document.querySelectorAll('.vote-btn').forEach(btn=>{ btn.addEventListener('click', ()=>{ const id=btn.getAttribute('data-id'); const voto=btn.getAttribute('data-vote'); votarPromocao(id,voto); }); });
}

async function listarPromocoes(){
    try{ const res = await fetch(`${API_URL}/listar_promocoes`); const data = await res.json(); const promos = (data.payload && data.payload.promocoes)||[]; renderPromotions(promos); return promos;}catch(e){return[]}
}

async function votarPromocao(promocao_id, positivo){
    try{ const res = await fetch(`${API_URL}/votar_promocao`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({promocao_id, positivo: positivo==='true'})}); const data = await res.json(); try{ const payload = data.payload||{}; const pontuacao = payload.pontuacao||null; if(pontuacao !== null){ const el=document.querySelector(`[data-score-id="${promocao_id}"]`); if(el) el.innerText = pontuacao;} }catch(e){} }catch(e){}
}

async function registrarInteresse(categoria){
    try{
        await fetch(`${API_URL}/interesse/categoria`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({usuario_id: clientSessionId, categoria})});
        pushNotification({mensagem:`Interesse registrado em ${categoria}`, promocao:{id:'',categoria}});
        saveLocalInterest(clientSessionId,categoria);
        addSessionInterest(categoria);
    }catch(e){}
}

async function cancelarInteresse(categoria){
    try{
        await fetch(`${API_URL}/interesse/categoria`,{method:'DELETE',headers:{'Content-Type':'application/json'},body:JSON.stringify({usuario_id: clientSessionId, categoria})});
        pushNotification({mensagem:`Interesse cancelado em ${categoria}`, promocao:{id:'',categoria}});
        removeLocalInterest(clientSessionId,categoria);
        removeSessionInterest(categoria);
    }catch(e){}
}

function getLocalInterests(){ try{ return JSON.parse(localStorage.getItem('interesses')||'{}'); }catch(e){return{}} }
function saveLocalInterest(u,c){ const db=getLocalInterests(); if(!db[u]) db[u]=[]; if(!db[u].includes(c)) db[u].push(c); localStorage.setItem('interesses', JSON.stringify(db)); }
function removeLocalInterest(u,c){ const db=getLocalInterests(); if(!db[u]) return; db[u]=db[u].filter(x=>x!==c); if(db[u].length===0) delete db[u]; localStorage.setItem('interesses', JSON.stringify(db)); }

function getSessionInterestKey(){ return `sessionInterests:${clientSessionId}`; }
function getSessionInterests(){ try{ return JSON.parse(localStorage.getItem(getSessionInterestKey())||'[]'); }catch(e){return[];} }
function setSessionInterests(categories){ localStorage.setItem(getSessionInterestKey(), JSON.stringify(categories)); }

function addSessionInterest(categoria){
    const categories = new Set(getSessionInterests());
    categories.add(categoria);
    setSessionInterests(Array.from(categories));

    const sessionsKey = `interestSessions:${categoria}`;
    const sessions = new Set(JSON.parse(localStorage.getItem(sessionsKey)||'[]'));
    sessions.add(clientSessionId);
    localStorage.setItem(sessionsKey, JSON.stringify(Array.from(sessions)));
}

function removeSessionInterest(categoria){
    const categories = new Set(getSessionInterests());
    categories.delete(categoria);
    setSessionInterests(Array.from(categories));

    const sessionsKey = `interestSessions:${categoria}`;
    const sessions = new Set(JSON.parse(localStorage.getItem(sessionsKey)||'[]'));
    sessions.delete(clientSessionId);
    localStorage.setItem(sessionsKey, JSON.stringify(Array.from(sessions)));
}

function clearSessionInterests(){
    const categories = getSessionInterests();
    categories.forEach(categoria=>{
        const sessionsKey = `interestSessions:${categoria}`;
        const sessions = new Set(JSON.parse(localStorage.getItem(sessionsKey)||'[]'));
        sessions.delete(clientSessionId);
        localStorage.setItem(sessionsKey, JSON.stringify(Array.from(sessions)));
    });
    localStorage.removeItem(getSessionInterestKey());
}

let lastSeenIds = new Set();
async function startPolling(intervalMs=5000){ const initial = await listarPromocoes(); initial.forEach(p=> lastSeenIds.add(p.id)); setInterval(async ()=>{ const promos = await listarPromocoes(); const interests = getLocalInterests(); const clientIds = Object.keys(interests); const newPromos = promos.filter(p=>!lastSeenIds.has(p.id)); if(newPromos.length>0){ newPromos.forEach(p=>{ clientIds.forEach(uid=>{ const cats = interests[uid]||[]; if(cats.includes(p.categoria)) pushNotification({mensagem:`Nova promoção em ${p.categoria}: ${p.titulo}`, promocao:p}); }); lastSeenIds.add(p.id); }); } }, intervalMs); }

document.addEventListener('DOMContentLoaded', ()=>{
    const btnListar = document.getElementById('btnListar'); if(btnListar) btnListar.addEventListener('click', listarPromocoes);
    const searchInput = document.getElementById('searchInput'); const categoryFilter = document.getElementById('categoryFilter'); let currentPromos = [];
    if(searchInput) searchInput.addEventListener('input', ()=>{ const q = searchInput.value.trim().toLowerCase(); const category = categoryFilter ? categoryFilter.value : ''; const filtered = currentPromos.filter(p=>{ const matchQ = q==='' || (p.titulo && p.titulo.toLowerCase().includes(q)) || (p.id && p.id.toLowerCase().includes(q)); const matchCat = !category || p.categoria===category; return matchQ && matchCat; }); renderPromotions(filtered); });
    if(categoryFilter) categoryFilter.addEventListener('change', ()=>{ const q = searchInput ? searchInput.value.trim().toLowerCase() : ''; const category = categoryFilter.value; const filtered = currentPromos.filter(p=>{ const matchQ = q==='' || (p.titulo && p.titulo.toLowerCase().includes(q)) || (p.id && p.id.toLowerCase().includes(q)); const matchCat = !category || p.categoria===category; return matchQ && matchCat; }); renderPromotions(filtered); });

    const btnRegistrarInteresse = document.getElementById('btnRegistrarInteresse'); if(btnRegistrarInteresse) btnRegistrarInteresse.addEventListener('click', ()=>{ const categoria = document.getElementById('inputCategoria').value.trim(); if(!categoria){ pushNotification({mensagem:'Preencha a categoria', promocao:{id:'',categoria:''}}); return; } registrarInteresse(categoria); });
    const btnCancelarInteresse = document.getElementById('btnCancelarInteresse'); if(btnCancelarInteresse) btnCancelarInteresse.addEventListener('click', ()=>{ const categoria = document.getElementById('inputCategoria').value.trim(); if(!categoria){ pushNotification({mensagem:'Preencha a categoria', promocao:{id:'',categoria:''}}); return; } cancelarInteresse(categoria); });

    window.addEventListener('storage', event=>{
        if(event.key==='promoNotification' && event.newValue){
            try{
                const notification = JSON.parse(event.newValue);
                if(notification.sessionIds && notification.sessionIds.includes(clientSessionId)){
                    pushNotification({mensagem:`Nova promoção em ${notification.categoria}: ${notification.titulo}`, promocao:{id:notification.id,categoria:notification.categoria}});
                }
            }catch(e){}
        }
    });

    window.addEventListener('beforeunload', ()=>{
        clearSessionInterests();
    });

    (async ()=>{ currentPromos = await listarPromocoes(); startPolling(5000); })();
});
