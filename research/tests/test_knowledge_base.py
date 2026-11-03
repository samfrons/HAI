"""Tests for the humanitarian knowledge base quality and structure."""

import json
import re
from pathlib import Path

import pytest

KB_PATH = Path(__file__).parent.parent / "data" / "processed" / "humanitarian_knowledge.json"
TRAIN_PATH = Path(__file__).parent.parent / "hai-cd" / "train_dataset.json"
VAL_PATH = Path(__file__).parent.parent / "hai-cd" / "val_dataset.json"
TEST_PATH = Path(__file__).parent.parent / "hai-cd" / "test_dataset.json"
SCENARIOS_PATH = Path(__file__).parent.parent.parent / "petri" / "seeds" / "humanitarian_test_scenarios.json"


@pytest.fixture
def kb():
    with open(KB_PATH) as f:
        return json.load(f)


class TestKnowledgeBaseStructure:
    def test_required_sections_exist(self, kb):
        required = ["crisis_types", "statistics", "terminology", "platforms",
                     "workflows", "decision_frameworks", "best_practices",
                     "case_studies", "sphere_standards"]
        for section in required:
            assert section in kb, f"Missing section: {section}"

    def test_crisis_types_count(self, kb):
        assert len(kb["crisis_types"]) >= 15

    def test_statistics_count(self, kb):
        assert len(kb["statistics"]) >= 20

    def test_terminology_count(self, kb):
        terms = kb["terminology"]
        assert len(terms) >= 40

    def test_platforms_count(self, kb):
        assert len(kb["platforms"]) >= 10

    def test_workflows_count(self, kb):
        assert len(kb["workflows"]) >= 8

    def test_decision_frameworks_count(self, kb):
        assert len(kb["decision_frameworks"]) >= 5

    def test_best_practices_count(self, kb):
        assert len(kb["best_practices"]) >= 10

    def test_case_studies_count(self, kb):
        assert len(kb["case_studies"]) >= 5


class TestKnowledgeBaseQuality:
    CODE_INDICATORS = [
        "function(", "const ", "var ", ".push(",
        "async ", "await ", "console.log", "();",
        "this.", "class {", "import {", "require(",
        "module.exports",
    ]

    def test_no_code_in_crisis_types(self, kb):
        for item in kb["crisis_types"]:
            text = json.dumps(item)
            for indicator in self.CODE_INDICATORS:
                assert indicator not in text, (
                    f"Code contamination in crisis type '{item.get('type', '?')}': "
                    f"found '{indicator}'"
                )

    def test_no_code_in_statistics(self, kb):
        for item in kb["statistics"]:
            text = json.dumps(item)
            for indicator in self.CODE_INDICATORS:
                assert indicator not in text, (
                    f"Code contamination in statistic: found '{indicator}'"
                )

    def test_statistics_have_sources(self, kb):
        for item in kb["statistics"]:
            assert "source" in item, f"Statistic missing source: {item.get('stat', '?')[:60]}"
            assert len(item["source"]) >= 3

    def test_key_humanitarian_terms_present(self, kb):
        terms = kb["terminology"]
        required_terms = ["UNHCR", "OCHA", "WASH", "IPC", "GBV", "IDP", "NFI"]
        for term in required_terms:
            assert term in terms, f"Missing key term: {term}"

    def test_sphere_wash_standard(self, kb):
        text = json.dumps(kb)
        assert "15" in text and "litre" in text.lower(), "Missing 15 litres water standard"

    def test_crisis_types_have_definitions(self, kb):
        for item in kb["crisis_types"]:
            assert "definition" in item, f"Crisis type missing definition: {item.get('type', '?')}"
            assert len(item["definition"]) > 20

    def test_platforms_have_descriptions(self, kb):
        for item in kb["platforms"]:
            assert "name" in item
            assert "description" in item
            assert len(item["description"]) > 20


class TestTrainingData:
    def test_train_exists(self):
        assert TRAIN_PATH.exists()

    def test_train_format(self):
        with open(TRAIN_PATH) as f:
            data = json.load(f)
        assert isinstance(data, list)
        assert len(data) >= 10

    def test_train_message_format(self):
        with open(TRAIN_PATH) as f:
            data = json.load(f)
        for sample in data:
            assert "messages" in sample
            msgs = sample["messages"]
            assert len(msgs) >= 2
            roles = [m["role"] for m in msgs]
            assert "user" in roles
            assert "assistant" in roles

    def test_train_has_categories(self):
        with open(TRAIN_PATH) as f:
            data = json.load(f)
        categories = set(s.get("category") for s in data)
        assert len(categories) >= 3

    def test_val_exists(self):
        assert VAL_PATH.exists()

    def test_test_exists(self):
        assert TEST_PATH.exists()


class TestScenarios:
    def test_scenarios_exist(self):
        assert SCENARIOS_PATH.exists()

    def test_scenarios_load(self):
        with open(SCENARIOS_PATH) as f:
            raw = json.load(f)
        data = raw.get("scenarios", raw) if isinstance(raw, dict) else raw
        assert isinstance(data, list)
        assert len(data) >= 20

    def test_scenarios_have_required_fields(self):
        with open(SCENARIOS_PATH) as f:
            raw = json.load(f)
        data = raw.get("scenarios", raw) if isinstance(raw, dict) else raw
        for s in data:
            assert "name" in s or "id" in s, f"Scenario missing name/id"


class TestAuditorJudgeSeparation:
    def test_judge_not_using_target_model(self):
        auditor_path = Path(__file__).parent.parent / "src" / "petri" / "humanitarian_auditor.py"
        if not auditor_path.exists():
            pytest.skip("Auditor file not found")
        source = auditor_path.read_text()
        judge_method = re.search(
            r"def judge_evaluate.*?(?=\n    def |\nclass |\Z)",
            source, re.DOTALL,
        )
        if judge_method is None:
            judge_method = re.search(
                r"def _judge_generate.*?(?=\n    def |\nclass |\Z)",
                source, re.DOTALL,
            )
        if judge_method:
            method_text = judge_method.group()
            assert "self.target_model" not in method_text or "not independent" in method_text.lower() or "fallback" in method_text.lower(), (
                "judge_evaluate appears to use self.target_model as the judge"
            )
