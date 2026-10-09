"""Scripted provider for tests: returns a fixed response, raises, or calls a function."""
from typing import Any, Callable, Dict, List, Union

Response = Union[Dict[str, Any], Exception, Callable[[str, str], Dict[str, Any]]]


class MockLLMProvider:
    name = "mock"

    def __init__(self, response: Response, model: str = "mock-llm"):
        self.response = response
        self.model = model
        self.calls: List[Dict[str, Any]] = []

    async def generate_json(self, system: str, user: str, schema: Dict[str, Any]) -> Dict[str, Any]:
        self.calls.append({"system": system, "user": user, "schema": schema})
        if isinstance(self.response, Exception):
            raise self.response
        if callable(self.response):
            return self.response(system, user)
        return self.response
