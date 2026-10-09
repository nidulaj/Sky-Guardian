"""
Grounding checks for an LLM recovery plan. Any error means the template is used instead.

Everything specific in the plan must be traceable to the fact sheet: numbers, flight numbers,
airport codes and policy ids. Promise words are allowed only when a cited policy says them.
"""
import re
from typing import List, Set

from app.agents.recovery_facts import RecoveryFacts
from app.schemas.recovery import RecoveryPlan

BANNED_PHRASES = ("guarantee", "definitely", "will be compensated", "entitled")
NO_POLICY_PHRASE = "could not be verified"
NUMBER = re.compile(r"\d{2,}")
# The risk score scale ("73/100") is not itself a fact.
ALLOWED_NUMBERS = {"100"}
FLIGHT_NUMBER = re.compile(r"\b(?:[A-Z]{2}|[A-Z][0-9]|[0-9][A-Z]|[A-Z]{3})[0-9]{1,4}[A-Z]?\b")
AIRPORT_LIKE = re.compile(r"\b[A-Z]{3}\b")
# Common capitalised three-letter words that are not airport codes.
NON_AIRPORT_CAPS = {"UTC", "GMT", "ETA", "ETD", "MCT", "USD", "EUR", "LKR", "AND", "THE", "FOR", "NOT", "SMS", "APP"}


def _plan_text(plan: RecoveryPlan) -> str:
    return "\n".join([plan.headline, plan.what_happened, plan.impact, plan.recommended_action,
                      plan.why_this_option, plan.contact, *plan.next_steps, *plan.uncertainty])


def _tokens(pattern: re.Pattern, text: str) -> Set[str]:
    return set(pattern.findall(text))


def validate_plan(plan: RecoveryPlan, facts: RecoveryFacts) -> List[str]:
    errors: List[str] = []
    text = _plan_text(plan)
    fact_text = facts.model_dump_json()
    policy_ids = set(facts.policy_ids)

    unknown_citations = [c for c in plan.policy_citations if c not in policy_ids]
    unknown_citations += [c for c in re.findall(r"\[(P\d+)\]", text) if c not in policy_ids]
    if unknown_citations:
        errors.append(f"unknown policy citations: {sorted(set(unknown_citations))}")

    invented_numbers = _tokens(NUMBER, text) - _tokens(re.compile(r"\d+"), fact_text) - ALLOWED_NUMBERS
    if invented_numbers:
        errors.append(f"numbers not in facts: {sorted(invented_numbers)}")

    invented_flights = _tokens(FLIGHT_NUMBER, text) - _tokens(FLIGHT_NUMBER, fact_text) - policy_ids
    if invented_flights:
        errors.append(f"flight numbers not in facts: {sorted(invented_flights)}")

    invented_codes = _tokens(AIRPORT_LIKE, text) - _tokens(AIRPORT_LIKE, fact_text) - NON_AIRPORT_CAPS
    if invented_codes:
        errors.append(f"airport codes not in facts: {sorted(invented_codes)}")

    cited_snippets = " ".join(p.snippet.lower() for p in facts.policies if p.id in plan.policy_citations)
    lowered = text.lower()
    banned = [p for p in BANNED_PHRASES if p in lowered and p not in cited_snippets]
    if banned:
        errors.append(f"unsupported promise wording: {banned}")

    if not facts.policies and NO_POLICY_PHRASE not in lowered:
        errors.append("missing 'could not be verified' statement for absent policy evidence")

    return errors
