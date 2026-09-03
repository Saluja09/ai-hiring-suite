from dataclasses import asdict

from fastapi import APIRouter
from pydantic import BaseModel

from app.clients.people.base import get_provider
from app.config import get_settings
from app.services.jd import parse_search_params

router = APIRouter(prefix="/api")


class SearchRequest(BaseModel):
    jd: str
    limit: int = 10


@router.post("/search")
def search(body: SearchRequest):
    params = parse_search_params(body.jd)
    provider = get_provider(get_settings())
    results = provider.search(params, body.limit)
    return [asdict(r) for r in results]
