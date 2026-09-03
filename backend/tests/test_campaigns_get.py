from fastapi.testclient import TestClient

from app.main import app


def _seed_campaign_with_calls():
    from sqlmodel import Session

    from app.db import engine
    from app.models import Call, Campaign, Candidate

    with Session(engine) as s:
        campaign = Campaign(
            name="Backend Engineer",
            kind="hiring",
            jd_text="We need a backend engineer.",
            agent_id="agent-1",
            result_schema={"years_experience": "number", "interested": "boolean"},
            lang="ENGLISH",
            voice_persona="NEHA",
        )
        s.add(campaign)
        s.commit()
        s.refresh(campaign)

        candidate_a = Candidate(
            campaign_id=campaign.id,
            name="Asha",
            phone="+918837518407",
            source="manual",
        )
        candidate_b = Candidate(
            campaign_id=campaign.id,
            name="Ravi",
            phone="+918837518408",
            source="manual",
        )
        s.add(candidate_a)
        s.add(candidate_b)
        s.commit()
        s.refresh(candidate_a)
        s.refresh(candidate_b)

        call_a = Call(
            id="call-a",
            campaign_id=campaign.id,
            candidate_id=candidate_a.id,
            status="COMPLETED",
            lifecycle_status="ENDED",
            engagement_status="ANSWERED",
            answered_by="HUMAN",
            duration_seconds=42.0,
            recording_url="https://example.com/rec-a.mp3",
            result={"years_experience": 5, "interested": True},
        )
        call_b = Call(
            id="call-b",
            campaign_id=campaign.id,
            candidate_id=candidate_b.id,
            status="SCHEDULED",
        )
        s.add(call_a)
        s.add(call_b)
        s.commit()

        return campaign.id


def test_get_campaign_returns_campaign_and_calls():
    client = TestClient(app)
    cid = _seed_campaign_with_calls()

    r = client.get(f"/api/campaigns/{cid}")
    assert r.status_code == 200

    body = r.json()
    campaign = body["campaign"]
    assert campaign["id"] == cid
    assert campaign["name"] == "Backend Engineer"
    assert campaign["kind"] == "hiring"
    assert campaign["agent_id"] == "agent-1"
    assert campaign["result_schema"] == {
        "years_experience": "number",
        "interested": "boolean",
    }
    assert campaign["lang"] == "ENGLISH"
    assert campaign["voice_persona"] == "NEHA"

    calls = body["calls"]
    assert len(calls) == 2

    by_id = {c["id"]: c for c in calls}
    assert by_id["call-a"]["callee_name"] == "Asha"
    assert by_id["call-a"]["status"] == "COMPLETED"
    assert by_id["call-a"]["result"] == {"years_experience": 5, "interested": True}
    assert by_id["call-a"]["campaign_id"] == cid
    assert by_id["call-a"]["mobile_number"] == "+918837518407"

    assert by_id["call-b"]["callee_name"] == "Ravi"
    assert by_id["call-b"]["status"] == "SCHEDULED"
    assert by_id["call-b"]["result"] is None


def test_get_campaign_404_for_missing_id():
    client = TestClient(app)
    r = client.get("/api/campaigns/999999")
    assert r.status_code == 404
