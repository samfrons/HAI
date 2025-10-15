#!/usr/bin/env python3
"""
Humanitarian Knowledge Extraction Script

Extracts domain knowledge from CLEAR documentation to create a structured
knowledge base for fine-tuning and ACE context optimization.

Usage:
    python scripts/extract_humanitarian_knowledge.py
"""

import os
import json
import re
import argparse
from pathlib import Path
from typing import Dict, List, Any
from collections import defaultdict
import logging

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


class HumanitarianKnowledgeExtractor:
    """Extract and structure humanitarian domain knowledge from CLEAR docs."""

    def __init__(self, docs_dir: str, output_dir: str):
        self.docs_dir = Path(docs_dir)
        self.output_dir = Path(output_dir)
        self.output_dir.mkdir(parents=True, exist_ok=True)

        # Knowledge categories
        self.knowledge_base = {
            'crisis_types': [],
            'statistics': [],
            'workflows': [],
            'decision_frameworks': [],
            'platforms': [],
            'best_practices': [],
            'terminology': defaultdict(str),
            'case_studies': []
        }

    def extract_from_markdown(self, file_path: Path) -> Dict[str, Any]:
        """Extract structured knowledge from a markdown file."""
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                content = f.read()

            extracted = {
                'source': str(file_path.relative_to(self.docs_dir.parent)),
                'crisis_types': self._extract_crisis_types(content),
                'statistics': self._extract_statistics(content),
                'workflows': self._extract_workflows(content),
                'platforms': self._extract_platforms(content),
                'terminology': self._extract_terminology(content)
            }

            return extracted

        except Exception as e:
            logger.error(f"Error processing {file_path}: {e}")
            return {}

    def _extract_crisis_types(self, content: str) -> List[str]:
        """Extract crisis/disaster types mentioned in content."""
        crisis_keywords = [
            'earthquake', 'flood', 'drought', 'famine', 'conflict',
            'epidemic', 'pandemic', 'cyclone', 'hurricane', 'tsunami',
            'displacement', 'refugee crisis', 'humanitarian crisis',
            'natural disaster', 'emergency', 'disaster'
        ]

        found_types = []
        content_lower = content.lower()

        for keyword in crisis_keywords:
            if keyword in content_lower:
                # Extract context around the keyword
                pattern = rf'.{{0,100}}{re.escape(keyword)}.{{0,100}}'
                matches = re.finditer(pattern, content_lower, re.IGNORECASE)
                for match in matches:
                    found_types.append({
                        'type': keyword,
                        'context': match.group().strip()
                    })

        return found_types

    def _extract_statistics(self, content: str) -> List[Dict[str, str]]:
        """Extract humanitarian statistics and verified claims."""
        statistics = []

        # Pattern: "X million/billion/thousand people/dollars/etc"
        stat_pattern = r'(\d+(?:\.\d+)?)\s*(million|billion|thousand|M\+|B\+|K\+)\s*([a-zA-Z\s]+)'

        matches = re.finditer(stat_pattern, content)
        for match in matches:
            value, scale, metric = match.groups()
            statistics.append({
                'value': value,
                'scale': scale,
                'metric': metric.strip(),
                'raw': match.group()
            })

        # Pattern: "X% of Y"
        percentage_pattern = r'(\d+(?:\.\d+)?%)\s+of\s+([^\.]+)'

        matches = re.finditer(percentage_pattern, content)
        for match in matches:
            percentage, subject = match.groups()
            statistics.append({
                'percentage': percentage,
                'subject': subject.strip(),
                'raw': match.group()
            })

        return statistics

    def _extract_workflows(self, content: str) -> List[str]:
        """Extract workflow descriptions and decision processes."""
        workflows = []

        # Look for numbered lists (common in workflow descriptions)
        workflow_pattern = r'(?:^|\n)\d+\.\s+([^\n]+)'

        matches = re.finditer(workflow_pattern, content, re.MULTILINE)
        current_workflow = []

        for match in matches:
            step = match.group(1).strip()
            current_workflow.append(step)

        if current_workflow:
            workflows.append({
                'steps': current_workflow,
                'type': 'numbered_process'
            })

        return workflows

    def _extract_platforms(self, content: str) -> List[Dict[str, str]]:
        """Extract information about humanitarian platforms and systems."""
        platforms = []

        # Known humanitarian platforms
        platform_names = [
            'HDX', 'ReliefWeb', 'KoboToolbox', 'PRIMES', 'SCOPE',
            'FEWS NET', 'ACLED', 'FTS', 'UNHCR', 'WFP', 'OCHA',
            'CLEAR'
        ]

        for platform in platform_names:
            pattern = rf'{re.escape(platform)}[^\.]*\.'
            matches = re.finditer(pattern, content, re.IGNORECASE)

            for match in matches:
                platforms.append({
                    'name': platform,
                    'description': match.group().strip()
                })

        return platforms

    def _extract_terminology(self, content: str) -> Dict[str, str]:
        """Extract humanitarian terminology and definitions."""
        terminology = {}

        # Pattern: "Term: definition" or "**Term**: definition"
        def_pattern = r'\*?\*?([A-Z][A-Za-z\s]+)\*?\*?:\s+([^\.]+\.)'

        matches = re.finditer(def_pattern, content)
        for match in matches:
            term, definition = match.groups()
            term = term.strip()
            definition = definition.strip()

            if len(term) > 2 and len(definition) > 10:
                terminology[term] = definition

        return terminology

    def process_all_docs(self) -> None:
        """Process all markdown files in the docs directory."""
        logger.info(f"Processing documents from {self.docs_dir}")

        # Find all markdown files
        md_files = list(self.docs_dir.rglob("*.md"))
        logger.info(f"Found {len(md_files)} markdown files")

        for file_path in md_files:
            if 'node_modules' in str(file_path):
                continue

            logger.info(f"Processing: {file_path.name}")
            extracted = self.extract_from_markdown(file_path)

            if extracted:
                # Merge into knowledge base
                self.knowledge_base['crisis_types'].extend(extracted.get('crisis_types', []))
                self.knowledge_base['statistics'].extend(extracted.get('statistics', []))
                self.knowledge_base['workflows'].extend(extracted.get('workflows', []))
                self.knowledge_base['platforms'].extend(extracted.get('platforms', []))
                self.knowledge_base['terminology'].update(extracted.get('terminology', {}))

    def generate_training_data(self) -> List[Dict[str, str]]:
        """Generate Q&A pairs for fine-tuning."""
        training_data = []

        # Generate Q&A from statistics
        for stat in self.knowledge_base['statistics'][:100]:  # Limit to avoid too much data
            if 'value' in stat and 'metric' in stat:
                question = f"What are the statistics on {stat['metric']}?"
                answer = f"Approximately {stat['value']} {stat['scale']} {stat['metric']}."

                training_data.append({
                    'question': question,
                    'answer': answer,
                    'category': 'statistics',
                    'source': 'CLEAR_docs'
                })

        # Generate Q&A from terminology
        for term, definition in list(self.knowledge_base['terminology'].items())[:50]:
            question = f"What is {term} in humanitarian context?"
            answer = definition

            training_data.append({
                'question': question,
                'answer': answer,
                'category': 'terminology',
                'source': 'CLEAR_docs'
            })

        # Generate Q&A from crisis types
        crisis_types_seen = set()
        for crisis_info in self.knowledge_base['crisis_types'][:100]:
            crisis_type = crisis_info.get('type', '')
            if crisis_type and crisis_type not in crisis_types_seen:
                crisis_types_seen.add(crisis_type)

                question = f"How should humanitarian responders address {crisis_type} situations?"
                answer = crisis_info.get('context', 'Humanitarian response requires coordinated multi-agency effort.')

                training_data.append({
                    'question': question,
                    'answer': answer,
                    'category': 'crisis_response',
                    'source': 'CLEAR_docs'
                })

        return training_data

    def save_knowledge_base(self) -> None:
        """Save the extracted knowledge base to files."""
        # Save as JSON
        json_output = self.output_dir / 'humanitarian_knowledge.json'
        with open(json_output, 'w', encoding='utf-8') as f:
            json.dump(self.knowledge_base, f, indent=2, ensure_ascii=False)

        logger.info(f"Saved knowledge base to {json_output}")

        # Save as JSONL for training
        jsonl_output = self.output_dir / 'humanitarian_knowledge.jsonl'
        training_data = self.generate_training_data()

        with open(jsonl_output, 'w', encoding='utf-8') as f:
            for item in training_data:
                f.write(json.dumps(item, ensure_ascii=False) + '\n')

        logger.info(f"Saved {len(training_data)} training examples to {jsonl_output}")

        # Save summary statistics
        summary = {
            'total_crisis_types': len(self.knowledge_base['crisis_types']),
            'total_statistics': len(self.knowledge_base['statistics']),
            'total_workflows': len(self.knowledge_base['workflows']),
            'total_platforms': len(self.knowledge_base['platforms']),
            'total_terminology': len(self.knowledge_base['terminology']),
            'training_examples': len(training_data)
        }

        summary_output = self.output_dir / 'extraction_summary.json'
        with open(summary_output, 'w', encoding='utf-8') as f:
            json.dump(summary, f, indent=2)

        logger.info(f"Extraction summary: {summary}")


def main():
    """Main execution function."""
    parser = argparse.ArgumentParser(
        description='Extract humanitarian knowledge from CLEAR documentation'
    )
    parser.add_argument(
        '--docs-dir',
        default='../docs',
        help='Path to CLEAR docs directory'
    )
    parser.add_argument(
        '--output-dir',
        default='data/processed',
        help='Output directory for processed knowledge'
    )

    args = parser.parse_args()

    extractor = HumanitarianKnowledgeExtractor(
        docs_dir=args.docs_dir,
        output_dir=args.output_dir
    )

    logger.info("Starting humanitarian knowledge extraction...")
    extractor.process_all_docs()
    extractor.save_knowledge_base()
    logger.info("Extraction complete!")


if __name__ == '__main__':
    main()
