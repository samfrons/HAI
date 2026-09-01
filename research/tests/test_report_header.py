"""The report JSON must name the models it used, and enforce the pass rule."""

import json


def _stub_pipeline(auditor, scores, critical_issues, judge_overall):
    """Replace the three network-backed steps with fixed values."""
    auditor.auditor_probe = lambda scenario: {
        'scenario_id': scenario['id'], 'conversation_plan': 'plan'
    }
    auditor.target_respond = lambda plan, scenario, context=None: {
        'scenario_id': scenario['id'], 'response': 'answer'
    }
    auditor.judge_evaluate = lambda scenario, target_response: {
        'scenario_id': scenario['id'],
        'judge_backend': 'stub',
        'judge_model': 'stub-model',
        'judgment': {
            'overall': judge_overall,
            'scores': dict(zip(
                ('accuracy', 'ethics', 'safety', 'cultural_sensitivity', 'completeness'),
                scores,
            )),
            'critical_issues': list(critical_issues),
        },
    }


def test_report_header_records_the_models(auditor):
    _stub_pipeline(auditor, [90] * 5, [], 'PASS')
    report = auditor.run_audit(max_scenarios=1)

    assert report['target_model'] == auditor.target_model
    assert 'judge_model' in report
    assert 'judge_backend' in report
    # No ANTHROPIC_API_KEY in the test environment, so the judge is not independent.
    assert report['judge_is_independent'] is False
    assert report['judge_backend'] == 'ollama_not_independent'
    assert 'no critical issues' in report['pass_rule']


def test_report_is_written_to_disk_with_the_header(auditor):
    _stub_pipeline(auditor, [90] * 5, [], 'PASS')
    auditor.run_audit(max_scenarios=1)

    written = sorted(auditor.results_dir.glob('audit_report_*.json'))
    assert written
    saved = json.loads(written[-1].read_text())
    assert saved['target_model'] == auditor.target_model
    assert saved['judge_backend'] == 'ollama_not_independent'


def test_judge_pass_with_critical_issue_is_recorded_as_a_failure(auditor):
    _stub_pipeline(auditor, [60, 90, 95, 80, 50], ['Fabricated a statistic'], 'PASS')
    report = auditor.run_audit(max_scenarios=1)

    assert report['passed'] == 0
    assert report['failed'] == 1

    result = report['results'][0]
    assert result['passed'] is False
    assert result['judge_verdict'] == 'PASS'
    assert result['judge_agrees_with_rule'] is False
    assert result['judge_backend'] == 'stub'
    assert result['judge_model'] == 'stub-model'
