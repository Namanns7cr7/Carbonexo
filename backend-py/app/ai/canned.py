"""Canned/fallback AI provider for development without GCP credentials —
exact port of ai/CannedFallbackProvider.java's keyword-matching logic (same
substrings, same order, same fallback branch).
"""
from __future__ import annotations

import logging

from app.ai.base import AIProvider

log = logging.getLogger(__name__)

_REDUCTION_RESPONSE = (
    '[{"title":"Switch to metro for short commutes","detail":"Taking the metro instead of '
    'driving for trips under 10km can save significant emissions.","est_saving_kg":4.2},\n'
    ' {"title":"Try two meat-free dinners this week","detail":"Plant-based meals have a much '
    'lower carbon footprint than meat-based ones.","est_saving_kg":3.1},\n'
    ' {"title":"Unplug devices when not in use","detail":"Standby power consumption adds up. '
    'Use power strips for easy switching.","est_saving_kg":1.5}]'
)

_ELECTRICITY_RESPONSE = (
    "Your electricity usage is moderate. Consider using energy-efficient appliances and "
    "turning off lights when leaving rooms. Setting your AC to 24°C instead of 22°C can "
    "reduce consumption by 15%. Your usage trend shows a slight increase — monitor peak hours."
)

_TRANSPORT_RESPONSE = (
    "You primarily use a car for commuting. Consider carpooling for longer trips — this can "
    "halve your per-person emissions. The metro is great for distances under 15km. "
    "Potential saving: ~5 kg CO₂/week by switching 2 car trips to metro."
)

_TIP_RESPONSE = (
    "Small daily choices add up! Try bringing a reusable bag and water bottle today — "
    "it's an easy win that reduces plastic waste and feels great. \U0001F331"
)

_REPORT_RESPONSE = (
    "Great month! You tracked consistently and your carbon footprint decreased by 8% "
    "compared to last month. Your biggest win was switching to metro on 3 days. "
    "Focus area: food emissions increased slightly — try one more veggie day next month!"
)

_DEFAULT_RESPONSE = (
    "I'm your sustainability coach! I can help with carbon reduction tips, "
    "electricity analysis, transport insights, and more. What would you like to know?"
)


class CannedFallbackProvider(AIProvider):
    def generate(self, prompt: str, model: str) -> str:
        log.info("CannedFallbackProvider — returning static response (model=%s)", model)

        if "reduction" in prompt or "recommend" in prompt:
            return _REDUCTION_RESPONSE
        if "electricity" in prompt or "kWh" in prompt:
            return _ELECTRICITY_RESPONSE
        if "transport" in prompt or "travel" in prompt:
            return _TRANSPORT_RESPONSE
        if "tip" in prompt or "sustainability" in prompt:
            return _TIP_RESPONSE
        if "report" in prompt or "monthly" in prompt:
            return _REPORT_RESPONSE
        return _DEFAULT_RESPONSE

    def provider_name(self) -> str:
        return "canned"
