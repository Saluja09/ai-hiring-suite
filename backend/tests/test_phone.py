import pytest
from app.utils.phone import to_e164, is_e164


def test_bare_indian_number():
    assert to_e164("8837518407") == "+918837518407"


def test_already_e164():
    assert to_e164("+918837518407") == "+918837518407"


def test_strips_spaces_and_dashes():
    assert to_e164("88375-18407") == "+918837518407"


def test_invalid_raises():
    with pytest.raises(ValueError):
        to_e164("12")


def test_is_e164():
    assert is_e164("+918837518407") and not is_e164("8837518407")
