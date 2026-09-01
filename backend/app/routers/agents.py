from typing import Any, Dict, Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session

from app.clients.hunar import HunarAPIError, HunarClient
from app.db import engine
from app.models import Campaign
from app.routers.calls import get_hunar_client
from app.schemas import AgentCreate

router = APIRouter(prefix="/api")


class AgentCreateRequest(AgentCreate):
    campaign_name: Optional[str] = None
    jd_text: Optional[str] = None
    kind: str = "hiring"


@router.post("/agents")
async def create_agent(
    body: AgentCreateRequest,
    hunar: HunarClient = Depends(get_hunar_client),
):
    agent_create = AgentCreate(
        name=body.name,
        language=body.language,
        voice_persona=body.voice_persona,
        persona_name=body.persona_name,
        agent_prompt=body.agent_prompt,
        objective=body.objective,
        introduction=body.introduction,
        result_prompt=body.result_prompt,
        result_schema=body.result_schema,
    )

    try:
        response: Dict[str, Any] = await hunar.create_agent(agent_create)
    except HunarAPIError as err:
        raise HTTPException(status_code=err.status, detail=err.body)

    agent_id = response.get("id") or response.get("agent_id")

    with Session(engine) as session:
        campaign = Campaign(
            name=body.campaign_name or body.name,
            kind=body.kind,
            jd_text=body.jd_text,
            agent_id=agent_id,
            result_schema=body.result_schema,
            lang=body.language.value if hasattr(body.language, "value") else body.language,
            voice_persona=body.voice_persona.value if hasattr(body.voice_persona, "value") else body.voice_persona,
        )
        session.add(campaign)
        session.commit()
        session.refresh(campaign)

    return {"campaign_id": campaign.id, "agent_id": agent_id}
