const API_URL = "http://localhost:8000";

// Display function
function displayResponse(title, data) {
    const output = document.getElementById("output");
    const timestamp = new Date().toLocaleTimeString();
    output.innerHTML = `<strong>${timestamp} - ${title}:</strong><pre>${JSON.stringify(data, null, 2)}</pre>`;
}

// Error handling
function handleError(error) {
    console.error(error);
    displayResponse("Erro", { message: error.message });
}

// 1. Listar Promoções
async function listarPromocoes() {
    try {
        const response = await fetch(`${API_URL}/listar_promocoes`);
        const data = await response.json();
        displayResponse("Promoções Listadas", data);
    } catch (error) {
        handleError(error);
    }
}

// 2. Registrar Promoção
async function registrarPromocao(id, titulo, categoria, preco) {
    try {
        const response = await fetch(`${API_URL}/registrar_promocao`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id, titulo, categoria, preco: parseFloat(preco) })
        });
        const data = await response.json();
        displayResponse("Promoção Registrada", data);
    } catch (error) {
        handleError(error);
    }
}

// 3. Votar em Promoção
async function votarPromocao(promocao_id, positivo) {
    try {
        const response = await fetch(`${API_URL}/votar_promocao`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ promocao_id, positivo: positivo === "true" })
        });
        const data = await response.json();
        displayResponse("Voto Registrado", data);
    } catch (error) {
        handleError(error);
    }
}

// 4. Registrar Interesse
async function registrarInteresse(usuario_id, categoria) {
    try {
        const response = await fetch(`${API_URL}/interesse/categoria`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ usuario_id, categoria })
        });
        const data = await response.json();
        displayResponse("Interesse Registrado", data);
    } catch (error) {
        handleError(error);
    }
}

// 5. Cancelar Interesse
async function cancelarInteresse(usuario_id, categoria) {
    try {
        const response = await fetch(`${API_URL}/interesse/categoria`, {
            method: "DELETE",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ usuario_id, categoria })
        });
        const data = await response.json();
        displayResponse("Interesse Cancelado", data);
    } catch (error) {
        handleError(error);
    }
}

// Event listeners (runs when DOM is fully loaded)
document.addEventListener("DOMContentLoaded", function() {
    // 1. Listar Promoções
    const btnListar = document.getElementById("btnListar");
    if (btnListar) {
        btnListar.addEventListener("click", listarPromocoes);
    }

    // 2. Registrar Promoção
    const btnRegistrar = document.getElementById("btnRegistrar");
    if (btnRegistrar) {
        btnRegistrar.addEventListener("click", function() {
            const id = document.getElementById("inputPromoId").value;
            const titulo = document.getElementById("inputPromoTitulo").value;
            const categoria = document.getElementById("inputPromoCategoria").value;
            const preco = document.getElementById("inputPromoPreco").value;
            
            if (!id || !titulo || !categoria || !preco) {
                displayResponse("Erro", { message: "Preencha todos os campos!" });
                return;
            }
            registrarPromocao(id, titulo, categoria, preco);
        });
    }

    // 3. Votar em Promoção
    const btnVotar = document.getElementById("btnVotar");
    if (btnVotar) {
        btnVotar.addEventListener("click", function() {
            const promocao_id = document.getElementById("inputVotoPromoId").value;
            const voto = document.getElementById("selectVoto").value;
            
            if (!promocao_id) {
                displayResponse("Erro", { message: "Informe o ID da promoção!" });
                return;
            }
            votarPromocao(promocao_id, voto);
        });
    }

    // 4. Registrar Interesse
    const btnRegistrarInteresse = document.getElementById("btnRegistrarInteresse");
    if (btnRegistrarInteresse) {
        btnRegistrarInteresse.addEventListener("click", function() {
            const usuario_id = document.getElementById("inputUsuarioId").value;
            const categoria = document.getElementById("inputCategoria").value;
            
            if (!usuario_id || !categoria) {
                displayResponse("Erro", { message: "Preencha todos os campos!" });
                return;
            }
            registrarInteresse(usuario_id, categoria);
        });
    }

    // 5. Cancelar Interesse
    const btnCancelarInteresse = document.getElementById("btnCancelarInteresse");
    if (btnCancelarInteresse) {
        btnCancelarInteresse.addEventListener("click", function() {
            const usuario_id = document.getElementById("inputUsuarioId").value;
            const categoria = document.getElementById("inputCategoria").value;
            
            if (!usuario_id || !categoria) {
                displayResponse("Erro", { message: "Preencha todos os campos!" });
                return;
            }
            cancelarInteresse(usuario_id, categoria);
        });
    }
});
