"""
Keeps API tests deterministic whatever is in a developer's backend/.env.

The journey API's shared orchestrator picks its flight and weather providers from settings
(USE_MOCK_FLIGHTS, WEATHER_PROVIDER, LLM_PROVIDER). With live providers configured, results would depend on
real flights, real forecasts and API quotas, so every test starts with the demo providers.
Tests that need another provider still replace it with monkeypatch.
"""
import pytest

from app.api import journeys
from app.providers.flight.mock import MockFlightProvider
from app.providers.weather import MockWeatherProvider
from app.providers.flight.search import MockFlightSearch


@pytest.fixture(autouse=True)
def demo_providers_for_api(monkeypatch):
    monkeypatch.setattr(journeys.orchestrator.flight_agent, "provider", MockFlightProvider())
    monkeypatch.setattr(journeys.orchestrator.weather_agent, "provider", MockWeatherProvider())
    monkeypatch.setattr(journeys.orchestrator.alternative_agent, "provider", MockFlightSearch(journeys.orchestrator.alternative_agent.config))
    # A Gemini key in a developer's .env must not make API tests call the real LLM.
    monkeypatch.setattr(journeys.orchestrator.recovery_agent, "llm_provider", None)
