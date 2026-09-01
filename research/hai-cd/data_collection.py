"""
Data Collection Module for Humanitarian LLM PoC
Fetches free humanitarian datasets and processes them for training
"""

import pandas as pd
import json
import os
from typing import List, Dict, Any
from pathlib import Path


class HumanitarianDataCollector:
    """Collects and processes humanitarian datasets from free sources"""
    
    def __init__(self, data_dir: str = "./data"):
        self.data_dir = Path(data_dir)
        self.raw_dir = self.data_dir / "raw"
        self.processed_dir = self.data_dir / "processed"
        
        # Create directories
        self.raw_dir.mkdir(parents=True, exist_ok=True)
        self.processed_dir.mkdir(parents=True, exist_ok=True)
    
    def create_humanitarian_qa_pairs(self) -> List[Dict[str, str]]:
        """
        Create initial Q&A pairs based on humanitarian standards and frameworks.
        This provides the foundation before adding your custom data.
        """
        
        qa_pairs = []
        
        # Sphere Standards - foundational humanitarian principles
        sphere_standards = [
            {
                "question": "What are the core principles of humanitarian response?",
                "answer": "The core humanitarian principles are: 1) Humanity - human suffering must be addressed wherever it is found, 2) Impartiality - assistance based solely on need without discrimination, 3) Neutrality - humanitarian actors must not take sides in conflicts, and 4) Independence - humanitarian action must be autonomous from political, economic, military or other objectives.",
                "category": "humanitarian_principles",
                "context": "foundational"
            },
            {
                "question": "What is the minimum water requirement per person per day in emergency situations?",
                "answer": "According to Sphere Standards, the minimum water requirement is 15 liters per person per day for survival needs. This covers drinking, cooking, and basic hygiene. In the first phase of an emergency, 7.5-15 liters may be acceptable, but this should be increased to 15-20 liters as soon as possible.",
                "category": "water_sanitation",
                "context": "technical_standards"
            },
            {
                "question": "How should humanitarian organizations approach working with vulnerable populations?",
                "answer": "Organizations should: 1) Ensure meaningful participation of affected populations in decisions, 2) Apply a 'Do No Harm' approach to avoid creating additional risks, 3) Provide special protection and assistance to the most vulnerable (children, elderly, disabled, women), 4) Consider cultural contexts and local capacities, 5) Maintain confidentiality and informed consent, and 6) Establish accessible feedback and complaint mechanisms.",
                "category": "protection_principles",
                "context": "vulnerable_populations"
            },
            {
                "question": "What are the key indicators of food insecurity in crisis situations?",
                "answer": "Key indicators include: 1) Acute malnutrition rates (wasting) especially in children under 5, 2) Crude mortality rate exceeding 1 death per 10,000 people per day, 3) Access to food (availability, physical access, economic access), 4) Food consumption patterns and dietary diversity, 5) Livelihood coping strategies (selling assets, reducing meals), and 6) Hazards and vulnerabilities (conflict, displacement, market disruption).",
                "category": "food_security",
                "context": "assessment"
            },
            {
                "question": "How do you assess shelter needs after a natural disaster?",
                "answer": "Shelter assessment should cover: 1) Number and demographics of affected households, 2) Extent of damage (destroyed, severely damaged, moderately damaged), 3) Climate and environmental conditions, 4) Cultural preferences and local building practices, 5) Available local materials and skills, 6) Land availability and tenure issues, 7) Security and protection concerns, 8) Access to services (water, sanitation, health), and 9) Planned return or relocation intentions.",
                "category": "shelter",
                "context": "needs_assessment"
            }
        ]
        
        # Conflict & Crisis Response
        crisis_response = [
            {
                "question": "What are the immediate priorities in the first 72 hours of a humanitarian emergency?",
                "answer": "Immediate priorities include: 1) Life-saving medical care and trauma treatment, 2) Safe water provision (at minimum 7.5L/person/day initially), 3) Emergency shelter for displaced populations, 4) Food distribution to prevent acute hunger, 5) Sanitation facilities to prevent disease outbreak, 6) Security assessment and protection of civilians, 7) Rapid needs assessment to inform response, and 8) Coordination with local authorities and other responders.",
                "category": "emergency_response",
                "context": "acute_phase"
            },
            {
                "question": "How should humanitarian workers handle security risks in conflict zones?",
                "answer": "Security management should include: 1) Regular security assessments and updates, 2) Acceptance-based approach building relationships with all parties, 3) Maintaining strict neutrality and humanitarian principles, 4) Clear communication of humanitarian mandate to all actors, 5) Staff security training and briefings, 6) Contingency plans and evacuation procedures, 7) Secure communications systems, 8) Collaboration with UN security and local partners, and 9) Never taking unnecessary risks - suspending operations when too dangerous.",
                "category": "security",
                "context": "conflict_zones"
            },
            {
                "question": "What is the cluster system in humanitarian response?",
                "answer": "The cluster system is a coordination mechanism that organizes humanitarian response into sectors: Health, Nutrition, WASH (Water/Sanitation/Hygiene), Shelter, Protection, Education, Food Security, Emergency Telecommunications, Logistics, and Camp Coordination. Each cluster has a designated lead agency (often a UN agency) responsible for coordination, setting standards, identifying gaps, and ensuring accountability. This system improves coordination and reduces duplication.",
                "category": "coordination",
                "context": "humanitarian_architecture"
            }
        ]
        
        # Protection & Safeguarding
        protection = [
            {
                "question": "What are the core protection principles in humanitarian action?",
                "answer": "Core protection principles are: 1) Safety and dignity - do no harm through our actions, 2) Meaningful access - ensure people can access assistance without barriers or discrimination, 3) Accountability - establish mechanisms for feedback and complaints, 4) Participation - involve affected communities in decisions, 5) Non-discrimination - assist based on need without discrimination, and 6) Confidentiality - protect sensitive information about individuals.",
                "category": "protection",
                "context": "core_principles"
            },
            {
                "question": "How should humanitarian organizations prevent sexual exploitation and abuse?",
                "answer": "Organizations must: 1) Have clear policies prohibiting sexual exploitation and abuse (SEA), 2) Conduct mandatory training for all staff and partners, 3) Establish safe, confidential reporting mechanisms accessible to affected populations, 4) Conduct thorough background checks during recruitment, 5) Include SEA prevention in community awareness, 6) Investigate all allegations promptly and fairly, 7) Take appropriate disciplinary action, 8) Support survivors with services, and 9) Report to appropriate authorities and inter-agency mechanisms.",
                "category": "safeguarding",
                "context": "protection"
            }
        ]
        
        # Combine all categories
        qa_pairs.extend(sphere_standards)
        qa_pairs.extend(crisis_response)
        qa_pairs.extend(protection)
        
        return qa_pairs
    
    def format_for_training(self, qa_pairs: List[Dict[str, str]], 
                           format_type: str = "instruction") -> List[Dict[str, str]]:
        """
        Format Q&A pairs for instruction tuning
        
        Args:
            qa_pairs: List of question-answer dictionaries
            format_type: 'instruction' or 'chat' format
        """
        formatted_data = []
        
        system_prompt = """You are a humanitarian expert AI assistant specialized in crisis response, humanitarian standards, and emergency operations. You provide accurate, actionable guidance based on established frameworks like Sphere Standards, Core Humanitarian Standard, and protection principles. You prioritize the safety and dignity of affected populations."""
        
        for pair in qa_pairs:
            if format_type == "instruction":
                formatted_data.append({
                    "instruction": pair["question"],
                    "input": "",
                    "output": pair["answer"],
                    "system": system_prompt,
                    "category": pair.get("category", "general")
                })
            elif format_type == "chat":
                formatted_data.append({
                    "messages": [
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": pair["question"]},
                        {"role": "assistant", "content": pair["answer"]}
                    ],
                    "category": pair.get("category", "general")
                })
        
        return formatted_data
    
    def save_dataset(self, data: List[Dict], filename: str):
        """Save dataset to processed directory"""
        filepath = self.processed_dir / filename
        
        with open(filepath, 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
        
        print(f"✓ Saved {len(data)} samples to {filepath}")
        return filepath
    
    def create_initial_dataset(self) -> str:
        """Create the initial training dataset"""
        print("Creating initial humanitarian dataset...")
        
        # Generate base Q&A pairs
        qa_pairs = self.create_humanitarian_qa_pairs()
        print(f"✓ Generated {len(qa_pairs)} base Q&A pairs")
        
        # Format for training
        formatted_data = self.format_for_training(qa_pairs, format_type="chat")
        
        # Save dataset
        filepath = self.save_dataset(formatted_data, "humanitarian_base_dataset.json")
        
        # Also save a summary
        summary = {
            "total_samples": len(formatted_data),
            "categories": list(set(item["category"] for item in formatted_data)),
            "format": "chat",
            "created_date": pd.Timestamp.now().isoformat()
        }
        
        summary_path = self.processed_dir / "dataset_summary.json"
        with open(summary_path, 'w') as f:
            json.dump(summary, f, indent=2)
        
        print(f"\n✓ Dataset created successfully!")
        print(f"  - Samples: {summary['total_samples']}")
        print(f"  - Categories: {', '.join(summary['categories'])}")
        
        return str(filepath)


if __name__ == "__main__":
    # Create collector
    collector = HumanitarianDataCollector()
    
    # Generate initial dataset
    dataset_path = collector.create_initial_dataset()
    
    print(f"\n✅ Initial dataset ready at: {dataset_path}")
    print("\nNext steps:")
    print("1. Review the generated dataset")
    print("2. Add your custom hazard mapping data")
    print("3. Run synthetic data augmentation")
    print("4. Proceed with PETRI auditing setup")
