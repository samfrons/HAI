#!/usr/bin/env python3
"""
Enhance HAI-CD training data with HAI's comprehensive knowledge base

Combines:
- HAI-CD's 10 base humanitarian Q&A
- HAI's 83 training examples from CLEAR
- HAI's 333 humanitarian terminology entries

Result: 400+ high-quality training examples
"""

import json
import sys
from pathlib import Path
from datetime import datetime

def load_hai_knowledge():
    """Load HAI's extracted knowledge base."""
    hai_knowledge_path = Path("../hai/data/processed/humanitarian_knowledge.jsonl")

    if not hai_knowledge_path.exists():
        print(f"⚠️  HAI knowledge base not found at {hai_knowledge_path}")
        print("Run: cd ../hai && python3 scripts/extract_humanitarian_knowledge.py")
        return []

    training_examples = []
    with open(hai_knowledge_path, 'r') as f:
        for line in f:
            example = json.loads(line)
            training_examples.append(example)

    print(f"✓ Loaded {len(training_examples)} examples from HAI knowledge base")
    return training_examples

def load_hai_cd_data():
    """Load existing HAI-CD training data."""
    base_data_path = Path("humanitarian_base_dataset.json")

    if not base_data_path.exists():
        print(f"⚠️  HAI-CD base data not found")
        return []

    with open(base_data_path, 'r') as f:
        data = json.load(f)

    print(f"✓ Loaded {len(data)} examples from HAI-CD base dataset")
    return data

def convert_to_chat_format(example):
    """Convert HAI examples to HAI-CD chat format."""
    if 'messages' in example:
        # Already in chat format
        return example

    # Convert Q&A format to chat format
    question = example.get('question', '')
    answer = example.get('answer', '')
    category = example.get('category', 'general')

    return {
        'messages': [
            {
                'role': 'user',
                'content': question
            },
            {
                'role': 'assistant',
                'content': answer
            }
        ],
        'category': category,
        'source': example.get('source', 'HAI_knowledge_base')
    }

def merge_datasets():
    """Merge HAI and HAI-CD datasets."""
    print("\n" + "="*60)
    print("Enhancing HAI-CD with HAI Knowledge Base")
    print("="*60 + "\n")

    # Load both datasets
    hai_examples = load_hai_knowledge()
    haicd_examples = load_hai_cd_data()

    if not hai_examples:
        print("\n⚠️  Skipping enhancement - HAI knowledge base not available")
        return False

    # Convert HAI examples to chat format
    print("\nConverting HAI examples to chat format...")
    hai_converted = [convert_to_chat_format(ex) for ex in hai_examples]

    # Merge datasets
    combined = haicd_examples + hai_converted

    print(f"\n📊 Dataset Statistics:")
    print(f"  HAI-CD base:        {len(haicd_examples)} examples")
    print(f"  HAI knowledge:      {len(hai_converted)} examples")
    print(f"  Combined total:     {len(combined)} examples")

    # Create train/val/test splits (simple random shuffle)
    import random

    random.seed(42)  # For reproducibility
    shuffled = combined.copy()
    random.shuffle(shuffled)

    train_size = 0.85
    val_size = 0.10
    # test_size = 0.05 (remaining)

    total = len(shuffled)
    train_end = int(total * train_size)
    val_end = train_end + int(total * val_size)

    train_data = shuffled[:train_end]
    val_data = shuffled[train_end:val_end]
    test_data = shuffled[val_end:]

    print(f"\n📋 Splits:")
    print(f"  Training:   {len(train_data)} examples ({len(train_data)/len(combined)*100:.1f}%)")
    print(f"  Validation: {len(val_data)} examples ({len(val_data)/len(combined)*100:.1f}%)")
    print(f"  Test:       {len(test_data)} examples ({len(test_data)/len(combined)*100:.1f}%)")

    # Save enhanced datasets
    print(f"\n💾 Saving enhanced datasets...")

    # Backup original files
    backup_suffix = datetime.now().strftime('%Y%m%d_%H%M%S')
    for filename in ['humanitarian_base_dataset.json', 'train_dataset.json', 'val_dataset.json', 'test_dataset.json']:
        if Path(filename).exists():
            backup_name = f"{filename}.backup_{backup_suffix}"
            Path(filename).rename(backup_name)
            print(f"  ✓ Backed up {filename} to {backup_name}")

    # Save new files
    with open('humanitarian_base_dataset.json', 'w') as f:
        json.dump(combined, f, indent=2)

    with open('train_dataset.json', 'w') as f:
        json.dump(train_data, f, indent=2)

    with open('val_dataset.json', 'w') as f:
        json.dump(val_data, f, indent=2)

    with open('test_dataset.json', 'w') as f:
        json.dump(test_data, f, indent=2)

    # Update dataset summary
    summary = {
        'total_samples': len(combined),
        'train_samples': len(train_data),
        'val_samples': len(val_data),
        'test_samples': len(test_data),
        'sources': {
            'hai_cd_base': len(haicd_examples),
            'hai_knowledge': len(hai_converted)
        },
        'enhanced_date': datetime.now().isoformat(),
        'format': 'chat'
    }

    with open('dataset_summary.json', 'w') as f:
        json.dump(summary, f, indent=2)

    print(f"\n✅ Enhancement complete!")
    print(f"\nNew datasets saved:")
    print(f"  - humanitarian_base_dataset.json ({len(combined)} examples)")
    print(f"  - train_dataset.json ({len(train_data)} examples)")
    print(f"  - val_dataset.json ({len(val_data)} examples)")
    print(f"  - test_dataset.json ({len(test_data)} examples)")
    print(f"  - dataset_summary.json (metadata)")

    return True

if __name__ == '__main__':
    try:
        success = merge_datasets()
        sys.exit(0 if success else 1)
    except Exception as e:
        print(f"\n❌ Error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
