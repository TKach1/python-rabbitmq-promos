import base64
import json
import uuid
from datetime import datetime, timezone
from pathlib import Path

from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import padding


REPO_ROOT = Path(__file__).resolve().parents[2]
PUBLIC_KEYS_DIR = REPO_ROOT / "core" / "security" / "keys"


def private_key_path(component: str) -> Path:
    if component == "gateway":
        return REPO_ROOT / "gateway" / "keys" / "private.pem"
    return REPO_ROOT / "services" / component / "keys" / "private.pem"


def public_key_path(component: str) -> Path:
    return PUBLIC_KEYS_DIR / f"{component}_public.pem"


def encrypt_for_target(payload: dict, source_component: str) -> str:
    priv_path = private_key_path(source_component)
    if not priv_path.exists():
        raise FileNotFoundError(f"Private key not found: {priv_path}")

    private_key = serialization.load_pem_private_key(priv_path.read_bytes(), password=None)
    plaintext = json.dumps(payload, ensure_ascii=True).encode("utf-8")

    signature = private_key.sign(
        plaintext,
        padding=padding.PSS(
            mgf=padding.MGF1(algorithm=hashes.SHA256()),
            salt_length=padding.PSS.MAX_LENGTH,
        ),
        algorithm=hashes.SHA256(),
    )

    signed_bundle = json.dumps({
        "payload": base64.b64encode(plaintext).decode("utf-8"),
        "signature": base64.b64encode(signature).decode("utf-8"),
    }).encode("utf-8")

    return base64.b64encode(signed_bundle).decode("utf-8")


def decrypt_for_component(encrypted_payload_b64: str, sender_component: str) -> dict:
    pub_path = public_key_path(sender_component)
    if not pub_path.exists():
        raise FileNotFoundError(f"Public key not found: {pub_path}")

    public_key = serialization.load_pem_public_key(pub_path.read_bytes())

    signed_bundle = json.loads(base64.b64decode(encrypted_payload_b64.encode("utf-8")))
    plaintext = base64.b64decode(signed_bundle["payload"])
    signature = base64.b64decode(signed_bundle["signature"])

    public_key.verify(
        signature=signature,
        data=plaintext,
        padding=padding.PSS(
            mgf=padding.MGF1(algorithm=hashes.SHA256()),
            salt_length=padding.PSS.MAX_LENGTH,
        ),
        algorithm=hashes.SHA256(),
    )

    return json.loads(plaintext.decode("utf-8"))


def build_envelope(
    event_type: str,
    origin: str,
    encrypted_payload: str,
    correlation_id: str | None = None,
) -> dict:
    return {
        "message_id": str(uuid.uuid4()),
        "correlation_id": correlation_id or str(uuid.uuid4()),
        "event_type": event_type,
        "event_version": "1.0",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "origin": origin,
        "encrypted_payload": encrypted_payload,
    }
