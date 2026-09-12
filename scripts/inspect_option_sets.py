import json
from collections import defaultdict

ROUND_FILES = [
    "scripts/data/round1_quick_quiz.json",
    "scripts/data/round2_pattern.json",
    "scripts/data/round3_memory.json",
    "scripts/data/round4_accuracy.json",
    "scripts/data/round5_speed.json"
]

by_options = defaultdict(list)
total = 0
for rf in ROUND_FILES:
    with open(rf, 'r', encoding='utf-8') as f:
        data = json.load(f)
    for q in data:
        total += 1
        key = tuple(sorted(str(o).strip().lower() for o in q['options'])) + (str(q['correct_answer']).strip().lower(),)
        by_options[key].append(q)

duplicates = {k: v for k, v in by_options.items() if len(v) > 1}
print(f'Total questions across all 5 rounds: {total}')
print(f'Duplicate option sets across all rounds: {len(duplicates)}')
for k, v in duplicates.items():
    print(f"\nKey: {k}")
    for q in v:
        print(f"  [{q['round_type']}] Prompt: {q['prompt']} | Ans: {q['correct_answer']} | Options: {q['options']}")
