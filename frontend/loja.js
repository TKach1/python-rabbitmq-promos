const API_URL = "http://localhost:8000";

// ====== ATENÇÃO ======
// Substitua o valor abaixo pela sua chave privada PKCS8 PEM da loja.
// Este exemplo contém um placeholder. Não deixe chaves privadas em produção.
const LOJA_PRIVATE_KEY_PEM = `-----BEGIN PRIVATE KEY-----
MIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQDJVgCINOyJmX3a
q1TctLr+6PY/aBK97k9zIQInTVB3KxZynJDFBV3viJbmc8AM9s1tHpDkcET3kck8
/DnJT1p3GXkXZSfqAib87ausF+uVb7DOXS/Qv302PmTbxfs5VifZMYk0E5aJDHWe
E2VfIbjak6D00O09hUL5wgrD7n8T32II2MWLMGTUUpFoj8kdSVNppXXJtt+xFJQG
pimzjMxS3TugZOKkNiQ58wFInGbX9LsXI+W3Z8Wu4eaZm9C15j86230eAm9FtyLk
sIEGVFOUg8zc//6aWdklAnUn6yXWoPmNLr5+CxS01sEf0dl4kSv86HW0myAEK/6B
j8z/gJVFAgMBAAECggEACxW7V0R0rnm/MmIi/LjNn9nDLwgDmiXsBWZwmCnbT4hV
hs9kcBiEzLqcNklyrjQLaOHZL96XiXrjFcK8Sr9d93c1UcqtuSZPr7bFMCcr/xEE
bsQ2LPvSAMHMK0Z597Ts4jomN/IJJHgFZMPkHan9Y7ljj/8NxMiYwKgEkDeKExWt
FSZ8PpmzqwB8OPrnGVLKiULr5d8iaf4PEKXOAFAPDZtaOt2cFQpx8rnxOCIJrgOY
82bU/oBfaSCYmGKrxwFjOisGmOwxKrVKeuXh8jZG3OKK4p1p+yqas7d5SwMm7QaK
noqSS3uhePYGP4QR3LCwf9pFVhjg+XJChizL0m1/iQKBgQD4z+kdMgpjf99x3TAf
7N/hALfGZp33tgYtufyMoKrIrA4+ZkXlBmYdgKE6faLt7AzkY+thZp8JEOvPyfyi
E8eVI0DNtm+Hm5vftlQswiOy55J7yIJOingiyIVXhhmpFEqU/pdNWyqMq8TZWbVB
eH7sqOX/eOBmJB9vUHK9z8pbWQKBgQDPJvs6zDH+g1Fsqv12aM5YfgDP6ffXdVsO
LzposAwdLmplT48TR9Iw5AC0N31hAhfEUxDB8jgdTVh2D4uWvNsNPSLDam0+H1EC
o9fqMQ2yqtImseMDXh02RsQZW8Ky7vdmcvGO5TFPN4YRmFzhu5owY/i6fsKvWgvR
BNq5AOYHzQKBgGb+4dfVFBnWIC/pSPeePZrNikWVywR0lCAvokywYaIKHydTfNFu
kazax2MICP8GPNv6RMCgE2tUVtlAGtUY7QBehH/jak2va5nyxut0PgTb+XZGLTLH
/S0g5pmxiEPGg40jyowaFgX/QNBcYzzD3X6n9/WGGxYNE/onSigqsPCZAoGAJAb9
jp5Q25jvIl0is+NKb+2KKp7gceKBMZhZKjfkA3c9Hd2WXp4RGlutG6rC7Yo1o/lm
YrTDuaToC7BscIzr9AN79kyeLz23EyR3us1JOpem8P/jIYTOw8/O7zIcTI5vDKxV
Aqstxj872/eJv+Cm0l+wtI6zQVgB0hpsB9z2JMkCgYEAvCS7E5YA0hQFsogDyOoK
K+7Kb46VeHYI49E90yw6rDUYRw9EtBBzNdH1FC+STJgb3ofLEQtrVNBFpzPFP/oZ
0I+1mVFBNOK2gCDbRb74lkLRKZs45UHvJ2J9EVq74wHB2nOXGbDitaLJ3Uw1Maot
m7GvBU8QzsOF2+d4lKCvjZE=
-----END PRIVATE KEY-----
`;

function pemToArrayBuffer(pem) {
    const b64 = pem.replace(/-----[^-]+-----/g, '').replace(/\s+/g, '');
    const binary = atob(b64);
    const len = binary.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) bytes[i] = binary.charCodeAt(i);
    return bytes.buffer;
}

function arrayBufferToBase64(buffer){
    const bytes = new Uint8Array(buffer);
    const chunkSize = 0x8000;
    let binary = '';
    for (let i = 0; i < bytes.length; i += chunkSize) {
        binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunkSize));
    }
    return btoa(binary);
}

async function importPrivateKeyFromPem(pem){
    const keyBuf = pemToArrayBuffer(pem);
    return await crypto.subtle.importKey(
        'pkcs8',
        keyBuf,
        { name: 'RSA-PSS', hash: 'SHA-256' },
        false,
        ['sign']
    );
}

async function signPayloadAsBundle(payloadObj){
    const encoder = new TextEncoder();
    const plaintext = encoder.encode(JSON.stringify(payloadObj));
    const key = await importPrivateKeyFromPem(LOJA_PRIVATE_KEY_PEM);
    const signature = await crypto.subtle.sign({ name: 'RSA-PSS', saltLength: 32 }, key, plaintext);
    const payloadB64 = arrayBufferToBase64(plaintext);
    const sigB64 = arrayBufferToBase64(signature);
    const signedBundle = JSON.stringify({ payload: payloadB64, signature: sigB64 });
    return btoa(signedBundle);
}

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

async function registrarPromocaoLoja(){
    const id = document.getElementById('inputPromoIdLoja').value.trim();
    const titulo = document.getElementById('inputPromoTituloLoja').value.trim();
    const categoria = document.getElementById('inputPromoCategoriaLoja').value.trim();
    const preco = document.getElementById('inputPromoPrecoLoja').value;
    if(!id||!titulo||!categoria||!preco){ pushNotification('Preencha todos os campos da promoção'); return; }

    const payloadObj = { id, titulo, categoria, preco: parseFloat(preco)};

    try{
        // Assina o payload localmente e envia o bundle assinado para o gateway
        const signed = await signPayloadAsBundle(payloadObj);
        await fetch(`${API_URL}/registrar_promocao`,{
            method:'POST',headers:{'Content-Type':'application/json'},
            body: JSON.stringify({ signed })
        });
        pushNotification('Promoção cadastrada com sucesso (assinada)');
    }catch(e){ pushNotification('Erro ao enviar promoção assinada para o gateway'); }
}

document.addEventListener('DOMContentLoaded', ()=>{
    const btn = document.getElementById('btnRegistrarLoja');
    if(btn) btn.addEventListener('click', registrarPromocaoLoja);
});
