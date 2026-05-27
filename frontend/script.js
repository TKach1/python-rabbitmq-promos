const API_URL = "http://localhost:8000";

// 1️⃣ GET /promocoes - List all promotions
async function listarPromocoes() {
    try {
        const response = await fetch(`${API_URL}/listar_promocoes`);
        const data = await response.json();
        console.log("Promoções:", data);
        return data;
    } catch (error) {
        console.error("Erro ao listar:", error);
    }
}

// 2️⃣ POST /promocoes - Register a new promotion
async function registrarPromocao(id, titulo, categoria, preco) {
    try {
        const response = await fetch(`${API_URL}/registrar_promocao`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                id: id,
                titulo: titulo,
                categoria: categoria,
                preco: preco
            })
        });
        const data = await response.json();
        console.log("Promoção registrada:", data);
        return data;
    } catch (error) {
        console.error("Erro ao registrar:", error);
    }
}

// 3️⃣ POST /promocoes/{promo_id}/like - Like a promotion
async function curtirPromocao(promoId) {
    try {
        const response = await fetch(`${API_URL}/curtir_promocao/${promoId}`, {
            method: "POST"
        });
        const data = await response.json();
        console.log("Voto registrado:", data);
        return data;
    } catch (error) {
        console.error("Erro ao curtir:", error);
    }
}