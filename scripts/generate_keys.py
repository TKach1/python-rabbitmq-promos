from pathlib import Path

from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import rsa


REPO_ROOT = Path(__file__).resolve().parents[1]
PUBLIC_KEYS_DIR = REPO_ROOT / "core" / "security" / "keys"
COMPONENTS = [
    "gateway",
    "ms-promocao",
    "ms-notificacao",
    "ms-ranking",
]


def private_key_file(component: str) -> Path:
    if component == "gateway":
        return REPO_ROOT / "gateway" / "keys" / "private.pem"
    return REPO_ROOT / "services" / component / "keys" / "private.pem"


def generate_pair(component: str) -> None:
    private_key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    public_key = private_key.public_key()

    private_bytes = private_key.private_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PrivateFormat.PKCS8,
        encryption_algorithm=serialization.NoEncryption(),
    )
    public_bytes = public_key.public_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PublicFormat.SubjectPublicKeyInfo,
    )

    priv_path = private_key_file(component)
    pub_path = PUBLIC_KEYS_DIR / f"{component}_public.pem"

    priv_path.parent.mkdir(parents=True, exist_ok=True)
    pub_path.parent.mkdir(parents=True, exist_ok=True)

    priv_path.write_bytes(private_bytes)
    pub_path.write_bytes(public_bytes)

    print(f"Generated keys for {component}")

def remove_old_keys(component: str) -> None:
    priv_path = private_key_file(component)
    pub_path = PUBLIC_KEYS_DIR / f"{component}_public.pem"

    if priv_path.exists():
        priv_path.unlink()
    if pub_path.exists():
        pub_path.unlink()

if __name__ == "__main__":
    for comp in COMPONENTS:
        remove_old_keys(comp)
        generate_pair(comp)
