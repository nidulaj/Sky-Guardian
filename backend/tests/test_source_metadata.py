import pytest

from app.orchestrator.graph import SupervisorOrchestrator
from app.orchestrator.state import JourneyState


class Step:
    def __init__(self, **updates):
        self.updates = updates

    async def execute(self, state):
        for field, value in self.updates.items():
            setattr(state, field, value)


@pytest.mark.asyncio
@pytest.mark.parametrize("flight_mode,weather_mock,expected_demo", [
    ("live", False, False), ("timetable", False, False),
    ("demo", False, True), ("live", True, True),
])
async def test_sources_and_demo_flag_follow_actual_results(flight_mode, weather_mock, expected_demo):
    graph = SupervisorOrchestrator()
    flight_source = "MockFlightProvider" if flight_mode == "demo" else "AeroDataBox (live status)"
    weather_source = "MockWeatherProvider" if weather_mock else "Open-Meteo"
    flights = [{"source": flight_source, "data_mode": flight_mode, "status": "ON_TIME"}] * 2
    weather = [{"source": weather_source, "is_mock": weather_mock, "status": "available"}] * 2
    graph.flight_agent = Step(flight_results=flights)
    graph.weather_agent = Step(weather_results=weather)
    graph.connection_agent = Step(connection_results=[])
    graph.risk_agent = Step(risk_analysis={"score": 0})
    graph.recovery_agent = Step()
    result = await graph.run_workflow(JourneyState())
    assert result.is_demo_data is expected_demo
    assert result.sources == [
        {"name": flight_source, "type": "Aviation Data", "verified": flight_mode != "demo"},
        {"name": weather_source, "type": "Weather Forecast", "verified": not weather_mock},
    ]


@pytest.mark.asyncio
async def test_unavailable_sources_are_not_verified_or_demo_data():
    graph = SupervisorOrchestrator()
    graph.flight_agent = Step(flight_results=[{"source": "AeroDataBox", "data_mode": "none", "status": "UNKNOWN"}])
    graph.weather_agent = Step(weather_results=[{"source": "Open-Meteo", "is_mock": False, "status": "unavailable"}])
    graph.connection_agent = Step(connection_results=[])
    graph.risk_agent = Step(risk_analysis={"score": 0})
    graph.recovery_agent = Step()
    result = await graph.run_workflow(JourneyState())
    assert result.is_demo_data is False
    assert all(not source["verified"] for source in result.sources)
