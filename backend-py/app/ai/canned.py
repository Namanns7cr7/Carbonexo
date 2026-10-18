"""Canned/fallback AI provider for development without GCP credentials —
port of ai/CannedFallbackProvider.java (same keywords, same order, same texts).

Rules for every text here: generic guidance only; no statements about the user
("you primarily use a car", "your footprint decreased by 8%"); no invented
numbers. Each text says it is offline guidance, and the provider name is never
a model's name, so nothing downstream can label it as Gemini.
"""
from __future__ import annotations

import logging

from app.ai.base import AIProvider

log = logging.getLogger(__name__)

PROVIDER_NAME = "canned-fallback"
OFFLINE_NOTE = " (Offline guidance: the AI coach is unavailable right now, so this is not personalised.)"

_REDUCTION_RESPONSE = (
    '[{"title":"Look at your most frequent car trips","detail":"Shared or public transport for regular '
    'trips is usually the largest single lever. The AI coach can estimate it once it is available.",'
    '"est_saving_kg":null},\n'
    ' {"title":"Check your electricity bill","detail":"Your bill\'s kWh is the most reliable electricity '
    'number you have; log it rather than individual appliances.","est_saving_kg":null},\n'
    ' {"title":"Log meals by ingredient","detail":"Meal footprints depend on what is in them; ingredient '
    'weights allow an estimate.","est_saving_kg":null}]\n'
)

_ELECTRICITY_RESPONSE = (
    "Log your bill's kWh so emissions can be estimated from your actual use. Raising the AC set-point "
    "and switching off standby loads are common ways to reduce electricity use." + OFFLINE_NOTE
)

_TRANSPORT_RESPONSE = (
    "For regular trips, public or shared transport usually has lower emissions per person than "
    "driving alone. Log your trips with distance to get an estimate." + OFFLINE_NOTE
)

_SCENARIO_RESPONSE = (
    "This is a what-if result, not a measured change. The numbers above come from the simulation "
    "itself." + OFFLINE_NOTE
)

_PERSUASIVE_RESPONSE = (
    "A second-hand or refurbished option can avoid making a new product; how much depends on the "
    "product." + OFFLINE_NOTE
)

_LEADERBOARD_RESPONSE = (
    "Group totals reflect what members have logged; members who have not logged are missing "
    "data, not zero." + OFFLINE_NOTE
)

_TIP_RESPONSE = "Carry a reusable bottle and bag today to cut single-use plastic." + OFFLINE_NOTE

_REPORT_RESPONSE = (
    "Your monthly report needs the AI coach, which is unavailable right now. Your logged totals on "
    "the dashboard are unaffected." + OFFLINE_NOTE
)

_DEFAULT_RESPONSE = (
    "The AI coach is unavailable right now. You can still log activities and see your logged totals."
    + OFFLINE_NOTE
)


class CannedFallbackProvider(AIProvider):
    def generate(self, prompt: str, model: str) -> str:
        log.info("CannedFallbackProvider — returning static, non-personalised text (requested model=%s)", model)

        if "reduction" in prompt or "recommend" in prompt:
            return _REDUCTION_RESPONSE
        if "electricity" in prompt or "kWh" in prompt:
            return _ELECTRICITY_RESPONSE
        if "transport" in prompt or "travel" in prompt:
            return _TRANSPORT_RESPONSE
        if "scenario" in prompt or "hypothetical" in prompt:
            return _SCENARIO_RESPONSE
        if "persuasive" in prompt:
            return _PERSUASIVE_RESPONSE
        if "leaderboard" in prompt:
            return _LEADERBOARD_RESPONSE
        if "tip" in prompt or "sustainability" in prompt:
            return _TIP_RESPONSE
        if "report" in prompt or "monthly" in prompt:
            return _REPORT_RESPONSE
        return _DEFAULT_RESPONSE

    def provider_name(self) -> str:
        return PROVIDER_NAME
