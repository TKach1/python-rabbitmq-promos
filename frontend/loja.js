const API_URL = "http://localhost:8000";

function getNotificationsContainer(){ return document.getElementById('notifications'); }

function pushNotification(message){
    const container = getNotificationsContainer();
    if(!container) return;
    const el = document.createElement('div');
    el.style.border='1px solid #ddd';el.style.padding='8px';el.style.marginBottom='8px';
    el.innerText = message;
    if(container.innerText==='Nenhuma notificação ainda.') container.innerHTML='';
    container.prepend(el);
}

function getInterestedSessions(categoria){
    try{
        return JSON.parse(localStorage.getItem(`interestSessions:${categoria}`) || '[]');
    }catch(e){
        return [];
    }
}

function broadcastPromoNotification(notification){
    localStorage.setItem('promoNotification', JSON.stringify(notification));
}

async function registrarPromocaoLoja(){
    const id = document.getElementById('inputPromoIdLoja').value.trim();
    const titulo = document.getElementById('inputPromoTituloLoja').value.trim();
    const categoria = document.getElementById('inputPromoCategoriaLoja').value.trim();
    const preco = document.getElementById('inputPromoPrecoLoja').value;
    if(!id||!titulo||!categoria||!preco){ pushNotification('Preencha todos os campos da promoção'); return; }

    const payloadObj = { id, titulo, categoria, preco: parseFloat(preco)};

    try{
        await fetch(`${API_URL}/registrar_promocao`,{
            method:'POST',headers:{'Content-Type':'application/json'},
            body: JSON.stringify(payloadObj)
        });
        pushNotification('Promoção cadastrada com sucesso');
        const sessionIds = getInterestedSessions(categoria);
        if(sessionIds.length>0){
            broadcastPromoNotification({
                eventId: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
                sessionIds,
                categoria,
                id,
                titulo,
            });
        }
    }catch(e){ pushNotification('Erro ao enviar promoção para o gateway'); }
}

document.addEventListener('DOMContentLoaded', ()=>{
    const btn = document.getElementById('btnRegistrarLoja');
    if(btn) btn.addEventListener('click', registrarPromocaoLoja);
});
