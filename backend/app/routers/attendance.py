from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlmodel import Session

from app.clients.hunar import HunarAPIError, HunarClient
from app.db import engine
from app.models import Call, Campaign, Candidate
from app.routers.calls import _public_base_url, get_hunar_client
from app.schemas import CallCreate, VoiceLanguage, VoicePersona
from app.services.attendance import build_attendance_agent
from app.utils.phone import to_e164

router = APIRouter(prefix="/api")


class RollcallRequest(BaseModel):
    location: str
    supervisor_phone: str
    worker_names: List[str]
    language: VoiceLanguage = VoiceLanguage.ENGLISH
    voice_persona: VoicePersona = VoicePersona.NEHA


@router.post("/attendance/rollcall")
async def create_rollcall(
    body: RollcallRequest,
    hunar: HunarClient = Depends(get_hunar_client),
):
    agent_create = build_attendance_agent(
        body.location,
        body.worker_names,
        body.language,
        body.voice_persona,
    )

    try:
        agent_response: Dict[str, Any] = await hunar.create_agent(agent_create)
    except HunarAPIError as err:
        raise HTTPException(status_code=err.status, detail=err.body)

    agent_id = agent_response.get("id") or agent_response.get("agent_id")
    if not agent_id:
        raise HTTPException(status_code=502, detail="Hunar agent response missing id")

    with Session(engine) as session:
        campaign = Campaign(
            name=f"Roll-call — {body.location}",
            kind="attendance",
            agent_id=agent_id,
            result_schema=agent_create.result_schema,
            lang=body.language.value,
            voice_persona=body.voice_persona.value,
        )
        session.add(campaign)
        session.commit()
        session.refresh(campaign)
        campaign_id = campaign.id

        e164 = to_e164(body.supervisor_phone)

        callback_config: Optional[Dict[str, Any]] = None
        base = _public_base_url()
        if base:
            callback_config = {
                "call_status_callback_url": f"{base}/webhooks/hunar",
                "call_result_callback_url": f"{base}/webhooks/hunar",
                "call_summary_callback_url": f"{base}/webhooks/hunar",
            }

        custom_data = {"location": body.location, "workers": ", ".join(body.worker_names)}

        call_payload = CallCreate(
            callee_name=f"{body.location} supervisor",
            mobile_number=e164,
            custom_data=custom_data,
            agent_id=agent_id,
            callback_config=callback_config,
        )

        try:
            call_response = await hunar.create_call(call_payload)
        except HunarAPIError as err:
            raise HTTPException(status_code=err.status, detail=err.body)

        call_id = call_response.get("id") or call_response.get("call_id")
        if not call_id:
            raise HTTPException(status_code=502, detail="Hunar call response missing id")

        candidate_name = f"{body.location} supervisor"
        candidate = Candidate(
            campaign_id=campaign_id,
            name=candidate_name,
            phone=e164,
            source="manual",
            custom_data=custom_data,
        )
        session.add(candidate)
        session.commit()
        session.refresh(candidate)
        candidate_id = candidate.id

        call_row = Call(
            id=call_id,
            campaign_id=campaign_id,
            candidate_id=candidate_id,
            status=call_response.get("status"),
            request_id=call_response.get("request_id"),
        )
        session.add(call_row)
        session.commit()

        call_result = {
            "id": call_id,
            "callee_name": call_response.get("callee_name") or candidate_name,
            "mobile_number": call_response.get("mobile_number", e164),
            "status": call_response.get("status"),
        }

    return {
        "campaign_id": campaign_id,
        "agent_id": agent_id,
        "call": call_result,
    }
