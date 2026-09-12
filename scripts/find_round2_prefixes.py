import json

with open('scripts/data/round2_pattern.json', 'r', encoding='utf-8') as f:
    data = json.load(f)

prefixes = [
    'Identify the next number in the sequence:',
    'Find the next value:',
    'What is the next letter in the sequence:',
    'Find the next letter in the sequence:',
    'Complete the sequence:',
    'Identify the next letter:'
]

for i, q in enumerate(data):
    for pref in prefixes:
        if q['prompt'].startswith(pref):
            print(f"[{i}] {q['prompt']}")
