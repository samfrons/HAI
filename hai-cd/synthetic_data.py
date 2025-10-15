"""
Synthetic Data Generation for Humanitarian LLM
Uses Claude Haiku API efficiently to generate training data at low cost
"""

import json
import os
from typing import List, Dict
from pathlib import Path
import time


class SyntheticDataGenerator:
    """
    Generates synthetic humanitarian Q&A pairs using Claude API
    Uses Haiku for cost efficiency (~$0.25 per million input tokens)
    """
    
    def __init__(self, data_dir: str = "./data", api_key: str = None):
        self.data_dir = Path(data_dir)
        self.processed_dir = self.data_dir / "processed"
        self.synthetic_dir = self.data_dir / "synthetic"
        self.synthetic_dir.mkdir(parents=True, exist_ok=True)
        
        self.api_key = api_key or os.getenv("ANTHROPIC_API_KEY")
        self.token_count = 0
        self.max_tokens = 10_000_000  # 10M token budget
    
    def generate_synthetic_questions(self, base_topics: List[str], 
                                     variations_per_topic: int = 5) -> List[str]:
        """
        Generate question variations for each base topic
        Can be done without API first, then enhanced
        """
        question_templates = [
            "What are the best practices for {topic}?",
            "How should humanitarian workers handle {topic}?",
            "What are the key considerations when dealing with {topic}?",
            "What standards apply to {topic} in emergency response?",
            "How do you assess and respond to {topic} in crisis situations?",
            "What are common challenges with {topic} and how to address them?",
            "What coordination is needed for effective {topic}?",
            "How can we ensure quality and accountability in {topic}?",
            "What protection principles apply to {topic}?",
            "How do cultural factors affect {topic} in humanitarian response?"
        ]
        
        questions = []
        for topic in base_topics:
            for template in question_templates[:variations_per_topic]:
                questions.append(template.format(topic=topic))
        
        return questions
    
    def get_humanitarian_topics(self) -> List[str]:
        """Core humanitarian topics for synthetic data generation"""
        return [
            "water and sanitation in displacement camps",
            "food distribution in conflict zones",
            "emergency shelter after earthquakes",
            "healthcare delivery in refugee settings",
            "child protection in emergencies",
            "gender-based violence prevention",
            "cash transfer programming",
            "community engagement and accountability",
            "coordination with local authorities",
            "supply chain and logistics in remote areas",
            "nutrition programming for acute malnutrition",
            "psychosocial support for trauma survivors",
            "disability inclusion in humanitarian response",
            "emergency education services",
            "environmental health in camps",
            "disease outbreak preparedness",
            "protection of civilians in conflict",
            "humanitarian access negotiation",
            "needs assessment methodologies",
            "monitoring and evaluation in emergencies"
        ]
    
    def generate_local_synthetic_data(self, num_samples: int = 100) -> List[Dict]:
        """
        Generate synthetic data WITHOUT API calls first
        This creates question variations that we can enhance later
        """
        print(f"Generating {num_samples} synthetic samples locally...")
        
        topics = self.get_humanitarian_topics()
        variations_per_topic = max(1, num_samples // len(topics))
        
        questions = self.generate_synthetic_questions(topics, variations_per_topic)
        
        # Create placeholder dataset that can be enhanced with API later
        synthetic_data = []
        
        for i, question in enumerate(questions[:num_samples]):
            synthetic_data.append({
                "id": f"SYN_{i:04d}",
                "question": question,
                "answer": None,  # To be filled by API or model
                "method": "template_generation",
                "needs_enhancement": True
            })
        
        print(f"✓ Generated {len(synthetic_data)} questions")
        return synthetic_data
    
    def create_api_prompt_for_batch(self, questions: List[str]) -> str:
        """
        Create efficient batch prompt for Claude API
        Process multiple questions in one API call to save costs
        """
        prompt = """You are a humanitarian expert. For each question below, provide a detailed, accurate answer based on humanitarian standards (Sphere, CHS, protection principles).

Format your response as JSON array with this structure:
[
  {"question": "...", "answer": "...", "category": "..."},
  ...
]

Questions:
"""
        for i, q in enumerate(questions, 1):
            prompt += f"\n{i}. {q}"
        
        prompt += "\n\nProvide comprehensive, evidence-based answers following humanitarian principles."
        
        return prompt
    
    def enhance_with_api(self, synthetic_data: List[Dict], 
                        batch_size: int = 5) -> List[Dict]:
        """
        Enhance synthetic questions with actual answers using Claude API
        Processes in batches to minimize API calls
        
        NOTE: This requires ANTHROPIC_API_KEY to be set
        Set it with: export ANTHROPIC_API_KEY='your-key-here'
        """
        if not self.api_key:
            print("⚠️  No API key found. Skipping API enhancement.")
            print("   Set ANTHROPIC_API_KEY to enable answer generation.")
            return synthetic_data
        
        try:
            from anthropic import Anthropic
            client = Anthropic(api_key=self.api_key)
        except ImportError:
            print("⚠️  Anthropic package not installed. Run: pip install anthropic")
            return synthetic_data
        
        enhanced_data = []
        needs_answers = [item for item in synthetic_data if item["answer"] is None]
        
        print(f"\nEnhancing {len(needs_answers)} questions with Claude Haiku...")
        print(f"Processing in batches of {batch_size} (cost-efficient)")
        
        for i in range(0, len(needs_answers), batch_size):
            batch = needs_answers[i:i+batch_size]
            questions = [item["question"] for item in batch]
            
            prompt = self.create_api_prompt_for_batch(questions)
            
            try:
                # Use Haiku for cost efficiency
                response = client.messages.create(
                    model="claude-3-5-haiku-20241022",  
                    max_tokens=4096,
                    messages=[{"role": "user", "content": prompt}]
                )
                
                # Track token usage
                self.token_count += response.usage.input_tokens + response.usage.output_tokens
                
                # Parse response
                content = response.content[0].text
                
                # Try to extract JSON
                try:
                    # Find JSON array in response
                    start = content.find('[')
                    end = content.rfind(']') + 1
                    if start != -1 and end > start:
                        json_str = content[start:end]
                        answers = json.loads(json_str)
                        
                        for j, answer_data in enumerate(answers):
                            if j < len(batch):
                                batch[j]["answer"] = answer_data.get("answer", "")
                                batch[j]["category"] = answer_data.get("category", "general")
                                batch[j]["needs_enhancement"] = False
                                batch[j]["method"] = "api_enhanced"
                except json.JSONDecodeError:
                    print(f"  ⚠️  Could not parse JSON for batch {i//batch_size + 1}")
                    # Fall back to keeping questions without answers
                
                enhanced_data.extend(batch)
                
                # Progress update
                print(f"  Processed {min(i+batch_size, len(needs_answers))}/{len(needs_answers)} questions")
                print(f"  Token count: {self.token_count:,} / {self.max_tokens:,}")
                
                # Rate limiting
                time.sleep(1)
                
                # Budget check
                if self.token_count > self.max_tokens:
                    print("⚠️  Token budget reached. Stopping API calls.")
                    break
                    
            except Exception as e:
                print(f"  ⚠️  Error processing batch: {e}")
                enhanced_data.extend(batch)
                continue
        
        # Add items that didn't need enhancement
        enhanced_data.extend([item for item in synthetic_data if item["answer"] is not None])
        
        # Calculate cost (approximate)
        estimated_cost = (self.token_count / 1_000_000) * 0.50  # Rough estimate
        print(f"\n✓ Enhancement complete")
        print(f"  Tokens used: {self.token_count:,}")
        print(f"  Estimated cost: ${estimated_cost:.2f}")
        
        return enhanced_data
    
    def save_synthetic_dataset(self, data: List[Dict], filename: str):
        """Save synthetic dataset"""
        filepath = self.synthetic_dir / filename
        
        with open(filepath, 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
        
        print(f"✓ Saved to {filepath}")
        return filepath
    
    def create_full_synthetic_dataset(self, num_samples: int = 200,
                                     use_api: bool = False) -> str:
        """
        Create full synthetic dataset
        
        Args:
            num_samples: Number of synthetic samples to generate
            use_api: Whether to use Claude API for answer generation
        """
        print("="*60)
        print("SYNTHETIC DATA GENERATION")
        print("="*60)
        
        # Step 1: Generate questions locally (free)
        synthetic_data = self.generate_local_synthetic_data(num_samples)
        
        # Step 2: Optionally enhance with API
        if use_api:
            synthetic_data = self.enhance_with_api(synthetic_data, batch_size=5)
        else:
            print("\n⚠️  Skipping API enhancement (use_api=False)")
            print("   Questions generated, answers will be added during training")
        
        # Step 3: Save
        filepath = self.save_synthetic_dataset(synthetic_data, "synthetic_dataset.json")
        
        # Summary
        answered = sum(1 for item in synthetic_data if item.get("answer"))
        print(f"\n📊 Summary:")
        print(f"   Total samples: {len(synthetic_data)}")
        print(f"   With answers: {answered}")
        print(f"   Needs enhancement: {len(synthetic_data) - answered}")
        
        return str(filepath)


if __name__ == "__main__":
    import sys
    
    generator = SyntheticDataGenerator()
    
    # Check if API key is available
    has_api_key = os.getenv("ANTHROPIC_API_KEY") is not None
    
    print("Synthetic Data Generator")
    print(f"API Key available: {has_api_key}")
    
    if has_api_key:
        print("\nGenerating 50 samples with API enhancement...")
        filepath = generator.create_full_synthetic_dataset(
            num_samples=50,
            use_api=True
        )
    else:
        print("\nGenerating 200 question templates (no API needed)...")
        print("These can be enhanced later or used for training")
        filepath = generator.create_full_synthetic_dataset(
            num_samples=200,
            use_api=False
        )
    
    print(f"\n✅ Synthetic dataset ready: {filepath}")
