#!/usr/bin/env python3
"""
ACE (Agentic Context Engineering) - Context Optimization Framework

Implements the ACE methodology from arXiv:2510.04618 for dynamic context
optimization through generation, reflection, and curation.

This framework treats contexts as "evolving playbooks" that improve through:
1. Generation: Create initial context from humanitarian knowledge
2. Reflection: Analyze performance and identify improvements
3. Curation: Select and refine best-performing contexts

Cost optimization: Uses local Ollama models to avoid API charges.
"""

import os
import json
import logging
from typing import List, Dict, Any, Optional
from pathlib import Path
from datetime import datetime
import ollama

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


class ACEContextOptimizer:
    """
    ACE Context Optimizer for Humanitarian AI

    Implements Agentic Context Engineering to dynamically improve
    humanitarian LLM contexts through iterative refinement.
    """

    def __init__(
        self,
        model: str = "llama3.3:8b",
        knowledge_base_path: str = "data/processed/humanitarian_knowledge.json",
        contexts_dir: str = "ace/contexts",
        playbooks_dir: str = "ace/playbooks",
        max_iterations: int = 5
    ):
        self.model = model
        self.knowledge_base_path = Path(knowledge_base_path)
        self.contexts_dir = Path(contexts_dir)
        self.playbooks_dir = Path(playbooks_dir)
        self.max_iterations = max_iterations

        # Create directories
        self.contexts_dir.mkdir(parents=True, exist_ok=True)
        self.playbooks_dir.mkdir(parents=True, exist_ok=True)

        # Load knowledge base
        self.knowledge_base = self._load_knowledge_base()

        # Context history for evolution tracking
        self.context_history: List[Dict[str, Any]] = []

    def _load_knowledge_base(self) -> Dict[str, Any]:
        """Load humanitarian knowledge base."""
        try:
            with open(self.knowledge_base_path, 'r') as f:
                return json.load(f)
        except FileNotFoundError:
            logger.warning(f"Knowledge base not found at {self.knowledge_base_path}")
            return {}

    def generate_initial_context(
        self,
        task_domain: str = "crisis_response"
    ) -> str:
        """
        Step 1: Generate initial context from humanitarian knowledge.

        Args:
            task_domain: Humanitarian domain (crisis_response, early_warning, etc.)

        Returns:
            Initial context string for humanitarian LLM
        """
        logger.info(f"Generating initial context for domain: {task_domain}")

        # Extract relevant knowledge
        crisis_types = self.knowledge_base.get('crisis_types', [])[:20]
        terminology = self.knowledge_base.get('terminology', {})
        statistics = self.knowledge_base.get('statistics', [])[:10]

        # Build context prompt
        generation_prompt = f"""You are a humanitarian AI expert. Generate a comprehensive context/system prompt for a humanitarian AI assistant specialized in {task_domain}.

Include:
1. Role definition and humanitarian principles
2. Key terminology and concepts
3. Important statistics and verified facts
4. Decision-making frameworks
5. Safety guidelines and ethical considerations

Base your context on this humanitarian knowledge:

Crisis Types: {json.dumps(crisis_types[:10], indent=2)}

Key Terminology: {json.dumps(dict(list(terminology.items())[:10]), indent=2)}

Statistics: {json.dumps(statistics[:5], indent=2)}

Generate a clear, structured context that will help the AI provide accurate, ethical humanitarian assistance.
Format as a system prompt starting with "You are a humanitarian AI assistant..."
"""

        # Generate context using local model (FREE - no API cost)
        response = ollama.generate(
            model=self.model,
            prompt=generation_prompt,
            options={'temperature': 0.7}
        )

        initial_context = response['response']

        # Save initial context
        context_data = {
            'iteration': 0,
            'timestamp': datetime.now().isoformat(),
            'domain': task_domain,
            'context': initial_context,
            'method': 'initial_generation',
            'model': self.model
        }

        self._save_context(context_data, "initial_context.json")
        self.context_history.append(context_data)

        logger.info("Initial context generated successfully")
        return initial_context

    def reflect_on_performance(
        self,
        current_context: str,
        test_results: List[Dict[str, Any]],
        iteration: int
    ) -> Dict[str, Any]:
        """
        Step 2: Reflect on context performance and identify improvements.

        Args:
            current_context: Current context being used
            test_results: Results from Petri tests or other evaluations
            iteration: Current iteration number

        Returns:
            Reflection analysis with suggested improvements
        """
        logger.info(f"Reflecting on iteration {iteration} performance")

        # Analyze test results
        total_tests = len(test_results)
        passed_tests = sum(1 for r in test_results if r.get('passed', False))
        accuracy = (passed_tests / total_tests * 100) if total_tests > 0 else 0

        # Extract failure patterns
        failures = [r for r in test_results if not r.get('passed', False)]
        failure_categories = {}
        for f in failures:
            category = f.get('category', 'unknown')
            failure_categories[category] = failure_categories.get(category, 0) + 1

        reflection_prompt = f"""Analyze this humanitarian AI context and its performance:

CURRENT CONTEXT:
{current_context}

PERFORMANCE METRICS:
- Total tests: {total_tests}
- Passed: {passed_tests}
- Failed: {len(failures)}
- Accuracy: {accuracy:.1f}%

FAILURE CATEGORIES:
{json.dumps(failure_categories, indent=2)}

SAMPLE FAILURES:
{json.dumps(failures[:3], indent=2)}

Identify:
1. What's working well in the current context
2. What's causing test failures
3. Specific improvements needed
4. Which humanitarian knowledge is missing or incorrect
5. How to better align with humanitarian principles

Provide structured recommendations for context improvement.
"""

        # Reflect using local model (FREE)
        response = ollama.generate(
            model=self.model,
            prompt=reflection_prompt,
            options={'temperature': 0.5}
        )

        reflection = {
            'iteration': iteration,
            'timestamp': datetime.now().isoformat(),
            'accuracy': accuracy,
            'total_tests': total_tests,
            'passed_tests': passed_tests,
            'failure_categories': failure_categories,
            'reflection': response['response'],
            'model': self.model
        }

        self._save_reflection(reflection, f"reflection_iter_{iteration}.json")

        logger.info(f"Reflection complete. Accuracy: {accuracy:.1f}%")
        return reflection

    def curate_improved_context(
        self,
        current_context: str,
        reflection: Dict[str, Any],
        iteration: int
    ) -> str:
        """
        Step 3: Curate improved context based on reflection.

        Args:
            current_context: Current context
            reflection: Reflection analysis
            iteration: Iteration number

        Returns:
            Improved context string
        """
        logger.info(f"Curating improved context for iteration {iteration + 1}")

        curation_prompt = f"""You are improving a humanitarian AI context based on performance analysis.

CURRENT CONTEXT:
{current_context}

PERFORMANCE REFLECTION:
{reflection['reflection']}

ACCURACY: {reflection['accuracy']:.1f}%

Create an improved version of the context that:
1. Keeps what's working well
2. Addresses identified weaknesses
3. Adds missing humanitarian knowledge
4. Improves alignment with humanitarian principles
5. Maintains clarity and structure

IMPORTANT:
- Preserve verified statistics and facts
- Maintain ethical guidelines
- Keep humanitarian principles (humanity, impartiality, neutrality, independence)
- Add specific guidance for failure categories

Generate the improved context as a complete system prompt.
"""

        # Curate using local model (FREE)
        response = ollama.generate(
            model=self.model,
            prompt=curation_prompt,
            options={'temperature': 0.6}
        )

        improved_context = response['response']

        # Save improved context
        context_data = {
            'iteration': iteration + 1,
            'timestamp': datetime.now().isoformat(),
            'context': improved_context,
            'method': 'ace_curation',
            'previous_accuracy': reflection['accuracy'],
            'model': self.model
        }

        self._save_context(context_data, f"context_iter_{iteration + 1}.json")
        self.context_history.append(context_data)

        logger.info(f"Improved context curated for iteration {iteration + 1}")
        return improved_context

    def optimize_context(
        self,
        task_domain: str = "crisis_response",
        test_function: Optional[callable] = None
    ) -> str:
        """
        Full ACE optimization loop: Generate → Test → Reflect → Curate → Repeat

        Args:
            task_domain: Humanitarian domain to optimize for
            test_function: Function to test context (returns List[Dict])

        Returns:
            Final optimized context
        """
        logger.info(f"Starting ACE optimization for {task_domain}")
        logger.info(f"Maximum iterations: {self.max_iterations}")

        # Step 1: Generate initial context
        current_context = self.generate_initial_context(task_domain)

        # If no test function provided, return initial context
        if test_function is None:
            logger.warning("No test function provided. Returning initial context.")
            return current_context

        best_context = current_context
        best_accuracy = 0.0

        # Optimization loop
        for iteration in range(self.max_iterations):
            logger.info(f"\n{'='*60}")
            logger.info(f"ACE Optimization Iteration {iteration + 1}/{self.max_iterations}")
            logger.info(f"{'='*60}\n")

            # Test current context
            logger.info("Testing current context...")
            test_results = test_function(current_context)

            # Reflect on performance
            reflection = self.reflect_on_performance(
                current_context,
                test_results,
                iteration
            )

            # Track best context
            if reflection['accuracy'] > best_accuracy:
                best_accuracy = reflection['accuracy']
                best_context = current_context
                logger.info(f"New best accuracy: {best_accuracy:.1f}%")

            # Check if we've reached good enough performance
            if reflection['accuracy'] >= 90.0:
                logger.info(f"Reached target accuracy ({reflection['accuracy']:.1f}%). Stopping optimization.")
                break

            # Curate improved context for next iteration
            if iteration < self.max_iterations - 1:
                current_context = self.curate_improved_context(
                    current_context,
                    reflection,
                    iteration
                )

        # Save final playbook
        self._save_playbook(best_context, best_accuracy)

        logger.info(f"\nACE Optimization Complete!")
        logger.info(f"Best accuracy achieved: {best_accuracy:.1f}%")
        logger.info(f"Total iterations: {len(self.context_history)}")

        return best_context

    def _save_context(self, context_data: Dict[str, Any], filename: str):
        """Save context to file."""
        filepath = self.contexts_dir / filename
        with open(filepath, 'w') as f:
            json.dump(context_data, f, indent=2)
        logger.debug(f"Saved context to {filepath}")

    def _save_reflection(self, reflection: Dict[str, Any], filename: str):
        """Save reflection to file."""
        filepath = self.contexts_dir / filename
        with open(filepath, 'w') as f:
            json.dump(reflection, f, indent=2)
        logger.debug(f"Saved reflection to {filepath}")

    def _save_playbook(self, context: str, accuracy: float):
        """Save final optimized context as playbook."""
        playbook = {
            'version': '1.0',
            'created': datetime.now().isoformat(),
            'accuracy': accuracy,
            'iterations': len(self.context_history),
            'context': context,
            'optimization_history': self.context_history
        }

        filepath = self.playbooks_dir / 'humanitarian_playbook.json'
        with open(filepath, 'w') as f:
            json.dump(playbook, f, indent=2)

        logger.info(f"Saved final playbook to {filepath}")


def main():
    """Example usage of ACE Context Optimizer."""
    import argparse

    parser = argparse.ArgumentParser(description='ACE Context Optimization')
    parser.add_argument('--domain', default='crisis_response', help='Task domain')
    parser.add_argument('--iterations', type=int, default=5, help='Max iterations')
    parser.add_argument('--model', default='llama3.3:8b', help='Ollama model')

    args = parser.parse_args()

    # Initialize optimizer
    optimizer = ACEContextOptimizer(
        model=args.model,
        max_iterations=args.iterations
    )

    # Generate initial context (no testing for demo)
    context = optimizer.generate_initial_context(task_domain=args.domain)

    print("\n" + "="*60)
    print("Generated Initial Context:")
    print("="*60)
    print(context)
    print("\n")
    print(f"Context saved to: {optimizer.contexts_dir}/initial_context.json")


if __name__ == '__main__':
    main()
