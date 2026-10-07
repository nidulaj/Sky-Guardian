import unittest
import asyncio
import sys
import os

# Add backend directory to sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from app.orchestrator.state import JourneyState
from app.agents.flight_agent import FlightAgent
from app.agents.connection_agent import ConnectionAgent
from app.agents.weather_agent import WeatherAgent
from app.agents.risk_agent import RiskAgent
from app.agents.policy_agent import PolicyAgent
from app.agents.alternative_agent import AlternativeAgent
from app.agents.recovery_agent import RecoveryAgent
from app.orchestrator.graph import SupervisorOrchestrator

class TestSkyGuardianAgents(unittest.TestCase):

    def test_flight_agent_delay_detection(self):
        async def _run():
            state = JourneyState(
                journey_legs=[
                    {"flight_number": "UL001", "travel_date": "2026-09-15", "origin": "CMB", "destination": "KUL"}
                ]
            )
            agent = FlightAgent()
            res = await agent.execute(state)
            self.assertEqual(res.status, "success")
            self.assertEqual(state.flight_results[0]["flight_number"], "UL001")
            self.assertEqual(state.flight_results[0]["status"], "DELAYED")
            self.assertEqual(state.flight_results[0]["delay_minutes"], 90)

        asyncio.run(_run())

    def test_connection_agent_feasibility_math(self):
        async def _run():
            state = JourneyState(
                flight_results=[
                    {
                        "flight_number": "UL001", "origin": "CMB", "destination": "KUL",
                        "scheduled_arrival": "2026-09-15T15:30:00Z", "estimated_arrival": "2026-09-15T17:00:00Z",
                        "delay_minutes": 90
                    },
                    {
                        "flight_number": "XX123", "origin": "KUL", "destination": "NRT",
                        "scheduled_departure": "2026-09-15T17:30:00Z", "estimated_departure": "2026-09-15T17:30:00Z",
                        "delay_minutes": 0
                    }
                ]
            )
            agent = ConnectionAgent(default_mct_minutes=60)
            res = await agent.execute(state)
            self.assertEqual(res.status, "success")
            self.assertEqual(len(state.connection_results), 1)
            conn = state.connection_results[0]
            self.assertEqual(conn["available_connection_minutes"], 30)
            self.assertEqual(conn["minimum_required_minutes"], 60)
            self.assertEqual(conn["buffer_minutes"], -30)
            self.assertEqual(conn["status"], "LIKELY_MISSED")
            self.assertIn("INBOUND_FLIGHT_DELAYED", conn["reason_codes"])

        asyncio.run(_run())

    def test_risk_agent_weighted_calculation(self):
        async def _run():
            state = JourneyState(
                flight_results=[{"status": "DELAYED", "delay_minutes": 90}],
                connection_results=[{"status": "LIKELY_MISSED"}],
                weather_results=[{"weather_risk_score": 60}]
            )
            # Weights and bands come from config/risk.yaml:
            # Flight score = 65 (90 min delay), Connection score = 90, Weather score = 60
            # Weighted total = (65 * 0.4) + (90 * 0.35) + (60 * 0.25) = 26 + 31.5 + 15 = 72.5 -> 73
            agent = RiskAgent()
            res = await agent.execute(state)
            self.assertEqual(res.status, "success")
            self.assertEqual(state.risk_analysis["score"], 73)
            self.assertEqual(state.risk_analysis["level"], "HIGH")
            self.assertFalse(state.risk_analysis["is_probability"])

        asyncio.run(_run())

    def test_full_supervisor_orchestration_flow(self):
        async def _run():
            state = JourneyState(
                language="en",
                origin="CMB",
                destination="NRT",
                journey_legs=[
                    {"flight_number": "UL001", "travel_date": "2026-09-15", "origin": "CMB", "destination": "KUL"},
                    {"flight_number": "XX123", "travel_date": "2026-09-15", "origin": "KUL", "destination": "NRT"}
                ]
            )
            orchestrator = SupervisorOrchestrator()
            final_state = await orchestrator.run_workflow(state)
            self.assertEqual(final_state.workflow_status, "COMPLETED")
            self.assertEqual(final_state.risk_analysis["score"], 73)
            self.assertEqual(final_state.risk_analysis["level"], "HIGH")
            self.assertEqual(len(final_state.policy_evidence), 2)
            self.assertTrue(len(final_state.alternative_options) > 0)
            self.assertIn("UL001", final_state.recommendation_text)
            self.assertIn("LIKELY MISSED", final_state.recommendation_text)

        asyncio.run(_run())

if __name__ == "__main__":
    unittest.main()
