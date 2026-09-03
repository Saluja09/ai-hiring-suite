import base64, hashlib, hmac, time
from app.security.hmac import verify_signature


def _sig(key, ts, body):
    d = hmac.new(key.encode(), f"{ts}.{body.decode()}".encode(), hashlib.sha256).digest()
    return base64.b64encode(d).decode()


def test_valid_signature():
    body = b'{"call_id":"c1"}'
    ts = str(int(time.time()))
    assert verify_signature(body, _sig("K", ts, body), ts, ["K"])


def test_expired_timestamp():
    body = b"{}"
    ts = str(int(time.time()) - 400)
    assert not verify_signature(body, _sig("K", ts, body), ts, ["K"])


def test_wrong_key():
    body = b"{}"
    ts = str(int(time.time()))
    assert not verify_signature(body, _sig("OTHER", ts, body), ts, ["K"])


def test_multiple_digests_one_matches():
    body = b'{"call_id":"c2"}'
    ts = str(int(time.time()))
    correct = _sig("K2", ts, body)
    wrong = _sig("BOGUS", ts, body)
    header = f"{wrong}, {correct}"
    assert verify_signature(body, header, ts, ["K1", "K2"])


def test_non_integer_timestamp_returns_false():
    body = b"{}"
    sig = _sig("K", "not-a-number", body)
    assert not verify_signature(body, sig, "not-a-number", ["K"])
