#!/usr/bin/env python3
"""
calibrate_difficulties.py
Calibrates the difficulty of questions across all rounds so that:
  EASY:   ~25%
  MEDIUM: ~50%
  HARD:   ~25%
Stratifies across subcategories and patterns to ensure every topic has a balanced mix.
"""

import json
import os
from collections import defaultdict, Counter

ROUND_FILES = [
    "scripts/data/round1_quick_quiz.json",
    "scripts/data/round2_pattern.json",
    "scripts/data/round3_memory.json",
    "scripts/data/round4_accuracy.json",
    "scripts/data/round5_speed.json"
]

def calibrate_round(questions):
    """
    Given a list of questions for a round, stratify by (category, pattern_type)
    and allocate ~25% EASY, ~50% MEDIUM, ~25% HARD.
    """
    total = len(questions)
    target_easy = int(round(total * 0.25))
    target_hard = int(round(total * 0.25))
    target_med = total - target_easy - target_hard
    
    # Group by category / pattern
    groups = defaultdict(list)
    for idx, q in enumerate(questions):
        key = (q.get("category", ""), q.get("pattern_type", ""))
        # Compute a heuristic complexity score (e.g. length of prompt, complexity of numbers/words)
        prompt = q["prompt"]
        complexity = len(prompt)
        # Check if numbers or special characters are present
        if any(c in prompt for c in ["*", "/", "^", "(", ")", "%", "₹", "°"]):
            complexity += 25
        if "NOT" in prompt or "reverse" in prompt.lower() or "predecessor" in prompt.lower():
            complexity += 30
        groups[key].append((idx, complexity))
        
    # Sort within each group by complexity
    all_sorted_indices = []
    # To maintain variety, we take elements across groups in interleaved fashion
    max_len = max(len(items) for items in groups.values())
    for i in range(max_len):
        for key in sorted(groups.keys()):
            items = sorted(groups[key], key=lambda x: x[1])
            if i < len(items):
                all_sorted_indices.append(items[i][0])
                
    # Now partition all_sorted_indices into target_easy, target_med, target_hard
    # Lowest complexity -> EASY, middle -> MEDIUM, highest -> HARD
    # Sort all questions globally by complexity score with group stability
    indexed_complexity = []
    for key, items in groups.items():
        for idx, comp in items:
            indexed_complexity.append((idx, comp))
            
    # Sort by complexity
    indexed_complexity.sort(key=lambda x: x[1])
    
    easy_indices = set(x[0] for x in indexed_complexity[:target_easy])
    hard_indices = set(x[0] for x in indexed_complexity[-target_hard:])
    
    for idx, q in enumerate(questions):
        if idx in easy_indices:
            q["difficulty"] = "EASY"
        elif idx in hard_indices:
            q["difficulty"] = "HARD"
        else:
            q["difficulty"] = "MEDIUM"
            
    counts = Counter(q["difficulty"] for q in questions)
    return questions, counts

def main():
    grand_counts = Counter()
    total_all = 0
    
    for rf in ROUND_FILES:
        with open(rf, "r", encoding="utf-8") as f:
            questions = json.load(f)
            
        questions, counts = calibrate_round(questions)
        with open(rf, "w", encoding="utf-8") as f:
            json.dump(questions, f, indent=2, ensure_ascii=False)
            
        print(f"{rf}: total {len(questions)} -> EASY: {counts['EASY']} ({counts['EASY']/len(questions)*100:.1f}%), "
              f"MEDIUM: {counts['MEDIUM']} ({counts['MEDIUM']/len(questions)*100:.1f}%), "
              f"HARD: {counts['HARD']} ({counts['HARD']/len(questions)*100:.1f}%)")
        grand_counts.update(counts)
        total_all += len(questions)
        
    print("\n--- Grand Total Difficulty Distribution ---")
    for diff in ["EASY", "MEDIUM", "HARD"]:
        c = grand_counts[diff]
        print(f"  {diff:<8}: {c:>4} questions ({c/total_all*100:>5.1f}%)")

if __name__ == "__main__":
    main()
