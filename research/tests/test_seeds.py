"""Integrity checks on the Petri seed scenarios file."""

import collections

REQUIRED_KEYS = (
    'id',
    'category',
    'name',
    'description',
    'seed_instruction',
    'evaluation_criteria',
    'expected_facts',
    'safety_dimensions',
)

# The true per-scenario tally. The metadata block previously disagreed with the file
# (its counts summed to 32); see AUDIT_RESULTS.md.
EXPECTED_CATEGORY_COUNTS = {
    'accuracy': 8,
    'ethics': 4,
    'technical_knowledge': 4,
    'safety_alignment': 4,
    'workflow_understanding': 3,
    'cultural_sensitivity': 1,
    'conflict_sensitivity': 1,
    'safety_security': 1,
}


def test_there_are_26_scenarios(seeds):
    assert len(seeds['scenarios']) == 26
    assert seeds['metadata']['total_scenarios'] == 26


def test_scenario_ids_are_unique(seeds):
    ids = [s['id'] for s in seeds['scenarios']]
    assert len(set(ids)) == len(ids)


def test_every_scenario_has_the_required_keys(seeds):
    for scenario in seeds['scenarios']:
        missing = [k for k in REQUIRED_KEYS if k not in scenario]
        assert not missing, f"{scenario.get('id')} missing {missing}"


def test_expected_facts_and_safety_dimensions_are_lists_of_strings(seeds):
    for scenario in seeds['scenarios']:
        for key in ('expected_facts', 'safety_dimensions'):
            value = scenario[key]
            assert isinstance(value, list), f"{scenario['id']}.{key}"
            assert all(isinstance(v, str) and v.strip() for v in value), \
                f"{scenario['id']}.{key}"


def test_metadata_category_counts_match_the_scenarios(seeds):
    actual = collections.Counter(s['category'] for s in seeds['scenarios'])
    assert dict(actual) == EXPECTED_CATEGORY_COUNTS
    assert seeds['metadata']['categories'] == EXPECTED_CATEGORY_COUNTS


def test_metadata_category_counts_sum_to_the_scenario_count(seeds):
    assert sum(seeds['metadata']['categories'].values()) == len(seeds['scenarios'])


def test_metadata_safety_dimensions_match_the_scenarios(seeds):
    used = {d for s in seeds['scenarios'] for d in s['safety_dimensions']}
    assert set(seeds['metadata']['safety_dimensions_covered']) == used


def test_most_scenarios_have_at_least_one_expected_fact(seeds):
    """The judge was previously shown an empty fact list for every scenario."""
    with_facts = [s['id'] for s in seeds['scenarios'] if s['expected_facts']]
    assert len(with_facts) >= 25
