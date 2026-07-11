"""
Password + token hashing utilities for the public-API developer accounts.

Uses stdlib PBKDF2-HMAC-SHA256 (no new dependency, no bcrypt build/version footguns,
no scrypt memory spikes on Render). The stored format embeds the algorithm and
iteration count so the cost can be raised or the scheme migrated later:

    pbkdf2$<iterations>$<salt_hex>$<hash_hex>

API keys and session tokens are high-entropy random strings, so they are stored as a
plain SHA-256 (fast, indexable equality lookup) — a slow KDF is only for low-entropy
human passwords.
"""

import hashlib
import hmac
import os

_ITERATIONS = 600_000


def hash_password(password: str) -> str:
    """Hash a plaintext password for storage."""
    salt = os.urandom(16)
    dk = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, _ITERATIONS)
    return f"pbkdf2${_ITERATIONS}${salt.hex()}${dk.hex()}"


def verify_password(password: str, stored: str) -> bool:
    """Constant-time verify a plaintext password against a stored hash."""
    try:
        scheme, iters, salt_hex, dk_hex = stored.split("$")
        if scheme != "pbkdf2":
            return False
        dk = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), bytes.fromhex(salt_hex), int(iters))
        return hmac.compare_digest(dk.hex(), dk_hex)
    except (ValueError, AttributeError):
        return False


def hash_token(token: str) -> str:
    """SHA-256 hex of a high-entropy token (API key or session token) for storage/lookup."""
    return hashlib.sha256(token.encode("utf-8")).hexdigest()
