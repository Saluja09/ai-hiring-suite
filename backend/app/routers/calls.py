from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlmodel import Session

from app.clients.hunar import HunarAPIError, HunarClient
from app.config import get_settings
from app.db import engine
from app.models import Call, Campaign, Candidate
from app.schemas import BulkCallCreate, RecipientData
from app.utils.phone import to_e164

router = APIRouter(prefix="/api")


def get_hunar_client() -> HunarClient:
    settings = get_settings()
    return HunarClient(settings.hunar_api_key, settings.hunar_base_url)


def _public_base_url() -> str:
    settings = get_settings()
    return settings.public_base_url.rstrip("/") if settings.public_base_url else ""


class CallRequest(BaseModel):
    name: str
    phone: str
    custom_data: Dict[str, Any] = Field(default_factory=dict)


def _extract_created_calls(response: Any) -> List[dict]:
    if isinstance(response, list):
        return response
    if isinstance(response, dict):
        for key in ("data", "results", "calls"):
            value = response.get(key)
            if isinstance(value, list):
                return value
    return []


@router.post("/campaigns/{campaign_id}/calls")
async def create_calls(
    campaign_id: int,
    calls: List[CallRequest],
    hunar: HunarClient = Depends(get_hunar_client),
):
    with Session(engine) as session:
        campaign = session.get(Campaign, campaign_id)
        if campaign is None or not campaign.agent_id:
            raise HTTPException(status_code=404, detail="Campaign not found or missing agent_id")

        recipients: List[RecipientData] = []
        normalized: List[tuple] = []
        for call in calls:
            e164 = to_e164(call.phone)
            stringified = {k: str(v) for k, v in call.custom_data.items()}
            recipients.append(
                RecipientData(
                    callee_name=call.name,
                    mobile_number=e164,
                    custom_data=stringified,
                )
            )
            normalized.append((call.name, e164, stringified))

        callback_config: Optional[Dict[str, Any]] = None
        base = _public_base_url()
        if base:
            callback_config = {
                "call_status_callback_url": f"{base}/webhooks/hunar",
                "call_result_callback_url": f"{base}/webhooks/hunar",
                "call_summary_callback_url": f"{base}/webhooks/hunar",
            }

        payload = BulkCallCreate(
            agent_id=campaign.agent_id,
            data=recipients,
            callback_config=callback_config,
        )

        try:
            response = await hunar.create_bulk_calls(payload)
        except HunarAPIError as err:
            raise HTTPException(status_code=err.status, detail=err.body)

        created_calls = _extract_created_calls(response)

        result: List[dict] = []
        for idx, created in enumerate(created_calls):
            call_id = created.get("id") or created.get("call_id")
            status = created.get("status")
            name, phone, custom_data = normalized[idx] if idx < len(normalized) else (None, None, {})

            if not call_id:
                result.append(
                    {
                        "callee_name": created.get("callee_name") or name,
                        "mobile_number": created.get("mobile_number", phone),
                        "status": status,
                        "error": "missing call id",
                    }
                )
                continue

            candidate = Candidate(
                campaign_id=campaign_id,
                name=name or "",
                phone=phone or "",
                source="manual",
                custom_data=custom_data,
            )
            session.add(candidate)
            session.commit()
            session.refresh(candidate)

            call_row = Call(
                id=call_id,
                campaign_id=campaign_id,
                candidate_id=candidate.id,
                status=status,
                request_id=created.get("request_id"),
            )
            session.add(call_row)
            result.append(
                {
                    "id": call_id,
                    "callee_name": created.get("callee_name") or name,
                    "mobile_number": created.get("mobile_number", phone),
                    "status": status,
                }
            )

        session.commit()

    return result
