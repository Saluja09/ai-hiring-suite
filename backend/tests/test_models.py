from sqlmodel import Session, create_engine, SQLModel

from app.models import Campaign, Call, Candidate


def test_campaign_and_call_roundtrip():
    eng = create_engine("sqlite://")
    SQLModel.metadata.create_all(eng)
    with Session(eng) as s:
        c = Campaign(name="Riders", kind="hiring", jd_text="jd",
                     result_schema={"interested": "boolean"})
        s.add(c); s.commit(); s.refresh(c)
        call = Call(id="call-1", campaign_id=c.id, status="SCHEDULED")
        s.add(call); s.commit()
        assert c.id and call.campaign_id == c.id


def test_candidate_json_fields_roundtrip():
    eng = create_engine("sqlite://")
    SQLModel.metadata.create_all(eng)
    with Session(eng) as s:
        c = Campaign(name="Riders", kind="hiring")
        s.add(c); s.commit(); s.refresh(c)

        candidate = Candidate(
            campaign_id=c.id,
            name="Asha",
            phone="+919876543210",
            source="manual",
            custom_data={"city": "Pune", "experience_years": 3},
            meta={"tags": ["priority"]},
        )
        s.add(candidate); s.commit(); s.refresh(candidate)

        fetched = s.get(Candidate, candidate.id)
        assert fetched is not None
        assert fetched.custom_data == {"city": "Pune", "experience_years": 3}
        assert fetched.meta == {"tags": ["priority"]}
        assert fetched.campaign_id == c.id
