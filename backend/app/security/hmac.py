"""HMAC-SHA256 webhook signature verification (Hunar-style)."""

import base64
import hashlib
import hmac
import time


def verify_signature(
    raw_body: bytes,
    signature_header: str,
    timestamp_header: str,
    api_keys: list[str],
    tolerance_s: int = 300,
) -> bool:
    """Verify a webhook HMAC-SHA256 signature.

    The signed message is f"{timestamp}.{raw_body}". The signature header may
    contain multiple comma-separated base64-encoded digests (one per active
    key). Returns True if any (api_key, provided-digest) pair matches, using
    a constant-time comparison. Never raises; any parse error yields False.
    """
    try:
        if not api_keys or not signature_header or not timestamp_header:
            return False

        timestamp = int(timestamp_header)
        if abs(int(time.time()) - timestamp) > tolerance_s:
            return False

        message = f"{timestamp_header}.{raw_body.decode()}".encode()

        provided_digests = [
            part.strip() for part in signature_header.split(",") if part.strip()
        ]
        if not provided_digests:
            return False

        for api_key in api_keys:
            expected = base64.b64encode(
                hmac.new(api_key.encode(), message, hashlib.sha256).digest()
            ).decode()
            for provided in provided_digests:
                if hmac.compare_digest(expected, provided):
                    return True

        return False
    except Exception:
        return False
