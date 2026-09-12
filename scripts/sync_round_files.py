import json

with open('scripts/data/duel-question-bank.json', 'r', encoding='utf-8') as f:
    bank = json.load(f)

round_map = {
    'QUICK_QUIZ': 'scripts/data/round1_quick_quiz.json',
    'PATTERN': 'scripts/data/round2_pattern.json',
    'MEMORY': 'scripts/data/round3_memory.json',
    'ACCURACY': 'scripts/data/round4_accuracy.json',
    'SPEED': 'scripts/data/round5_speed.json'
}

round_data = {r: [] for r in round_map}
for q in bank:
    round_data[q['round_type']].append(q)

for r, path in round_map.items():
    with open(path, 'w', encoding='utf-8') as f:
        json.dump(round_data[r], f, indent=2, ensure_ascii=False)
    print(f'Saved {len(round_data[r])} questions to {path}')
