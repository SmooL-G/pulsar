"""Inline keyboard builder."""
from __future__ import annotations
from typing import List, Dict, Any


class Keyboard:
    """Helper for building inline-button keyboards."""

    def __init__(self) -> None:
        self._rows: List[List[Dict[str, str]]] = []

    @staticmethod
    def inline(buttons: List[List[Dict[str, str]]]) -> List[List[Dict[str, str]]]:
        """Build keyboard from nested list: [[{'text':..,'data':..}]]."""
        return [
            [{"text": b["text"], "callbackData": b["data"]} for b in row]
            for row in buttons
        ]

    def row(self, *buttons: Dict[str, str]) -> "Keyboard":
        self._rows.append(
            [{"text": b["text"], "callbackData": b["data"]} for b in buttons]
        )
        return self

    def build(self) -> List[List[Dict[str, str]]]:
        return self._rows
