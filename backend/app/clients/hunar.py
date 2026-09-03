"""Async httpx wrapper over the Hunar Voice API."""

from typing import Any, Dict, List, Union

import httpx
from pydantic import BaseModel

from app.schemas import AgentCreate, BulkCallCreate, CallCreate


class HunarAPIError(Exception):
    """Raised when the Hunar API responds with a non-2xx status."""

    def __init__(self, status: int, body: Union[str, dict]) -> None:
        self.status = status
        self.body = body
        super().__init__(f"Hunar API error {status}: {body}")


class HunarClient:
    """Thin async client for the Hunar Voice API."""

    def __init__(self, api_key: str, base_url: str) -> None:
        self.api_key = api_key
        self.base_url = base_url.rstrip("/")

    def _headers(self) -> Dict[str, str]:
        return {
            "X-API-Key": self.api_key,
            "Content-Type": "application/json",
        }

    async def _request(
        self, method: str, path: str, json: Any = None
    ) -> Any:
        url = f"{self.base_url}{path}"
        async with httpx.AsyncClient() as client:
            response = await client.request(
                method, url, json=json, headers=self._headers()
            )
        if response.is_error:
            try:
                body: Union[str, dict] = response.json()
            except ValueError:
                body = response.text
            raise HunarAPIError(response.status_code, body)
        return response.json()

    @staticmethod
    def _dump(model: BaseModel) -> Dict[str, Any]:
        return model.model_dump(exclude_none=True, mode="json")

    async def create_agent(self, agent: AgentCreate) -> dict:
        return await self._request("POST", "/agents/", json=self._dump(agent))

    async def create_call(self, call: CallCreate) -> dict:
        return await self._request("POST", "/calls/", json=self._dump(call))

    async def create_bulk_calls(self, payload: BulkCallCreate) -> dict:
        return await self._request(
            "POST", "/calls/bulk/", json=self._dump(payload)
        )

    async def get_call(self, call_id: str) -> dict:
        return await self._request("GET", f"/calls/{call_id}/")

    async def list_numbers(self) -> List[dict]:
        result = await self._request("GET", "/numbers/")
        if isinstance(result, list):
            return result
        if isinstance(result, dict):
            for key in ("data", "items", "results"):
                if key in result and isinstance(result[key], list):
                    return result[key]
        return result
