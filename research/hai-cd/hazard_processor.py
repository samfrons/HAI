"""
Hazard Mapping Data Processor
Converts your hazard mapping triggers into training data
"""

import pandas as pd
import json
from pathlib import Path
from typing import List, Dict


class HazardDataProcessor:
    """Process hazard mapping triggers into training format"""
    
    def __init__(self, data_dir: str = "./data"):
        self.data_dir = Path(data_dir)
        self.raw_dir = self.data_dir / "raw"
        self.processed_dir = self.data_dir / "processed"
    
    def load_hazard_excel(self, filepath: str) -> pd.DataFrame:
        """Load hazard mapping Excel file"""
        try:
            df = pd.read_excel(filepath)
            print(f"✓ Loaded {len(df)} rows from {filepath}")
            return df
        except Exception as e:
            print(f"Error loading Excel: {e}")
            return None
    
    def analyze_structure(self, df: pd.DataFrame):
        """Analyze the structure of hazard data"""
        print("\n📊 Data Structure Analysis:")
        print(f"  Rows: {len(df)}")
        print(f"  Columns: {list(df.columns)}")
        print(f"\n  Sample data:")
        print(df.head())
        print(f"\n  Data types:")
        print(df.dtypes)
    
    def convert_to_qa_format(self, df: pd.DataFrame, 
                            question_col: str = None,
                            answer_col: str = None) -> List[Dict]:
        """
        Convert hazard data to Q&A format
        
        You'll need to specify which columns contain questions/answers
        or this will auto-generate questions from the data
        """
        qa_pairs = []
        
        # If specific columns provided
        if question_col and answer_col:
            for idx, row in df.iterrows():
                if pd.notna(row[question_col]) and pd.notna(row[answer_col]):
                    qa_pairs.append({
                        "question": str(row[question_col]),
                        "answer": str(row[answer_col]),
                        "category": "hazard_mapping",
                        "source": "hazard_triggers"
                    })
        else:
            # Auto-generate Q&A from data
            # This is a template - customize based on your data structure
            
            for idx, row in df.iterrows():
                # Example: If you have hazard type and trigger columns
                # Customize this based on your actual columns
                
                row_dict = row.to_dict()
                
                # Generate descriptive Q&A
                question = f"What information do we have about this hazard scenario?"
                answer = self._format_row_as_answer(row_dict)
                
                qa_pairs.append({
                    "question": question,
                    "answer": answer,
                    "category": "hazard_mapping",
                    "source": "hazard_triggers",
                    "row_id": idx
                })
        
        return qa_pairs
    
    def _format_row_as_answer(self, row_dict: Dict) -> str:
        """Format a row as a comprehensive answer"""
        answer_parts = []
        
        for key, value in row_dict.items():
            if pd.notna(value):
                answer_parts.append(f"{key}: {value}")
        
        return "\n".join(answer_parts)
    
    def create_hazard_specific_questions(self, df: pd.DataFrame) -> List[Dict]:
        """
        Generate specific humanitarian questions based on hazard data
        Customize this based on your hazard mapping structure
        """
        qa_pairs = []
        
        # Template questions for different hazard scenarios
        question_templates = [
            "What are the early warning indicators for {hazard_type}?",
            "What immediate response actions are needed for {hazard_type}?",
            "What resources should be pre-positioned for {hazard_type}?",
            "What are the key vulnerabilities during {hazard_type}?",
            "How should we coordinate response to {hazard_type}?",
        ]
        
        # This is a template - customize based on your data
        # For example, if you have a 'hazard_type' column:
        if 'hazard_type' in df.columns or 'Hazard Type' in df.columns:
            hazard_col = 'hazard_type' if 'hazard_type' in df.columns else 'Hazard Type'
            
            for hazard_type in df[hazard_col].unique():
                if pd.isna(hazard_type):
                    continue
                    
                hazard_data = df[df[hazard_col] == hazard_type]
                
                for template in question_templates:
                    question = template.format(hazard_type=hazard_type)
                    answer = self._generate_answer_from_data(hazard_data)
                    
                    qa_pairs.append({
                        "question": question,
                        "answer": answer,
                        "category": "hazard_mapping",
                        "hazard_type": str(hazard_type),
                        "source": "hazard_triggers"
                    })
        
        return qa_pairs
    
    def _generate_answer_from_data(self, hazard_data: pd.DataFrame) -> str:
        """Generate a comprehensive answer from hazard data subset"""
        # Customize this based on your data structure
        
        answer = f"Based on hazard mapping data with {len(hazard_data)} relevant entries:\n\n"
        
        # Summarize key information
        for idx, row in hazard_data.head(3).iterrows():  # First 3 entries
            answer += f"- {row.to_dict()}\n"
        
        return answer
    
    def merge_with_training_data(self, hazard_qa: List[Dict]):
        """Merge hazard Q&A with existing training data"""
        
        # Load existing training data
        train_path = self.processed_dir / "train_dataset.json"
        
        if train_path.exists():
            with open(train_path) as f:
                existing_data = json.load(f)
        else:
            existing_data = []
        
        # Format hazard data
        system_prompt = """You are a humanitarian expert AI assistant specialized in crisis response, humanitarian standards, and emergency operations, with specific expertise in hazard mapping and early warning systems."""
        
        formatted_hazard = []
        for item in hazard_qa:
            formatted_hazard.append({
                "messages": [
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": item["question"]},
                    {"role": "assistant", "content": item["answer"]}
                ],
                "category": item.get("category", "hazard_mapping")
            })
        
        # Merge
        combined = existing_data + formatted_hazard
        
        # Save updated training data
        with open(train_path, 'w') as f:
            json.dump(combined, f, indent=2, ensure_ascii=False)
        
        print(f"\n✅ Merged {len(formatted_hazard)} hazard samples with {len(existing_data)} existing samples")
        print(f"   Total training samples: {len(combined)}")
        print(f"   Saved to: {train_path}")
        
        return train_path
    
    def save_hazard_dataset(self, qa_pairs: List[Dict], filename: str = "hazard_dataset.json"):
        """Save hazard dataset separately"""
        filepath = self.processed_dir / filename
        
        with open(filepath, 'w') as f:
            json.dump(qa_pairs, f, indent=2, ensure_ascii=False)
        
        print(f"✓ Saved hazard dataset: {filepath}")
        return filepath


def main():
    """Main processing flow"""
    
    print("="*60)
    print("HAZARD MAPPING DATA PROCESSOR")
    print("="*60)
    
    processor = HazardDataProcessor()
    
    # Check for hazard file
    hazard_file = Path("./data/raw/Hazard mapping  triggers.xlsx")
    
    if not hazard_file.exists():
        print(f"\n⚠️  Hazard file not found: {hazard_file}")
        print("\nTo process your hazard data:")
        print("1. Place 'Hazard mapping triggers.xlsx' in ./data/raw/")
        print("2. Run this script again: python src/hazard_processor.py")
        print("\nOr specify custom path:")
        print("   python src/hazard_processor.py --file /path/to/your/file.xlsx")
        return
    
    # Load and analyze
    df = processor.load_hazard_excel(hazard_file)
    
    if df is None:
        return
    
    processor.analyze_structure(df)
    
    print("\n" + "="*60)
    print("CONVERSION OPTIONS")
    print("="*60)
    print("""
Choose how to convert your data:

1. Auto-generate Q&A from all rows
   - Creates general questions about hazard scenarios
   - Good for structured data without explicit Q&A

2. Use specific columns as Q&A
   - Specify which columns contain questions and answers
   - Best if your data already has Q&A structure

3. Create hazard-specific questions
   - Generates targeted questions per hazard type
   - Requires hazard type categorization in data

Please review the data structure above and customize the
conversion in this script based on your specific columns.
    """)
    
    # For now, run auto-generation
    print("\nRunning auto-generation (Option 1)...")
    qa_pairs = processor.convert_to_qa_format(df)
    
    print(f"\n✓ Generated {len(qa_pairs)} Q&A pairs")
    
    # Save
    processor.save_hazard_dataset(qa_pairs)
    
    # Optionally merge with training data
    print("\nMerge with existing training data? (y/n)")
    # Auto-merge for now
    processor.merge_with_training_data(qa_pairs)
    
    print("\n" + "="*60)
    print("✅ PROCESSING COMPLETE")
    print("="*60)
    print("""
Your hazard data has been processed and integrated!

Next steps:
1. Review the generated Q&A pairs in data/processed/hazard_dataset.json
2. Customize the conversion if needed (edit this script)
3. Re-run training with enhanced dataset
4. Test model on hazard-specific scenarios

The model will now have your domain-specific hazard knowledge!
    """)


if __name__ == "__main__":
    import sys
    
    if len(sys.argv) > 1 and sys.argv[1] == '--help':
        print("""
Hazard Data Processor

Usage:
  python src/hazard_processor.py                    # Use default path
  python src/hazard_processor.py --file PATH        # Custom file path

The script will:
1. Load your hazard mapping Excel file
2. Analyze its structure
3. Convert to Q&A training format
4. Merge with existing training data

Customize the conversion logic based on your data structure.
        """)
    else:
        main()
