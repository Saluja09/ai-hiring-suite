from typing import Any, Dict, List, Optional

from fastapi import APIRouter, HTTPException
from sqlmodel import Session, select

from app.db import engine
from app.models import Call, Campaign, Candidate

router = APIRouter(prefix="/api")


@router.get("/campaigns/{campaign_id}")
def get_campaign(campaign_id: int) -> Dict[str, Any]:
    with Session(engine) as session:
        campaign = session.get(Campaign, campaign_id)
        if campaign is None:
            raise HTTPException(status_code=404, detail="Campaign not found")

        campaign_data: Dict[str, Any] = {
            "id": campaign.id,
            "name": campaign.name,
            "kind": campaign.kind,
            "agent_id": campaign.agent_id,
            "result_schema": campaign.result_schema,
            "lang": campaign.lang,
            "voice_persona": campaign.voice_persona,
            "created_at": campaign.created_at.isoformat()
            if campaign.created_at
            else None,
        }

        calls = session.exec(
            select(Call)
            .where(Call.campaign_id == campaign_id)
            .order_by(Call.updated_at, Call.id)
        ).all()

        candidate_ids = {c.candidate_id for c in calls if c.candidate_id is not None}
        candidates_by_id: Dict[int, Candidate] = {}
        if candidate_ids:
            candidate_rows = session.exec(
                select(Candidate).where(Candidate.id.in_(candidate_ids))
            ).all()
            candidates_by_id = {c.id: c for c in candidate_rows}

        call_rows: List[Dict[str, Any]] = []
        for call in calls:
            candidate: Optional[Candidate] = (
                candidates_by_id.get(call.candidate_id)
                if call.candidate_id is not None
                else None
            )
            call_rows.append(
                {
                    "id": call.id,
                    "callee_name": candidate.name if candidate else None,
                    "mobile_number": candidate.phone if candidate else None,
                    "status": call.status,
                    "lifecycle_status": call.lifecycle_status,
                    "engagement_status": call.engagement_status,
                    "answered_by": call.answered_by,
                    "duration_seconds": call.duration_seconds,
                    "recording_url": call.recording_url,
                    "result": call.result,
                    "campaign_id": call.campaign_id,
                    "candidate_id": call.candidate_id,
                }
            )

    return {"campaign": campaign_data, "calls": call_rows}
