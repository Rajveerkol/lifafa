#!/usr/bin/env python3
"""
build_question_bank.py
Merges round JSON files into scripts/data/duel-question-bank.json,
assigns unique sequential IDs, and generates summary statistics.
"""

import json
import os
from collections import Counter

ROUND_FILES = [
    ("QUICK_QUIZ", "scripts/data/round1_quick_quiz.json"),
    ("PATTERN", "scripts/data/round2_pattern.json"),
    ("MEMORY", "scripts/data/round3_memory.json"),
    ("ACCURACY", "scripts/data/round4_accuracy.json"),
    ("SPEED", "scripts/data/round5_speed.json")
]

MASTER_OUTPUT = "scripts/data/duel-question-bank.json"

def main():
    combined = []
    round_counts = Counter()
    difficulty_counts = Counter()
    category_counts = Counter()
    
    question_idx = 1
    
    for expected_round, file_path in ROUND_FILES:
        if not os.path.exists(file_path):
            raise FileNotFoundError(f"Missing round file: {file_path}")
            
        with open(file_path, "r", encoding="utf-8") as f:
            questions = json.load(f)
            
        print(f"Loaded {len(questions)} questions from {file_path}")
        
        for q in questions:
            assert q["round_type"] == expected_round, f"Round mismatch in {file_path}: expected {expected_round}, got {q.get('round_type')}"
            assert len(q["options"]) == 4, f"Options length is not 4 in question: {q['prompt']}"
            assert q["correct_answer"] in q["options"], f"correct_answer not in options: {q['prompt']}"
            assert len(set(q["options"])) == 4, f"Duplicate options in question: {q['prompt']}"
            
            # Format record
            q_record = {
                "id": f"q_{question_idx:04d}",
                "round_type": q["round_type"],
                "prompt": q["prompt"].strip(),
                "options": [str(opt).strip() for opt in q["options"]],
                "correct_answer": str(q["correct_answer"]).strip(),
                "difficulty": q["difficulty"],
                "category": q["category"],
                "subcategory": q.get("subcategory", ""),
                "pattern_type": q.get("pattern_type", ""),
                "time_limit_sec": q.get("time_limit_sec", 25 if q["round_type"] != "ACCURACY" and q["round_type"] != "SPEED" else (20 if q["round_type"] == "ACCURACY" else 15)),
                "explanation": q.get("explanation", "").strip()
            }
            combined.append(q_record)
            round_counts[q_record["round_type"]] += 1
            difficulty_counts[q_record["difficulty"]] += 1
            category_counts[q_record["category"]] += 1
            question_idx += 1

    # Save master file
    os.makedirs(os.path.dirname(MASTER_OUTPUT), exist_ok=True)
    with open(MASTER_OUTPUT, "w", encoding="utf-8") as f:
        json.dump(combined, f, indent=2, ensure_ascii=False)
        
    print("\n" + "="*50)
    print("MASTER QUESTION BANK BUILD COMPLETE")
    print("="*50)
    print(f"Total Questions: {len(combined)}")
    print(f"Output saved to: {MASTER_OUTPUT}")
    
    print("\n--- Breakdown by Round Type ---")
    for rtype, count in round_counts.items():
        print(f"  {rtype:<12}: {count:>4} questions")
        
    print("\n--- Breakdown by Difficulty ---")
    total_q = len(combined)
    for diff in ["EASY", "MEDIUM", "HARD"]:
        count = difficulty_counts[diff]
        pct = (count / total_q) * 100
        print(f"  {diff:<10}: {count:>4} questions ({pct:>5.1f}%)")
        
    print("\n--- Breakdown by Category ---")
    for cat, count in category_counts.most_common():
        print(f"  {cat:<25}: {count:>4} questions")

if __name__ == "__main__":
    main()
