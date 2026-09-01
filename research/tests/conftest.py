"""Test fixtures.

The tests must run with no network, no Ollama server and no API key, so the third-party
clients the auditor imports at module level (`ollama`, `anthropic`, `openai`) are stubbed
in `sys.modules` before the module under test is loaded. Nothing here talks to a model.
"""

import importlib.util
import sys
import types
from pathlib import Path

import pytest

REPO_ROOT = Path(__file__).resolve().parents[1]


def _install_client_stubs():
    """Register minimal stand-ins for the API client packages."""
    if 'ollama' not in sys.modules:
        ollama = types.ModuleType('ollama')

        def _generate(*args, **kwargs):  # pragma: no cover - must never be called
            raise AssertionError("ollama.generate() called during a test")

        ollama.generate = _generate
        sys.modules['ollama'] = ollama

    if 'anthropic' not in sys.modules:
        anthropic = types.ModuleType('anthropic')

        class Anthropic:  # pragma: no cover - constructed only via monkeypatch
            def __init__(self, *args, **kwargs):
                self.messages = None

        anthropic.Anthropic = Anthropic
        sys.modules['anthropic'] = anthropic

    if 'openai' not in sys.modules:
        openai = types.ModuleType('openai')

        class OpenAI:  # pragma: no cover
            def __init__(self, *args, **kwargs):
                pass

        openai.OpenAI = OpenAI
        sys.modules['openai'] = openai


def _load_module(name: str, relative_path: str):
    spec = importlib.util.spec_from_file_location(name, REPO_ROOT / relative_path)
    module = importlib.util.module_from_spec(spec)
    sys.modules[name] = module
    spec.loader.exec_module(module)
    return module


@pytest.fixture(scope='session')
def auditor_module():
    """The humanitarian auditor module, loaded with stubbed API clients."""
    _install_client_stubs()
    return _load_module(
        'humanitarian_auditor_under_test',
        'src/petri/humanitarian_auditor.py',
    )


@pytest.fixture(scope='session')
def extractor_module():
    """The knowledge-extraction script (stdlib only)."""
    return _load_module(
        'extract_humanitarian_knowledge_under_test',
        'scripts/extract_humanitarian_knowledge.py',
    )


@pytest.fixture(scope='session')
def seeds():
    """The parsed seed scenarios file."""
    import json
    path = REPO_ROOT / 'petri' / 'seeds' / 'humanitarian_test_scenarios.json'
    return json.loads(path.read_text())


@pytest.fixture
def auditor(auditor_module, monkeypatch, tmp_path):
    """A HumanitarianAuditor with no API keys and results written to a temp dir."""
    monkeypatch.delenv('ANTHROPIC_API_KEY', raising=False)
    monkeypatch.delenv('OPENROUTER_API_KEY', raising=False)
    return auditor_module.HumanitarianAuditor(
        scenarios_path=str(REPO_ROOT / 'petri' / 'seeds' / 'humanitarian_test_scenarios.json'),
        results_dir=str(tmp_path / 'results'),
    )
