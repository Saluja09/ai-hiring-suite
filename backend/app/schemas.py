"""Domain schemas mirroring the Hunar Voice API contract."""

from enum import Enum
from typing import Any, Dict, Optional

from pydantic import BaseModel, Field, field_validator


# ============================================================================
# Enums
# ============================================================================


class VoicePersona(str, Enum):
    """Voice persona enum matching Hunar API contract."""

    NEHA = "NEHA"
    ROY = "ROY"
    ZOE = "ZOE"
    SAM = "SAM"
    MIRA = "MIRA"
    EESHA = "EESHA"


class VoiceLanguage(str, Enum):
    """Voice language enum matching Hunar API contract."""

    ENGLISH = "ENGLISH"
    HINDI = "HINDI"
    TAMIL = "TAMIL"
    TELUGU = "TELUGU"
    KANNADA = "KANNADA"
    MARATHI = "MARATHI"
    MALAYALAM = "MALAYALAM"
    GUJARATI = "GUJARATI"
    BENGALI = "BENGALI"
    TURKISH = "TURKISH"
    ARABIC = "ARABIC"
    SPANISH = "SPANISH"


class CallStatus(str, Enum):
    """Call status enum matching Hunar API contract."""

    NOT_STARTED = "NOT_STARTED"
    SCHEDULED = "SCHEDULED"
    INITIATED = "INITIATED"
    RINGING = "RINGING"
    IN_PROGRESS = "IN_PROGRESS"
    COMPLETED = "COMPLETED"
    NOT_CONNECTED = "NOT_CONNECTED"
    CANCELLED = "CANCELLED"
    FAILED = "FAILED"


# ============================================================================
# Pydantic Models
# ============================================================================


class RecipientData(BaseModel):
    """Recipient data for call creation."""

    callee_name: str = Field(
        ..., description="Callee name", title="Callee Name"
    )
    mobile_number: str = Field(
        ..., description="Mobile number", title="Mobile Number"
    )
    custom_data: Dict[str, str] = Field(
        default_factory=dict, description="Custom data", title="Custom Data"
    )


class AgentCreate(BaseModel):
    """Agent creation schema matching Hunar API contract."""

    name: str = Field(
        ..., min_length=3, max_length=64, description="Agent name"
    )
    language: VoiceLanguage = Field(
        default=VoiceLanguage.ENGLISH, description="Language for the agent"
    )
    voice_persona: VoicePersona = Field(
        ..., description="Voice persona"
    )
    persona_name: Optional[str] = Field(
        default="NEHA",
        min_length=3,
        max_length=64,
        description="Persona name for the agent",
    )
    agent_prompt: str = Field(
        ..., min_length=3, description="Main agent prompt"
    )
    objective: str = Field(
        ..., min_length=3, description="Agent objective text"
    )
    introduction: str = Field(
        ..., min_length=3, description="Agent introduction text"
    )
    result_prompt: Optional[str] = Field(
        default=None,
        min_length=3,
        description="Prompt for result generation from the conversation.",
    )
    result_schema: Dict[str, Any] = Field(
        ...,
        description="Expected result JSON schema for result generation.",
    )

    @field_validator("result_schema")
    @classmethod
    def validate_result_schema(cls, v: Dict[str, Any]) -> Dict[str, Any]:
        """Validate that result_schema has at least 1 key."""
        if not v or len(v) < 1:
            raise ValueError("result_schema must have at least 1 key")
        return v


class CallCreate(BaseModel):
    """Call creation schema matching Hunar API contract."""

    callee_name: str = Field(
        ..., description="Callee name", title="Callee Name"
    )
    mobile_number: str = Field(
        ..., description="Mobile number", title="Mobile Number"
    )
    custom_data: Dict[str, str] = Field(
        default_factory=dict, description="Custom data", title="Custom Data"
    )
    agent_id: str = Field(..., description="Agent ID")
    callback_config: Optional[Dict[str, Any]] = Field(
        default=None, description="Callback config"
    )
    from_phone_number: Optional[str] = Field(
        default=None, description="From phone number"
    )
    request_id: Optional[str] = Field(
        default=None, max_length=64, description="Request tracking identifier"
    )


class BulkCallCreate(BaseModel):
    """Bulk call creation schema matching Hunar API contract."""

    agent_id: str = Field(..., description="Agent ID")
    data: list[RecipientData] = Field(
        ...,
        min_length=1,
        max_length=10000,
        description="Recipient data for the calls",
    )
    callback_config: Optional[Dict[str, Any]] = Field(
        default=None, description="Callback config"
    )
    from_phone_number: Optional[str] = Field(
        default=None, description="From phone number"
    )
    request_id: Optional[str] = Field(
        default=None, max_length=64, description="Request tracking identifier"
    )
    remove_invalid_rows: bool = Field(
        default=True, description="Whether to remove invalid rows"
    )
    remove_duplicate_phone_numbers: bool = Field(
        default=True, description="Whether to remove duplicate phone numbers"
    )
