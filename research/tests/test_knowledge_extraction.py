"""Pure-function tests for the regex extractors in extract_humanitarian_knowledge.py.

These document what the patterns actually match, including their known limits - the
extractor is a crude regex scraper, not a fact checker.
"""

import pytest


@pytest.fixture
def extractor(extractor_module, tmp_path):
    return extractor_module.HumanitarianKnowledgeExtractor(
        docs_dir=str(tmp_path / 'docs'),
        output_dir=str(tmp_path / 'out'),
    )


# --- statistics pattern ----------------------------------------------------------

def test_scaled_quantity_is_extracted(extractor):
    stats = extractor._extract_statistics("An estimated 339 million people need aid.")
    scaled = [s for s in stats if 'value' in s]
    assert len(scaled) == 1
    assert scaled[0]['value'] == '339'
    assert scaled[0]['scale'] == 'million'
    assert scaled[0]['metric'].startswith('people')


def test_decimal_value_is_kept_whole(extractor):
    stats = extractor._extract_statistics("1.5 million conflict events mapped")
    assert stats[0]['value'] == '1.5'
    assert stats[0]['scale'] == 'million'


def test_multiple_scaled_quantities(extractor):
    stats = extractor._extract_statistics(
        "400 million submissions and 28 million registrations"
    )
    values = [(s['value'], s['scale']) for s in stats if 'value' in s]
    assert values == [('400', 'million'), ('28', 'million')]


def test_percentage_of_pattern(extractor):
    stats = extractor._extract_statistics("Roughly 11% of systems expose an API.")
    pct = [s for s in stats if 'percentage' in s]
    assert len(pct) == 1
    assert pct[0]['percentage'] == '11%'
    assert pct[0]['subject'] == 'systems expose an API'


def test_percentage_without_of_is_not_matched(extractor):
    stats = extractor._extract_statistics("Coverage reached 40% last year.")
    assert [s for s in stats if 'percentage' in s] == []


def test_bare_number_without_a_scale_word_is_not_a_statistic(extractor):
    assert extractor._extract_statistics("There were 36 countries covered.") == []


def test_no_statistics_in_plain_prose(extractor):
    assert extractor._extract_statistics("Humanitarian coordination is difficult.") == []


# --- terminology pattern ---------------------------------------------------------

def test_bold_term_definition_is_extracted(extractor):
    terms = extractor._extract_terminology(
        "**Impartiality**: Assistance is based on need alone."
    )
    assert terms == {'Impartiality': 'Assistance is based on need alone.'}


def test_plain_term_definition_is_extracted(extractor):
    terms = extractor._extract_terminology(
        "Neutrality: Do not take sides in hostilities."
    )
    assert terms == {'Neutrality': 'Do not take sides in hostilities.'}


def test_lowercase_term_is_not_extracted(extractor):
    assert extractor._extract_terminology("impartiality: based on need alone.") == {}


def test_definition_must_end_in_a_period(extractor):
    assert extractor._extract_terminology("Localization: locally led response") == {}


def test_short_definitions_are_dropped(extractor):
    assert extractor._extract_terminology("Term: short.") == {}


def test_later_definition_of_the_same_term_wins(extractor):
    terms = extractor._extract_terminology(
        "Humanity: The first definition here.\nHumanity: The second definition here."
    )
    assert terms['Humanity'] == 'The second definition here.'


# --- other extractors ------------------------------------------------------------

def test_crisis_types_are_found_case_insensitively(extractor):
    found = extractor._extract_crisis_types("A severe Drought followed the flood.")
    types = {f['type'] for f in found}
    assert 'drought' in types
    assert 'flood' in types


def test_numbered_list_becomes_one_workflow(extractor):
    workflows = extractor._extract_workflows("1. Assess needs\n2. Coordinate\n3. Deliver")
    assert len(workflows) == 1
    assert workflows[0]['type'] == 'numbered_process'
    assert workflows[0]['steps'] == ['Assess needs', 'Coordinate', 'Deliver']


def test_no_numbered_list_means_no_workflow(extractor):
    assert extractor._extract_workflows("Assess, coordinate, then deliver.") == []


def test_known_platform_sentence_is_captured(extractor):
    platforms = extractor._extract_platforms("HDX hosts datasets from many sources.")
    assert any(p['name'] == 'HDX' for p in platforms)
