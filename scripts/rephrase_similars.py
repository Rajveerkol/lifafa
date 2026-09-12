import json

rephrasings = {
    'q_0332': 'Identify the succeeding letter in reverse order: Q, N, K, H, ?',
    'q_0365': 'Identify the successive alphanumeric term: 8Z, 7Y, 6X, 5W, ?',
    'q_0450': 'Given the rule: 2 $ 3 = 7, 3 $ 4 = 13, 4 $ 5 = 21. Compute 5 $ 6:',
    'q_0462': 'Rule discovery: 2 @ 5 = 29, 3 @ 4 = 25, 4 @ 5 = 41. Determine 5 @ 6:',
    'q_0463': 'Operator logic: 4 # 2 = 8, 6 # 3 = 18, 8 # 4 = 32. Solve for 10 # 5:',
    'q_0465': 'Find the operator pattern: 4 & 2 = 24, 6 & 3 = 36, 8 & 4 = 48. Then 10 & 5 = ?',
    'q_0487': 'Observe the aerospace sequence: [🚀, 🛰️, 🛸, 🪐]. Select the matching exact order:',
    'q_0698': 'Recall the awards: [1st = Gold medal, 2nd = Silver medal, 3rd = Bronze medal, 4th = Certificate]. Which prize was 3rd?',
    'q_0633': 'Inspect the code [9, 4, 2, 7, 1]: which digit appeared in the 5th position?',
    'q_0629': 'Recall the sequence [7, 0, 7, 0, 7]: What was the 4th digit?',
    'q_0719': 'Solve the nested expression: 2 × [15 - 3 × (8 - 6)]',
    'q_0713': 'Find the exact value of: 3 × (4 + 5) - 2 × (6 - 1)',
    'q_0727': 'Find 35% of 400:',
    'q_0734': 'Compute: 4 × (10 - 2) - 3 × (7 - 4)',
    'q_0754': 'Convert 1.85 meters into centimeters (cm):',
    'q_0771': 'How many degrees Celsius (°C) is 212°F equal to?',
    'q_0776': 'What is 50°F expressed in Celsius (°C)?',
    'q_0861': 'In the periodic table, Carbon (C) has which atomic number?',
    'q_0875': 'Which atomic number corresponds to Platinum (Pt)?',
    'q_0879': 'How many protons (atomic number) are in Potassium (K)?',
    'q_0869': 'Identify the atomic number of the noble gas Helium (He):',
    'q_0873': 'Determine the atomic number of Sodium (Na):',
    'q_0881': 'Calcium (Ca) possesses what atomic number?',
    'q_0883': 'Select the correct atomic number for Aluminum (Al):',
    'q_0877': 'Chlorine (Cl) has an atomic number of:',
    'q_0950': 'Compute the product of 24 × 5:',
    'q_0966': 'Calculate: 15 × 8 = ?',
    'q_0959': 'Evaluate 180 divided by 9:',
    'q_0995': 'What is the result of 16 × 4?',
    'q_1002': 'Calculate the total when 18 is multiplied by 3:',
    'q_0993': 'Identify the prime number situated between 80 and 89:',
    'q_1003': 'Determine the value of 3 cubed (3³):',
    'q_1042': 'Find the best synonym for the word "DUBIOUS":'
}

with open('scripts/data/duel-question-bank.json', 'r', encoding='utf-8') as f:
    bank = json.load(f)

count = 0
for q in bank:
    if q['id'] in rephrasings:
        q['prompt'] = rephrasings[q['id']]
        count += 1

with open('scripts/data/duel-question-bank.json', 'w', encoding='utf-8') as f:
    json.dump(bank, f, indent=2, ensure_ascii=False)

print(f'Updated master bank with {count} rephrasings.')
