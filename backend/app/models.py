from datetime import datetime
from typing import Optional

from sqlalchemy import Column, JSON
from sqlmodel import Field, SQLModel


class Campaign(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    name: str
    kind: str  # hiring|reachout|attendance
    jd_text: Optional[str] = None
    agent_id: Optional[str] = None
    result_schema: Optional[dict] = Field(default=None, sa_column=Column(JSON))
    lang: Optional[str] = None
    voice_persona: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)


class Candidate(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    campaign_id: int = Field(foreign_key="campaign.id")
    name: str
    phone: str
    source: Optional[str] = None  # manual|pdl|mock
    custom_data: Optional[dict] = Field(default=None, sa_column=Column(JSON))
    meta: Optional[dict] = Field(default=None, sa_column=Column(JSON))


class Call(SQLModel, table=True):
    id: str = Field(primary_key=True)  # Hunar call uuid
    campaign_id: int = Field(foreign_key="campaign.id")
    candidate_id: Optional[int] = Field(default=None, foreign_key="candidate.id")
    request_id: Optional[str] = None
    status: Optional[str] = None
    lifecycle_status: Optional[str] = None
    engagement_status: Optional[str] = None
    answered_by: Optional[str] = None
    duration_seconds: Optional[float] = None
    recording_url: Optional[str] = None
    result: Optional[dict] = Field(default=None, sa_column=Column(JSON))
    updated_at: Optional[datetime] = None


class WebhookEvent(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    call_id: Optional[str] = None
    event_type: Optional[str] = None
    raw_payload: Optional[dict] = Field(default=None, sa_column=Column(JSON))
    signature_valid: Optional[bool] = None
    received_at: datetime = Field(default_factory=datetime.utcnow)
