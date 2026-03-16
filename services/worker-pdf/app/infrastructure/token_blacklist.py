"""Redis-backed refresh token store for revocation (token blacklist).

Flow
----
1. On /login or /register  → call ``store_refresh_token(jti, user_id, ttl)``
2. On /refresh             → call ``is_refresh_token_valid(jti)``; reject if False
3. On /logout              → call ``revoke_refresh_token(jti)`` to invalidate immediately
4. On password change      → call ``revoke_all_user_tokens(user_id)`` (future use)

The ``jti`` (JWT ID) claim must be embedded in every refresh token.
"""

from __future__ import annotations

import redis.asyncio as aioredis

from app.infrastructure.config import settings

# ── Key helpers ───────────────────────────────────────────────────────────

def _token_key(jti: str) -> str:
    return f"refresh_token:{jti}"


def _user_tokens_key(user_id: str) -> str:
    return f"user_tokens:{user_id}"


# ── Public API ────────────────────────────────────────────────────────────

async def store_refresh_token(jti: str, user_id: str, ttl_seconds: int) -> None:
    """Persist a refresh token JTI in Redis with the given TTL.

    Parameters
    ----------
    jti:
        The unique JWT ID claim from the refresh token.
    user_id:
        The UUID string of the token owner (stored as the value).
    ttl_seconds:
        Seconds until the token expires; matches the JWT ``exp`` delta.
    """
    r = aioredis.from_url(settings.REDIS_URL, decode_responses=True)
    async with r:
        await r.setex(_token_key(jti), ttl_seconds, user_id)


async def is_refresh_token_valid(jti: str) -> bool:
    """Return True only if the JTI exists in Redis (i.e., not revoked).

    A missing key means the token was either never issued through this
    system or has already been revoked / expired.
    """
    r = aioredis.from_url(settings.REDIS_URL, decode_responses=True)
    async with r:
        return await r.exists(_token_key(jti)) == 1


async def revoke_refresh_token(jti: str) -> None:
    """Immediately invalidate a single refresh token by deleting its key."""
    r = aioredis.from_url(settings.REDIS_URL, decode_responses=True)
    async with r:
        await r.delete(_token_key(jti))
