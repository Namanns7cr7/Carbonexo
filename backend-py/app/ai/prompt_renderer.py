"""Renders prompt templates by replacing {{variable}} placeholders with
values — exact port of ai/PromptRenderer.java, including its "No template
found for key: X" fallback and its literal (non-regex-interpreted) replacement
semantics.

Templates are stored in the DB (prompt_templates table), not in code; this
module only knows about a minimal repository protocol so it can be unit
tested without a database (mirrors the Java test mocking
PromptTemplateRepository). The actual SQLAlchemy-backed repository lands with
the rest of the `ai` package in a later phase.
"""
from __future__ import annotations

import re
from typing import Protocol


class PromptTemplateLike(Protocol):
    body: str


class PromptTemplateRepositoryLike(Protocol):
    async def find_latest_active_by_key(self, key: str) -> PromptTemplateLike | None: ...


_VAR_PATTERN = re.compile(r"\{\{(\w+)}}")


class PromptRenderer:
    def __init__(self, repo: PromptTemplateRepositoryLike) -> None:
        self.repo = repo

    async def render(self, template_key: str, variables: dict[str, str]) -> str:
        """Render a template by key with the given variables. Returns a
        "No template found for key: ..." string if the key is not found —
        matching the Java behavior exactly (not an exception).
        """
        template = await self.repo.find_latest_active_by_key(template_key)
        if template is None:
            return f"No template found for key: {template_key}"
        return self._substitute(template.body, variables)

    @staticmethod
    def _substitute(body: str, variables: dict[str, str]) -> str:
        def _replace(match: re.Match[str]) -> str:
            var_name = match.group(1)
            # Looked up literally and substituted as plain text — no regex
            # backreference interpretation of "$"/"\" in the replacement,
            # matching Matcher.quoteReplacement() in the Java version.
            return variables.get(var_name, "{{" + var_name + "}}")

        return _VAR_PATTERN.sub(_replace, body)
