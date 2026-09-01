import re


def to_e164(raw: str, default_cc: str = "91") -> str:
    """
    Normalize a phone number to E.164 format.

    Args:
        raw: Raw phone number string (may contain spaces, dashes, parens, +)
        default_cc: Default country code (default: "91" for India)

    Returns:
        Normalized phone number in E.164 format (e.g., "+918837518407")

    Raises:
        ValueError: If the phone number is invalid
    """
    # Strip all non-digit and non-plus characters
    stripped = re.sub(r'[^\d+]', '', raw)

    # Case 1: Already E.164 format (starts with +)
    if stripped.startswith('+'):
        # Validate: 8-15 digits after +
        digits_after_plus = stripped[1:]
        if len(digits_after_plus) < 8 or len(digits_after_plus) > 15:
            raise ValueError(f"Invalid E.164 format: {raw}")
        return stripped

    # Case 2: Exactly 10 digits - add default country code
    if len(stripped) == 10:
        return f"+{default_cc}{stripped}"

    # Case 3: 11-12 digits starting with country code
    if 11 <= len(stripped) <= 12:
        if stripped.startswith(default_cc):
            return f"+{stripped}"

    # Invalid
    raise ValueError(f"Invalid phone number: {raw}")


def is_e164(s: str) -> bool:
    """
    Check if a string is a valid E.164 formatted phone number.

    Args:
        s: String to validate

    Returns:
        True if valid E.164 format, False otherwise
    """
    pattern = r'^\+[1-9]\d{7,14}$'
    return bool(re.match(pattern, s))
