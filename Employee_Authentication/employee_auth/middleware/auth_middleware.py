"""
Request metadata extraction helpers.
Used by auth endpoints and audit logging.
"""

from fastapi import Request


def get_client_ip(request: Request) -> str:
    """
    Extract the real client IP address.
    Checks X-Forwarded-For first (for reverse proxy / nginx),
    then falls back to request.client.host.
    """
    forwarded_for = request.headers.get("X-Forwarded-For")
    if forwarded_for:
        # X-Forwarded-For can contain comma-separated list; first is the client
        return forwarded_for.split(",")[0].strip()
    if request.client:
        return request.client.host
    return "unknown"


def get_user_agent(request: Request) -> str:
    """Extract the User-Agent header from the request."""
    return request.headers.get("User-Agent", "unknown")[:255]
