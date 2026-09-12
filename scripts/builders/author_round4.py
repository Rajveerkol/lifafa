# scripts/builders/author_round4.py
# Generates 225 diverse, verified ACCURACY questions
import json
import os

questions = []

def add_q(prompt, options, correct_answer, difficulty, category, subcategory, pattern_type, explanation, time_limit=20):
    assert len(options) == 4, f'Options count must be 4: {prompt}'
    assert len(set(options)) == 4, f'Options must be unique: {prompt}'
    assert correct_answer in options, f'Correct answer must be in options: {prompt}'
    assert difficulty in ['EASY', 'MEDIUM', 'HARD'], f'Invalid difficulty: {difficulty}'
    questions.append({
        'round_type': 'ACCURACY',
        'prompt': prompt,
        'options': options,
        'correct_answer': correct_answer,
        'difficulty': difficulty,
        'category': category,
        'subcategory': subcategory,
        'pattern_type': pattern_type,
        'time_limit_sec': time_limit,
        'explanation': explanation
    })

# --- PART 1: Mathematical Precision & Order of Operations (40) ---
add_q('Calculate with exact precision following standard order of operations: 18 - 3 × 4 + 6',
      ['10', '12', '14', '66'], '12', 'EASY', 'Mathematics', 'Arithmetic', 'PEMDAS Evaluation',
      'Multiplication takes precedence: 3 × 4 = 12. Then left-to-right: 18 - 12 = 6; 6 + 6 = 12.')
add_q('Evaluate with strict accuracy: 24 ÷ 4 × 2 + (8 - 3)',
      ['17', '8', '11', '14'], '17', 'MEDIUM', 'Mathematics', 'Arithmetic', 'PEMDAS Evaluation',
      'Parentheses first: (8 - 3) = 5. Left-to-right division/multiplication: 24 ÷ 4 = 6; 6 × 2 = 12. Finally: 12 + 5 = 17.')
add_q('Calculate the exact value of: 5² - 4 × (6 - 2) + 10 ÷ 2',
      ['14', '16', '18', '20'], '14', 'MEDIUM', 'Mathematics', 'Arithmetic', 'PEMDAS Evaluation',
      'Exponents: 5² = 25. Parentheses: (6 - 2) = 4. Multiplication: 4 × 4 = 16. Division: 10 ÷ 2 = 5. Result: 25 - 16 + 5 = 14.')
add_q('Determine the precise result of: 50 - 5 × (3 + 4) + 12',
      ['27', '327', '35', '37'], '27', 'EASY', 'Mathematics', 'Arithmetic', 'PEMDAS Evaluation',
      'Parentheses: 3 + 4 = 7. Multiplication: 5 × 7 = 35. Left-to-right: 50 - 35 = 15; 15 + 12 = 27.')
add_q('Evaluate precisely: 100 - (4 × 5² - 15) ÷ 5',
      ['83', '85', '87', '90'], '83', 'HARD', 'Mathematics', 'Arithmetic', 'PEMDAS Evaluation',
      'Inside parentheses: 5² = 25; 4 × 25 = 100; 100 - 15 = 85. Division: 85 ÷ 5 = 17. Subtraction: 100 - 17 = 83.')
add_q('Calculate the exact value: 7 × 8 - 42 ÷ 6 + 3',
      ['52', '54', '56', '58'], '52', 'EASY', 'Mathematics', 'Arithmetic', 'PEMDAS Evaluation',
      '7 × 8 = 56. 42 ÷ 6 = 7. 56 - 7 + 3 = 52.')
add_q('Evaluate with accuracy: (15 + 25) ÷ 8 × 3 - 5',
      ['10', '12', '15', '8'], '10', 'EASY', 'Mathematics', 'Arithmetic', 'PEMDAS Evaluation',
      'Parentheses: 15 + 25 = 40. Division: 40 ÷ 8 = 5. Multiplication: 5 × 3 = 15. Subtraction: 15 - 5 = 10.')
add_q('Determine the exact value of: 2³ + 3² × 2 - 14 ÷ 2',
      ['19', '21', '23', '25'], '19', 'MEDIUM', 'Mathematics', 'Arithmetic', 'PEMDAS Evaluation',
      'Powers: 2³ = 8, 3² = 9. Multiplication: 9 × 2 = 18. Division: 14 ÷ 2 = 7. Result: 8 + 18 - 7 = 19.')
add_q('Calculate precisely: 48 ÷ (2 × 3) + 4 × 5',
      ['28', '32', '36', '40'], '28', 'EASY', 'Mathematics', 'Arithmetic', 'PEMDAS Evaluation',
      'Parentheses: 2 × 3 = 6. Division: 48 ÷ 6 = 8. Multiplication: 4 × 5 = 20. Result: 8 + 20 = 28.')
add_q('Evaluate with strict precision: 12 + 6 × (14 - 4 × 3)²',
      ['36', '24', '48', '60'], '36', 'HARD', 'Mathematics', 'Arithmetic', 'PEMDAS Evaluation',
      'Inside parentheses: 4 × 3 = 12; 14 - 12 = 2. Square: 2² = 4. Multiplication: 6 × 4 = 24. Sum: 12 + 24 = 36.')
add_q('What is the exact product of 17 × 19?',
      ['313', '323', '333', '343'], '323', 'MEDIUM', 'Mathematics', 'Mental Arithmetic', 'Precision Calculation',
      '17 × 19 = (18 - 1)(18 + 1) = 18² - 1 = 324 - 1 = 323.')
add_q('What is the square of 25 evaluated precisely?',
      ['525', '625', '675', '725'], '625', 'EASY', 'Mathematics', 'Powers & Roots', 'Precision Calculation',
      '25 × 25 = 625.')
add_q('Calculate the exact value of: 144 ÷ 12 + 169 ÷ 13',
      ['23', '24', '25', '26'], '25', 'EASY', 'Mathematics', 'Arithmetic', 'Precision Calculation',
      '144 ÷ 12 = 12. 169 ÷ 13 = 13. 12 + 13 = 25.')
add_q('Evaluate precisely: 90 - (30 - (15 - 5))',
      ['60', '70', '80', '50'], '70', 'MEDIUM', 'Mathematics', 'Nested Brackets', 'PEMDAS Evaluation',
      'Innermost: 15 - 5 = 10. Next: 30 - 10 = 20. Outermost: 90 - 20 = 70.')
add_q('Calculate the exact value: 3 × (4 + 5) - 2 × (6 - 1)',
      ['17', '19', '21', '23'], '17', 'EASY', 'Mathematics', 'Arithmetic', 'PEMDAS Evaluation',
      '3 × 9 = 27. 2 × 5 = 10. 27 - 10 = 17.')
add_q('Evaluate with precision: (64 ÷ 8) × (81 ÷ 9) - 50',
      ['22', '24', '26', '28'], '22', 'EASY', 'Mathematics', 'Arithmetic', 'PEMDAS Evaluation',
      '8 × 9 = 72. 72 - 50 = 22.')
add_q('Calculate: 15% of 840 evaluated with exact precision',
      ['122', '124', '126', '128'], '126', 'MEDIUM', 'Mathematics', 'Percentages', 'Precision Calculation',
      '10% of 840 = 84; 5% = 42. 84 + 42 = 126.')
add_q('What is the exact value of 2⁸ (2 to the eighth power)?',
      ['128', '256', '512', '1024'], '256', 'EASY', 'Mathematics', 'Powers & Roots', 'Precision Calculation',
      '2⁸ = 256.')
add_q('Evaluate precisely: 75 ÷ 5 + 4 × 12 - 20',
      ['41', '43', '45', '47'], '43', 'MEDIUM', 'Mathematics', 'Arithmetic', 'PEMDAS Evaluation',
      '75 ÷ 5 = 15; 4 × 12 = 48. 15 + 48 = 63. 63 - 20 = 43.')
add_q('Calculate: (10 + 20 + 30 + 40) ÷ 4 with exact precision',
      ['22.5', '25', '27.5', '30'], '25', 'EASY', 'Mathematics', 'Averages', 'Precision Calculation',
      'Sum is 100. 100 ÷ 4 = 25.')
add_q('Evaluate with strict accuracy: 2 × [15 - 3 × (8 - 6)]',
      ['16', '18', '20', '24'], '18', 'MEDIUM', 'Mathematics', 'Nested Brackets', 'PEMDAS Evaluation',
      'Innermost: 8 - 6 = 2. Multiplication: 3 × 2 = 6. Subtraction: 15 - 6 = 9. Outer: 2 × 9 = 18.')
add_q('What is the exact square root of 576?',
      ['21', '24', '27', '29'], '24', 'MEDIUM', 'Mathematics', 'Powers & Roots', 'Precision Calculation',
      '24² = 576.')
add_q('Evaluate precisely: 30 - 2 × 5 + 16 ÷ 4',
      ['22', '24', '26', '28'], '24', 'EASY', 'Mathematics', 'Arithmetic', 'PEMDAS Evaluation',
      '2 × 5 = 10. 16 ÷ 4 = 4. 30 - 10 + 4 = 24.')
add_q('Calculate the exact product: 25 × 36',
      ['850', '900', '925', '950'], '900', 'EASY', 'Mathematics', 'Mental Arithmetic', 'Precision Calculation',
      '25 × 36 = 25 × 4 × 9 = 100 × 9 = 900.')
add_q('Evaluate with accuracy: 50 ÷ 2 × 5 - 100',
      ['25', '30', '35', '40'], '25', 'EASY', 'Mathematics', 'Arithmetic', 'PEMDAS Evaluation',
      'Left-to-right: 50 ÷ 2 = 25; 25 × 5 = 125. 125 - 100 = 25.')
add_q('Calculate the exact value: 3³ + 4³ + 5³',
      ['214', '216', '218', '225'], '216', 'HARD', 'Mathematics', 'Powers & Roots', 'Precision Calculation',
      '3³ = 27, 4³ = 64, 5³ = 125. 27 + 64 + 125 = 216 (which equals 6³).')
add_q('Evaluate precisely: (100 - 64) ÷ (3² - 5)',
      ['8', '9', '10', '12'], '9', 'MEDIUM', 'Mathematics', 'Arithmetic', 'PEMDAS Evaluation',
      'Numerator: 100 - 64 = 36. Denominator: 3² - 5 = 9 - 5 = 4. 36 ÷ 4 = 9.')
add_q('What is the exact value of 11³ (11 cubed)?',
      ['1221', '1331', '1441', '1321'], '1331', 'MEDIUM', 'Mathematics', 'Powers & Roots', 'Precision Calculation',
      '11³ = 121 × 11 = 1331.')
add_q('Calculate: 35% of 400 evaluated with exact precision',
      ['130', '135', '140', '145'], '140', 'EASY', 'Mathematics', 'Percentages', 'Precision Calculation',
      '35 × 4 = 140.')
add_q('Evaluate precisely: 18 ÷ 2 × (1 + 2)',
      ['3', '9', '27', '36'], '27', 'MEDIUM', 'Mathematics', 'Arithmetic', 'PEMDAS Evaluation',
      'Parentheses: 1 + 2 = 3. Left-to-right: 18 ÷ 2 = 9. 9 × 3 = 27.')
add_q('Calculate the exact value of: 100 - 4 × 20 + 35 ÷ 7',
      ['20', '25', '30', '35'], '25', 'EASY', 'Mathematics', 'Arithmetic', 'PEMDAS Evaluation',
      '4 × 20 = 80; 35 ÷ 7 = 5. 100 - 80 + 5 = 25.')
add_q('Evaluate: (20 - 5) × (12 - 8) - 15',
      ['40', '45', '50', '55'], '45', 'EASY', 'Mathematics', 'Arithmetic', 'PEMDAS Evaluation',
      '15 × 4 = 60. 60 - 15 = 45.')
add_q('What is the exact value of 15 × 16?',
      ['225', '230', '240', '250'], '240', 'EASY', 'Mathematics', 'Mental Arithmetic', 'Precision Calculation',
      '15 × 16 = 240.')
add_q('Evaluate precisely: 60 ÷ 5 × 2 + 18',
      ['36', '40', '42', '44'], '42', 'EASY', 'Mathematics', 'Arithmetic', 'PEMDAS Evaluation',
      '60 ÷ 5 = 12; 12 × 2 = 24. 24 + 18 = 42.')
add_q('Calculate the exact value of: 8² - 6² + 4²',
      ['40', '42', '44', '46'], '44', 'MEDIUM', 'Mathematics', 'Powers & Roots', 'Precision Calculation',
      '64 - 36 + 16 = 28 + 16 = 44.')
add_q('Evaluate with strict accuracy: 4 × (10 - 2) - 3 × (7 - 4)',
      ['21', '23', '25', '27'], '23', 'EASY', 'Mathematics', 'Arithmetic', 'PEMDAS Evaluation',
      '4 × 8 = 32. 3 × 3 = 9. 32 - 9 = 23.')
add_q('What is the exact cube of 7 (7³)?',
      ['323', '333', '343', '353'], '343', 'EASY', 'Mathematics', 'Powers & Roots', 'Precision Calculation',
      '7³ = 49 × 7 = 343.')
add_q('Calculate: 12.5% of 640 evaluated precisely',
      ['70', '75', '80', '85'], '80', 'MEDIUM', 'Mathematics', 'Percentages', 'Precision Calculation',
      '12.5% is 1/8. 640 ÷ 8 = 80.')
add_q('Evaluate precisely: (50 + 14) ÷ (2³)',
      ['2', '4', '8', '16'], '8', 'EASY', 'Mathematics', 'Arithmetic', 'PEMDAS Evaluation',
      '50 + 14 = 64; 2³ = 8. 64 ÷ 8 = 8.')
add_q('Calculate: 99 × 25 with exact accuracy',
      ['2450', '2475', '2485', '2500'], '2475', 'EASY', 'Mathematics', 'Mental Arithmetic', 'Precision Calculation',
      '(100 - 1) × 25 = 2500 - 25 = 2475.')

# --- PART 2: Exact Unit Conversions & Dimensional Analysis (40) ---
add_q('Convert exactly 72 kilometers per hour (km/h) into meters per second (m/s):',
      ['15 m/s', '18 m/s', '20 m/s', '25 m/s'], '20 m/s', 'MEDIUM', 'Science', 'Physics', 'Unit Conversion',
      'Multiply by 5/18: 72 × (5/18) = 4 × 5 = 20 m/s.')
add_q('How many seconds are in exactly one complete 24-hour day?',
      ['84,600 seconds', '86,400 seconds', '88,200 seconds', '90,000 seconds'], '86,400 seconds', 'EASY', 'Science', 'Time Units', 'Unit Conversion',
      '24 hours × 60 minutes × 60 seconds = 86,400 seconds.')
add_q('How many bytes are in exactly 1 Megabyte under standard binary prefix (1 MiB)?',
      ['1,000,000 bytes', '1,024,000 bytes', '1,048,576 bytes', '1,073,741 bytes'], '1,048,576 bytes', 'MEDIUM', 'Computers', 'Data Units', 'Unit Conversion',
      '1 MiB = 1024 × 1024 bytes = 1,048,576 bytes (2²⁰ bytes).')
add_q('Convert 100 degrees Celsius (°C) into degrees Fahrenheit (°F):',
      ['180°F', '200°F', '212°F', '220°F'], '212°F', 'EASY', 'Science', 'Thermodynamics', 'Unit Conversion',
      'F = (C × 9/5) + 32 = (100 × 1.8) + 32 = 180 + 32 = 212°F.')
add_q('How many milliliters (mL) are contained in exactly 3.75 liters?',
      ['375 mL', '3,750 mL', '37,500 mL', '375,000 mL'], '3,750 mL', 'EASY', 'Science', 'Volume', 'Unit Conversion',
      '1 liter = 1,000 mL. 3.75 × 1,000 = 3,750 mL.')
add_q('Convert 1 nautical mile into exact meters according to the international standard definition:',
      ['1,609 meters', '1,760 meters', '1,852 meters', '2,000 meters'], '1,852 meters', 'MEDIUM', 'Science', 'Navigation', 'Unit Conversion',
      'The international nautical mile is defined as exactly 1,852 meters.')
add_q('How many square meters (m²) are in exactly one hectare?',
      ['1,000 m²', '5,000 m²', '10,000 m²', '100,000 m²'], '10,000 m²', 'EASY', 'Mathematics', 'Area Units', 'Unit Conversion',
      '1 hectare = 100 meters × 100 meters = 10,000 m².')
add_q('Convert a speed of 54 km/h into meters per second (m/s):',
      ['12 m/s', '15 m/s', '18 m/s', '20 m/s'], '15 m/s', 'EASY', 'Science', 'Physics', 'Unit Conversion',
      '54 × (5/18) = 3 × 5 = 15 m/s.')
add_q('How many watts (W) are in one mechanical horsepower (hp) approximately?',
      ['720 W', '735.5 W', '745.7 W', '760 W'], '745.7 W', 'MEDIUM', 'Science', 'Physics', 'Unit Conversion',
      'One mechanical horsepower equals approximately 745.7 Watts.')
add_q('How many millimeters (mm) are in exactly 2.5 meters?',
      ['250 mm', '2,500 mm', '25,000 mm', '25 mm'], '2,500 mm', 'EASY', 'Science', 'Metric System', 'Unit Conversion',
      '1 meter = 1,000 mm. 2.5 × 1,000 = 2,500 mm.')
add_q('What is 0 Kelvin (-273.15°C) commonly referred to in thermodynamics?',
      ['Triple Point', 'Absolute Zero', 'Critical Point', 'Boyle Point'], 'Absolute Zero', 'EASY', 'Science', 'Thermodynamics', 'Concept Identification',
      'Absolute Zero (0 K or -273.15°C) is the theoretical temperature where enthalpy and entropy reach minimum values.')
add_q('How many grams (g) are in exactly 4.2 kilograms (kg)?',
      ['420 g', '4,200 g', '42,000 g', '420,000 g'], '4,200 g', 'EASY', 'Science', 'Metric System', 'Unit Conversion',
      '1 kg = 1,000 g. 4.2 × 1,000 = 4,200 g.')
add_q('A high-speed train travels at 90 km/h. What is its velocity in meters per second (m/s)?',
      ['20 m/s', '22.5 m/s', '25 m/s', '27.5 m/s'], '25 m/s', 'EASY', 'Science', 'Physics', 'Unit Conversion',
      '90 × (5/18) = 5 × 5 = 25 m/s.')
add_q('How many bits are in exactly 4 bytes of digital data?',
      ['16 bits', '24 bits', '32 bits', '64 bits'], '32 bits', 'EASY', 'Computers', 'Data Units', 'Unit Conversion',
      '1 byte = 8 bits. 4 × 8 = 32 bits.')
add_q('Convert 32 degrees Fahrenheit (°F) into degrees Celsius (°C):',
      ['0°C', '-10°C', '10°C', '32°C'], '0°C', 'EASY', 'Science', 'Thermodynamics', 'Unit Conversion',
      '32°F corresponds to the freezing point of water, which is exactly 0°C.')
add_q('How many centimeters (cm) are in exactly 1.85 meters?',
      ['18.5 cm', '185 cm', '1,850 cm', '18500 cm'], '185 cm', 'EASY', 'Science', 'Metric System', 'Unit Conversion',
      '1 meter = 100 cm. 1.85 × 100 = 185 cm.')
add_q('How many minutes are in exactly 3.5 hours?',
      ['180 minutes', '200 minutes', '210 minutes', '225 minutes'], '210 minutes', 'EASY', 'Science', 'Time Units', 'Unit Conversion',
      '3.5 × 60 = 210 minutes.')
add_q('How many milliliters (mL) are in 0.5 liters?',
      ['50 mL', '500 mL', '5,000 mL', '5 mL'], '500 mL', 'EASY', 'Science', 'Metric System', 'Unit Conversion',
      '0.5 × 1,000 = 500 mL.')
add_q('How many square feet (sq ft) are in one standard square yard?',
      ['3 sq ft', '6 sq ft', '9 sq ft', '12 sq ft'], '9 sq ft', 'EASY', 'Mathematics', 'Area Units', 'Unit Conversion',
      '1 yard = 3 feet, so 1 sq yard = 3 × 3 = 9 sq ft.')
add_q('How many meters are in exactly 5.5 kilometers?',
      ['550 m', '5,500 m', '55,000 m', '550,000 m'], '5,500 m', 'EASY', 'Science', 'Metric System', 'Unit Conversion',
      '5.5 × 1,000 = 5,500 meters.')
add_q('Convert 68°F into Celsius (°C):',
      ['15°C', '18°C', '20°C', '22°C'], '20°C', 'MEDIUM', 'Science', 'Thermodynamics', 'Unit Conversion',
      '(68 - 32) × (5/9) = 36 × (5/9) = 4 × 5 = 20°C.')
add_q('How many square centimeters (cm²) are in one square meter (m²)?',
      ['100 cm²', '1,000 cm²', '10,000 cm²', '100,000 cm²'], '10,000 cm²', 'MEDIUM', 'Mathematics', 'Area Units', 'Unit Conversion',
      '1 m = 100 cm. 1 m² = 100 × 100 = 10,000 cm².')
add_q('How many days are in a standard leap year?',
      ['364 days', '365 days', '366 days', '367 days'], '366 days', 'EASY', 'General Knowledge', 'Calendar', 'Direct Factual Recall',
      'A leap year contains 366 days due to the inclusion of February 29.')
add_q('How many centimeters (cm) are equivalent to one international inch (in)?',
      ['2.24 cm', '2.54 cm', '2.75 cm', '3.00 cm'], '2.54 cm', 'EASY', 'Science', 'Measurement Systems', 'Unit Conversion',
      '1 inch is defined as exactly 2.54 centimeters.')
add_q('How many Joules are equivalent to one calorie (thermochemical) approximately?',
      ['3.14 J', '4.184 J', '5.20 J', '9.81 J'], '4.184 J', 'MEDIUM', 'Science', 'Thermodynamics', 'Precision Value',
      'One calorie equals exactly 4.184 Joules.')
add_q('How many bytes are in exactly 8 Kilobytes (KB, decimal)?',
      ['800 bytes', '8,000 bytes', '80,000 bytes', '8,192 bytes'], '8,000 bytes', 'EASY', 'Computers', 'Data Units', 'Unit Conversion',
      'Under decimal SI prefix, 1 KB = 1,000 bytes; 8 KB = 8,000 bytes.')
add_q('Convert standard atmospheric pressure of 1 bar into kilopascals (kPa):',
      ['10 kPa', '50 kPa', '100 kPa', '101.3 kPa'], '100 kPa', 'MEDIUM', 'Science', 'Physics', 'Unit Conversion',
      '1 bar is defined as exactly 100,000 Pa = 100 kPa.')
add_q('How many inches are in exactly one foot?',
      ['10 inches', '12 inches', '14 inches', '16 inches'], '12 inches', 'EASY', 'Science', 'Measurement Systems', 'Unit Conversion',
      '1 foot equals exactly 12 inches.')
add_q('How many yards are in one statute mile?',
      ['1,500 yards', '1,650 yards', '1,760 yards', '1,820 yards'], '1,760 yards', 'MEDIUM', 'Science', 'Measurement Systems', 'Unit Conversion',
      '1 mile = 5,280 feet = 1,760 yards.')
add_q('How many millimeters (mm) are in 0.75 centimeters (cm)?',
      ['0.075 mm', '7.5 mm', '75 mm', '750 mm'], '7.5 mm', 'EASY', 'Science', 'Metric System', 'Unit Conversion',
      '1 cm = 10 mm. 0.75 × 10 = 7.5 mm.')
add_q('How many pounds (lbs) are approximately equivalent to 1 kilogram (kg)?',
      ['1.5 lbs', '2.0 lbs', '2.205 lbs', '2.5 lbs'], '2.205 lbs', 'EASY', 'Science', 'Measurement Systems', 'Unit Conversion',
      '1 kg is approximately 2.20462 lbs (≈ 2.205 lbs).')
add_q('How many micrograms (µg) are in 1 milligram (mg)?',
      ['10 µg', '100 µg', '1,000 µg', '10,000 µg'], '1,000 µg', 'EASY', 'Science', 'Metric System', 'Unit Conversion',
      '1 mg = 1,000 micrograms.')
add_q('Convert 212°F into Celsius (°C):',
      ['95°C', '100°C', '105°C', '110°C'], '100°C', 'EASY', 'Science', 'Thermodynamics', 'Unit Conversion',
      '212°F is the boiling point of water at sea level, which equals 100°C.')
add_q('How many milligrams (mg) are in 2.5 grams (g)?',
      ['250 mg', '2,500 mg', '25,000 mg', '250,000 mg'], '2,500 mg', 'EASY', 'Science', 'Metric System', 'Unit Conversion',
      '2.5 × 1,000 = 2,500 mg.')
add_q('How many fluid ounces (fl oz, US) are in one standard US liquid gallon?',
      ['64 fl oz', '96 fl oz', '128 fl oz', '160 fl oz'], '128 fl oz', 'MEDIUM', 'Science', 'Volume Units', 'Unit Conversion',
      '1 US gallon = 4 quarts = 8 pints = 16 cups = 128 fl oz.')
add_q('How many ounces (avoirdupois) are in one standard pound (lb)?',
      ['12 oz', '14 oz', '16 oz', '20 oz'], '16 oz', 'EASY', 'Science', 'Measurement Systems', 'Unit Conversion',
      '1 pound (lb) = 16 ounces (oz).')
add_q('How many cubic centimeters (cm³ or cc) are in exactly one liter?',
      ['100 cm³', '1,000 cm³', '10,000 cm³', '100,000 cm²'], '1,000 cm³', 'EASY', 'Science', 'Volume Units', 'Unit Conversion',
      '1 liter = 1 dm³ = 1,000 cm³.')
add_q('Convert 50°F into Celsius (°C):',
      ['8°C', '10°C', '12°C', '15°C'], '10°C', 'EASY', 'Science', 'Thermodynamics', 'Unit Conversion',
      '(50 - 32) × (5/9) = 18 × (5/9) = 10°C.')
add_q('How many seconds are in 2.5 hours?',
      ['7,200 seconds', '8,400 seconds', '9,000 seconds', '9,600 seconds'], '9,000 seconds', 'EASY', 'Science', 'Time Units', 'Unit Conversion',
      '2.5 × 3,600 = 9,000 seconds.')
add_q('Convert normal human core body temperature 37°C into degrees Fahrenheit (°F):',
      ['96.8°F', '97.6°F', '98.6°F', '99.2°F'], '98.6°F', 'EASY', 'Science', 'Biology', 'Unit Conversion',
      '37 × 1.8 + 32 = 66.6 + 32 = 98.6°F.')

# --- PART 3: English Spelling Precision & Orthography (35) ---
add_q('Select the correct spelling of the word meaning to provide lodging or make sufficient room for:',
      ['Accomodate', 'Acommodate', 'Accommodate', 'Acomodate'], 'Accommodate', 'MEDIUM', 'English', 'Spelling', 'Orthographic Precision',
      'Accommodate is spelled with double-c and double-m.')
add_q('Which option represents the correct orthography for close observation, especially of a suspected person?',
      ['Surveilance', 'Surveillance', 'Surveillence', 'Survalance'], 'Surveillance', 'MEDIUM', 'English', 'Spelling', 'Orthographic Precision',
      'Surveillance is spelled with double-l and ends in -ance.')
add_q('Choose the correct spelling for a special right or advantage granted only to a particular person or group:',
      ['Privilege', 'Privelege', 'Priviledge', 'Priveledge'], 'Privilege', 'EASY', 'English', 'Spelling', 'Orthographic Precision',
      'Privilege is spelled with -i- and no d.')
add_q('Identify the proper spelling for a set of printed questions devised for a survey or statistical study:',
      ['Questionaire', 'Questionnaire', 'Questionare', 'Questionnair'], 'Questionnaire', 'MEDIUM', 'English', 'Spelling', 'Orthographic Precision',
      'Questionnaire has double-n and ends in -aire.')
add_q('Which is the accurate spelling for causing someone to feel awkward, self-conscious, or ashamed?',
      ['Embarrass', 'Embarass', 'Emberrass', 'Embarras'], 'Embarrass', 'EASY', 'English', 'Spelling', 'Orthographic Precision',
      'Embarrass is spelled with double-r and double-s.')
add_q('Select the correct spelling for a particular event, time, or celebration:',
      ['Occasion', 'Ocassion', 'Occassion', 'Occation'], 'Occasion', 'EASY', 'English', 'Spelling', 'Orthographic Precision',
      'Occasion has double-c and single-s.')
add_q('Which option correctly spells the adjective describing playful troublemaking or teasing behavior?',
      ['Mischievous', 'Mischevious', 'Mischievious', 'Mischevous'], 'Mischievous', 'MEDIUM', 'English', 'Spelling', 'Orthographic Precision',
      'Mischievous has three syllables and no extra i before -ous.')
add_q('Identify the accurate spelling for a strong, regular repeated pattern of movement or sound in music:',
      ['Rhythm', 'Rythm', 'Rhythym', 'Rhytm'], 'Rhythm', 'EASY', 'English', 'Spelling', 'Orthographic Precision',
      'Rhythm is spelled R-H-Y-T-H-M.')
add_q('Which is the correct spelling for a system of government in which most decisions are taken by state officials?',
      ['Bureaucracy', 'Beurocracy', 'Burocracy', 'Bureacracy'], 'Bureaucracy', 'MEDIUM', 'English', 'Spelling', 'Orthographic Precision',
      'Bureaucracy begins with B-U-R-E-A-U.')
add_q('Select the proper spelling for a system in which members of an organization are ranked by status:',
      ['Hierarchy', 'Heirarchy', 'Hierachy', 'Hierarcy'], 'Hierarchy', 'MEDIUM', 'English', 'Spelling', 'Orthographic Precision',
      'Hierarchy begins with H-I-E.')
add_q('Which option is the accurate spelling for wishing to do what is right, especially to do work thoroughly?',
      ['Conscientious', 'Conscencious', 'Consciencous', 'Conscintious'], 'Conscientious', 'HARD', 'English', 'Spelling', 'Orthographic Precision',
      'Conscientious is spelled C-O-N-S-C-I-E-N-T-I-O-U-S.')
add_q('Identify the correct spelling for a period of one thousand years:',
      ['Millennium', 'Millenium', 'Milennium', 'Milennum'], 'Millennium', 'MEDIUM', 'English', 'Spelling', 'Orthographic Precision',
      'Millennium has double-l and double-n.')
add_q('Which is the accurate spelling for clearly stated, decided, or unambiguous?',
      ['Definite', 'Defanite', 'Defanit', 'Definate'], 'Definite', 'EASY', 'English', 'Spelling', 'Orthographic Precision',
      'Definite ends in -ite, not -ate.')
add_q('Select the correct spelling for the manner in which a spoken word or language is uttered:',
      ['Pronunciation', 'Pronounciation', 'Pronuntiation', 'Pronounciate'], 'Pronunciation', 'EASY', 'English', 'Spelling', 'Orthographic Precision',
      'Pronunciation has -nun-, unlike the verb pronounce.')
add_q('Which option correctly spells the process of preserving a condition or keeping equipment in good repair?',
      ['Maintenance', 'Maintainance', 'Maintenence', 'Maintanence'], 'Maintenance', 'MEDIUM', 'English', 'Spelling', 'Orthographic Precision',
      'Maintenance is spelled M-A-I-N-T-E-N-A-N-C-E.')
add_q('Identify the correct spelling for the action of moving or being parted from others:',
      ['Separation', 'Seperation', 'Separaton', 'Sepuration'], 'Separation', 'EASY', 'English', 'Spelling', 'Orthographic Precision',
      'Separation has an a after the p: S-E-P-A-R-A-T-I-O-N.')
add_q('Which is the accurate spelling for a person who sets up a business, taking on financial risks for profit?',
      ['Entrepreneur', 'Entreprenur', 'Enterpreneur', 'Entrepeneur'], 'Entrepreneur', 'MEDIUM', 'English', 'Spelling', 'Orthographic Precision',
      'Entrepreneur retains its French spelling: E-N-T-R-E-P-R-E-N-E-U-R.')
add_q('Select the proper spelling for an adjective meaning of immense, colossal, or gigantic size:',
      ['Gargantuan', 'Gargantun', 'Gargantion', 'Gargantuanne'], 'Gargantuan', 'MEDIUM', 'English', 'Spelling', 'Orthographic Precision',
      'Gargantuan is spelled G-A-R-G-A-N-T-U-A-N.')
add_q('Which option correctly spells the word describing an action resulting from lack of attention or unintentional?',
      ['Inadvertent', 'Inadvertant', 'Inadvertentt', 'Inadvertunt'], 'Inadvertent', 'MEDIUM', 'English', 'Spelling', 'Orthographic Precision',
      'Inadvertent ends in -ent.')
add_q('Identify the accurate spelling for steadfast persistence in doing something despite obstacles or delay:',
      ['Perseverance', 'Perseverence', 'Perseverencee', 'Persevirence'], 'Perseverance', 'MEDIUM', 'English', 'Spelling', 'Orthographic Precision',
      'Perseverance ends in -ance.')
add_q('Which is the correct spelling for a military commissioned officer rank just above second lieutenant?',
      ['Lieutenant', 'Leutenant', 'Lieutenent', 'Lietenant'], 'Lieutenant', 'HARD', 'English', 'Spelling', 'Orthographic Precision',
      'Lieutenant begins with L-I-E-U.')
add_q('Select the proper spelling for the use of materials or coloration for concealment and disguise:',
      ['Camouflage', 'Camoflage', 'Camoflauge', 'Camaflage'], 'Camouflage', 'MEDIUM', 'English', 'Spelling', 'Orthographic Precision',
      'Camouflage is spelled C-A-M-O-U-F-L-A-G-E.')
add_q('Which option correctly spells the noun referring to supreme power, autonomy, or authority of a nation?',
      ['Sovereignty', 'Soverignty', 'Soverenty', 'Soveriegnty'], 'Sovereignty', 'MEDIUM', 'English', 'Spelling', 'Orthographic Precision',
      'Sovereignty has -eign-.')
add_q('Identify the accurate spelling for substances that emit light when subjected to electromagnetic radiation:',
      ['Fluorescent', 'Flourescent', 'Florescent', 'Flourecent'], 'Fluorescent', 'HARD', 'English', 'Spelling', 'Orthographic Precision',
      'Fluorescent begins with F-L-U-O-R.')
add_q('Which is the correct spelling for a story told about a past event remembered by the narrator?',
      ['Reminiscence', 'Reminisence', 'Reminiscense', 'Reminescence'], 'Reminiscence', 'HARD', 'English', 'Spelling', 'Orthographic Precision',
      'Reminiscence contains -sc- and ends in -ence.')
add_q('Select the proper spelling for stating something as being greater, larger, or better than it really is:',
      ['Exaggerate', 'Exagerate', 'Exagerrate', 'Exaggerite'], 'Exaggerate', 'EASY', 'English', 'Spelling', 'Orthographic Precision',
      'Exaggerate has double-g and single-r.')
add_q('Which option correctly spells an event causing great and often sudden damage, ruin, or suffering?',
      ['Catastrophe', 'Catastrofe', 'Catastrophy', 'Catestrophe'], 'Catastrophe', 'EASY', 'English', 'Spelling', 'Orthographic Precision',
      'Catastrophe ends in -phe.')
add_q('Identify the accurate spelling for a situation in which a difficult choice has to be made between alternatives:',
      ['Dilemma', 'Dilemna', 'Dillema', 'Dilema'], 'Dilemma', 'EASY', 'English', 'Spelling', 'Orthographic Precision',
      'Dilemma has double-m and single-l.')
add_q('Which is the correct spelling for hostile, aggressive, or warlike demeanor?',
      ['Belligerent', 'Beligerent', 'Belligerant', 'Beligerant'], 'Belligerent', 'MEDIUM', 'English', 'Spelling', 'Orthographic Precision',
      'Belligerent has double-l and ends in -ent.')
add_q('Select the proper spelling for the medical action of treating with a vaccine to produce immunity:',
      ['Inoculate', 'Innoculate', 'Inocculate', 'Innocculate'], 'Inoculate', 'HARD', 'English', 'Spelling', 'Orthographic Precision',
      'Inoculate has single-n and single-c.')
add_q('Which option correctly spells side by side with equal distance continuously remaining between them?',
      ['Parallel', 'Paralell', 'Parrallel', 'Parralell'], 'Parallel', 'EASY', 'English', 'Spelling', 'Orthographic Precision',
      'Parallel has double-l in the middle and single-l at the end.')
add_q('Identify the accurate spelling for an inflammatory lung condition primarily affecting the microscopic air sacs:',
      ['Pneumonia', 'Neumonia', 'Pnumonia', 'Pneumona'], 'Pneumonia', 'EASY', 'English', 'Spelling', 'Orthographic Precision',
      'Pneumonia begins with silent P-N.')
add_q('Which is the correct spelling for something so delicate, understated, or precise as to be difficult to analyze?',
      ['Subtle', 'Suttle', 'Subtel', 'Subtule'], 'Subtle', 'EASY', 'English', 'Spelling', 'Orthographic Precision',
      'Subtle retains the silent b.')
add_q('Select the proper spelling for having a name that is unrevealed, undisclosed, or unknown by design:',
      ['Anonymous', 'Anonimous', 'Anonamous', 'Annonymous'], 'Anonymous', 'EASY', 'English', 'Spelling', 'Orthographic Precision',
      'Anonymous is spelled A-N-O-N-Y-M-O-U-S.')
add_q('Which option correctly spells taking the place of a person or thing previously in authority or use?',
      ['Supersede', 'Supercede', 'Superseed', 'Superceed'], 'Supersede', 'HARD', 'English', 'Spelling', 'Orthographic Precision',
      'Supersede is spelled with -sede (from Latin supersedere), not -cede.')

# --- PART 4: Grammatical Accuracy & Subject-Verb Agreement (35) ---
add_q('Identify the sentence that strictly adheres to correct subject-verb agreement:',
      ['The team of researchers are publishing their findings.', 'The team of researchers is publishing its findings.', 'The team of researchers have published its findings.', 'The team of researchers were publishing its findings.'],
      'The team of researchers is publishing its findings.', 'MEDIUM', 'English', 'Grammar', 'Grammatical Accuracy',
      'Collective noun "team" is singular, taking the singular verb "is" and pronoun "its".')
add_q('Identify the grammatically correct sentence:',
      ['Neither the teacher nor the students was present.', 'Neither the teacher nor the students were present.', 'Neither the teacher nor the students is present.', 'Neither the teacher nor the students has been present.'],
      'Neither the teacher nor the students were present.', 'MEDIUM', 'English', 'Grammar', 'Grammatical Accuracy',
      'In "neither... nor", the verb agrees with the closer subject ("students", plural -> "were").')
add_q('Which sentence correctly uses "fewer" versus "less"?',
      ['There are less people in the auditorium today.', 'There are fewer people in the auditorium today.', 'There is fewer water in the reservoir.', 'There is less apples in the basket.'],
      'There are fewer people in the auditorium today.', 'EASY', 'English', 'Grammar', 'Grammatical Accuracy',
      '"Fewer" is used for countable nouns (people); "less" is used for uncountable quantities.')
add_q('Identify the sentence with correct pronoun case:',
      ['Between you and I, this decision is final.', 'Between you and me, this decision is final.', 'Between you and myself, this decision is final.', 'Between him and I, this decision is final.'],
      'Between you and me, this decision is final.', 'MEDIUM', 'English', 'Grammar', 'Grammatical Accuracy',
      'Preposition "between" requires objective case pronouns ("me", not "I").')
add_q('Identify the grammatically flawless sentence:',
      ['Each of the participants have submitted their form.', 'Each of the participants has submitted his or her form.', 'Each of the participants were submitting their form.', 'Each of the participants are submitting their form.'],
      'Each of the participants has submitted his or her form.', 'MEDIUM', 'English', 'Grammar', 'Grammatical Accuracy',
      '"Each" is grammatically singular and requires the singular verb "has".')
add_q('Which sentence correctly utilizes the subjunctive mood?',
      ['I wish I was a bird.', 'I wish I were a bird.', 'I wish I am a bird.', 'I wish I be a bird.'],
      'I wish I were a bird.', 'EASY', 'English', 'Grammar', 'Grammatical Accuracy',
      'Hypothetical contrary-to-fact wishes require the subjunctive "were".')
add_q('Identify the sentence free of misplaced modifiers:',
      ['Walking to the store, the rain soaked John.', 'Walking to the store, John was soaked by the rain.', 'Walking to the store, the rain began to fall on John.', 'John, walking to the store, the rain fell.'],
      'Walking to the store, John was soaked by the rain.', 'HARD', 'English', 'Grammar', 'Grammatical Accuracy',
      'The subject doing the walking ("John") must immediately follow the introductory participial phrase.')
add_q('Which sentence demonstrates proper grammatical use of the objective pronoun "whom"?',
      ['Whom is speaking at the conference tomorrow?', 'To whom should this official letter be addressed?', 'Whom went to the market?', 'Whom made this delicious dessert?'],
      'To whom should this official letter be addressed?', 'EASY', 'English', 'Grammar', 'Grammatical Accuracy',
      '"Whom" is the objective case pronoun used as the object of preposition "to".')
add_q('Which sentence correctly avoids a dangling participle?',
      ['Having finished the assignment, the TV was turned on.', 'Having finished the assignment, the student turned on the TV.', 'Having finished the assignment, dinner was served.', 'Having finished the assignment, sleep was welcome.'],
      'Having finished the assignment, the student turned on the TV.', 'MEDIUM', 'English', 'Grammar', 'Grammatical Accuracy',
      '"The student" is the agent who finished the assignment, properly anchoring the participle.')
add_q('Which sentence successfully maintains parallel grammatical structure throughout?',
      ['She likes hiking, swimming, and to ride bicycles.', 'She likes hiking, swimming, and riding bicycles.', 'She likes to hike, swimming, and bicycle riding.', 'She likes hiking, to swim, and riding.'],
      'She likes hiking, swimming, and riding bicycles.', 'EASY', 'English', 'Grammar', 'Grammatical Accuracy',
      'Parallelism requires maintaining identical grammatical forms (all gerunds: hiking, swimming, riding).')
add_q('Identify the sentence with correct apostrophe usage:',
      ['The dogs wagged it\'s tails.', 'The dogs wagged its\' tails.', 'The dogs wagged their tails.', 'The dog\'s wagged their tails.'],
      'The dogs wagged their tails.', 'EASY', 'English', 'Grammar', 'Grammatical Accuracy',
      '"Their" is the correct possessive plural pronoun; "it\'s" is the contraction for "it is".')
add_q('Which sentence correctly distinguishes "affect" and "effect"?',
      ['The new policy will have a positive affect on productivity.', 'The weather did not effect our travel plans.', 'The new policy will have a positive effect on productivity.', 'The medicine had an immediate affect.'],
      'The new policy will have a positive effect on productivity.', 'MEDIUM', 'English', 'Grammar', 'Grammatical Accuracy',
      '"Effect" is typically a noun meaning result; "affect" is typically a verb meaning to influence.')
add_q('Which sentence correctly links independent clauses using a semicolon?',
      ['I have a big test tomorrow; therefore, I can\'t go to the movie.', 'I have a big test tomorrow, therefore; I can\'t go to the movie.', 'I have a big test tomorrow; and therefore, I can\'t go.', 'I have a big test tomorrow, therefore, I can\'t go;'],
      'I have a big test tomorrow; therefore, I can\'t go to the movie.', 'MEDIUM', 'English', 'Grammar', 'Grammatical Accuracy',
      'A semicolon joins two independent clauses linked by a conjunctive adverb ("therefore").')
add_q('Identify the sentence with correct subject-verb agreement for plural measurements:',
      ['Ten kilometers are a long distance to walk.', 'Ten kilometers is a long distance to walk.', 'Ten kilometers have been a long distance.', 'Ten kilometers were a long distance.'],
      'Ten kilometers is a long distance to walk.', 'MEDIUM', 'English', 'Grammar', 'Grammatical Accuracy',
      'Measurements of distance, time, and money viewed as a single quantity take singular verbs ("is").')
add_q('Which sentence correctly employs "its" vs "it\'s"?',
      ['The company announced it\'s quarterly earnings.', 'The cat licked it\'s paw.', 'It\'s raining heavily outside.', 'Every country must defend it\'s borders.'],
      'It\'s raining heavily outside.', 'EASY', 'English', 'Grammar', 'Grammatical Accuracy',
      '"It\'s" is the contraction for "It is"; possessive forms use "its".')
add_q('Identify the sentence that correctly uses "lay" vs "lie":',
      ['I am going to lay down on the bed for an hour.', 'I am going to lie down on the bed for an hour.', 'Yesterday, he laid in bed all morning.', 'The book was laying on the table.'],
      'I am going to lie down on the bed for an hour.', 'HARD', 'English', 'Grammar', 'Grammatical Accuracy',
      '"Lie" is intransitive (recline); "lay" is transitive (place something down).')
add_q('Identify the sentence with correct verb tense consistency:',
      ['When the bell rang, the students pack their bags and left.', 'When the bell rang, the students packed their bags and left.', 'When the bell rings, the students packed their bags.', 'When the bell rang, the students are packing.'],
      'When the bell rang, the students packed their bags and left.', 'EASY', 'English', 'Grammar', 'Grammatical Accuracy',
      'All verbs must consistently remain in past tense: rang, packed, left.')
add_q('Which sentence correctly uses "allusion" vs "illusion"?',
      ['The magician created an optical allusion.', 'The poem contains an allusion to Greek mythology.', 'Mirages in deserts are optical allusions.', 'He was under the allusion that he won.'],
      'The poem contains an allusion to Greek mythology.', 'EASY', 'English', 'Grammar', 'Grammatical Accuracy',
      '"Allusion" means an indirect reference; "illusion" means a deceptive appearance.')
add_q('Identify the sentence that correctly handles correlative conjunctions:',
      ['He not only lost his ticket but also his passport.', 'He lost not only his ticket but also his passport.', 'He not only lost his ticket but his passport too.', 'He lost not only his ticket but his passport.'],
      'He lost not only his ticket but also his passport.', 'HARD', 'English', 'Grammar', 'Grammatical Accuracy',
      'Correlative conjunctions must balance parallel parts of speech: "not only [noun] but also [noun]".')
add_q('Identify the sentence with correct comparative adjective usage:',
      ['Of the two sisters, Maya is the tallest.', 'Of the two sisters, Maya is the taller.', 'Of the two sisters, Maya is more tall.', 'Of the two sisters, Maya is most tall.'],
      'Of the two sisters, Maya is the taller.', 'MEDIUM', 'English', 'Grammar', 'Grammatical Accuracy',
      'When comparing exactly two items, use the comparative ("taller"), not the superlative ("tallest").')
add_q('Which sentence demonstrates correct collective noun agreement with singular intent?',
      ['The committee has reached their decision.', 'The committee has reached its decision.', 'The committee have reached its decision.', 'The committee are reaching its decision.'],
      'The committee has reached its decision.', 'EASY', 'English', 'Grammar', 'Grammatical Accuracy',
      'Singular collective noun "committee" takes singular verb "has" and pronoun "its".')
add_q('Select the sentence that accurately uses the transitive verb "comprise":',
      ['The team is comprised of eleven players.', 'The team comprises eleven players.', 'Eleven players comprises the team.', 'The team is comprising of eleven players.'],
      'The team comprises eleven players.', 'HARD', 'English', 'Grammar', 'Grammatical Accuracy',
      '"The whole comprises the parts." The phrase "is comprised of" is traditionally discouraged in formal syntax.')
add_q('Identify the sentence with correct relative pronoun usage:',
      ['The man which called yesterday was polite.', 'The man whom called yesterday was polite.', 'The man who called yesterday was polite.', 'The man whose called yesterday was polite.'],
      'The man who called yesterday was polite.', 'EASY', 'English', 'Grammar', 'Grammatical Accuracy',
      '"Who" is the subject relative pronoun referring to persons.')
add_q('Which sentence correctly uses "principal" vs "principle"?',
      ['The school principle addressed the assembly.', 'He refuses to compromise his moral principles.', 'The principle reason for his success was hard work.', 'The principle of the college was respected.'],
      'He refuses to compromise his moral principles.', 'EASY', 'English', 'Grammar', 'Grammatical Accuracy',
      '"Principle" refers to a fundamental truth or moral rule; "principal" refers to a school head or chief matter.')
add_q('Identify the sentence with correct comma placement with non-restrictive clause:',
      ['My brother who lives in London is a doctor.', 'My brother, who lives in London, is a doctor.', 'My brother who lives in London, is a doctor.', 'My brother, who lives in London is a doctor.'],
      'My brother, who lives in London, is a doctor.', 'MEDIUM', 'English', 'Grammar', 'Grammatical Accuracy',
      'Non-restrictive relative clauses providing supplementary information are bracketed by paired commas.')
add_q('Choose the sentence that displays a flawless third conditional structure:',
      ['If he would have studied, he would have passed.', 'If he had studied, he would have passed.', 'If he studied, he would have passed.', 'If he had studied, he would pass.'],
      'If he had studied, he would have passed.', 'MEDIUM', 'English', 'Grammar', 'Grammatical Accuracy',
      'Third conditional requires "if + past perfect, would have + past participle".')
add_q('Which sentence correctly uses "stationary" vs "stationery"?',
      ['The weather front remained stationery for three days.', 'She wrote the letter on elegant personal stationery.', 'The stationery bicycle in the gym was broken.', 'The car was stationery at the red traffic signal.'],
      'She wrote the letter on elegant personal stationery.', 'EASY', 'English', 'Grammar', 'Grammatical Accuracy',
      '"Stationery" with an -e refers to writing paper/pens; "stationary" with an -a means immobile.')
add_q('Identify the sentence with correct use of "either":',
      ['Either of the two routes are safe.', 'Either of the two routes is safe.', 'Either of the two routes were safe.', 'Either of the two routes have been safe.'],
      'Either of the two routes is safe.', 'MEDIUM', 'English', 'Grammar', 'Grammatical Accuracy',
      '"Either" as a pronoun is singular and requires the singular verb "is".')
add_q('Which sentence correctly uses the subjective pronoun after the comparative conjunction than?',
      ['He is taller than me.', 'He is taller than I.', 'He is taller then I.', 'He is more tall than me.'],
      'He is taller than I.', 'MEDIUM', 'English', 'Grammar', 'Grammatical Accuracy',
      'In formal grammar, "than I" is an elliptical construction for "than I am".')
add_q('Identify the sentence free of redundancy:',
      ['He returned back to his hometown.', 'He reverted back to his old habits.', 'He returned to his hometown.', 'The two twins look identical.'],
      'He returned to his hometown.', 'EASY', 'English', 'Grammar', 'Grammatical Accuracy',
      '"Returned back" is redundant because "return" already means to go back.')
add_q('Identify the sentence with correct collective noun agreement:',
      ['A flock of birds were flying overhead.', 'A flock of birds was flying overhead.', 'A flock of birds have been flying.', 'A flock of birds are flying.'],
      'A flock of birds was flying overhead.', 'EASY', 'English', 'Grammar', 'Grammatical Accuracy',
      'The singular subject "flock" governs the singular verb "was".')
add_q('Which sentence correctly uses "disinterested" vs "uninterested"?',
      ['A judge must be completely disinterested in the outcome of the trial.', 'He was disinterested in sports and preferred reading.', 'The bored student appeared disinterested in the lecture.', 'She was disinterested in going to the party.'],
      'A judge must be completely disinterested in the outcome of the trial.', 'HARD', 'English', 'Grammar', 'Grammatical Accuracy',
      '"Disinterested" means impartial/unbiased; "uninterested" means having no interest/bored.')
add_q('Identify the sentence with correct placement of "only":',
      ['She only told him the truth yesterday.', 'She told him the truth only yesterday.', 'Only she told him the truth yesterday.', 'She told only him the truth yesterday.'],
      'She told him the truth only yesterday.', 'MEDIUM', 'English', 'Grammar', 'Grammatical Accuracy',
      '"Only" should immediately precede the word it modifies ("yesterday").')
add_q('Which sentence correctly uses "complement" vs "compliment"?',
      ['The fine wine was a perfect compliment to the meal.', 'The fine wine was a perfect complement to the meal.', 'He paid her a sincere complement on her presentation.', 'The two colors compliment each other.'],
      'The fine wine was a perfect complement to the meal.', 'EASY', 'English', 'Grammar', 'Grammatical Accuracy',
      '"Complement" means something that completes or enhances; "compliment" is praise.')
add_q('Identify the sentence with correct verb agreement when joined by "as well as":',
      ['The captain, as well as the players, are excited.', 'The captain, as well as the players, is excited.', 'The captain, as well as the players, were excited.', 'The captain, as well as the players, have been excited.'],
      'The captain, as well as the players, is excited.', 'MEDIUM', 'English', 'Grammar', 'Grammatical Accuracy',
      'Parenthetical phrases like "as well as" do not alter the number of the subject ("captain" is singular -> "is").')

# --- PART 5: Scientific Constants & Exact Quantitative Facts (40) ---
add_q('What is the approximate speed of light in a vacuum (c) in meters per second?',
      ['2.998 × 10⁸ m/s', '3.844 × 10⁸ m/s', '1.496 × 10¹¹ m/s', '6.674 × 10⁻¹¹ m/s'], '2.998 × 10⁸ m/s', 'EASY', 'Science', 'Physics Constants', 'Precision Value',
      'The speed of light in vacuum is defined as exactly 299,792,458 m/s (≈ 2.998 × 10⁸ m/s).')
add_q('What is Avogadro\'s constant (NA), representing the number of constituent particles per mole?',
      ['6.022 × 10²³ mol⁻¹', '1.602 × 10⁻¹⁹ mol⁻¹', '9.109 × 10⁻³¹ mol⁻¹', '1.381 × 10⁻²³ mol⁻¹'], '6.022 × 10²³ mol⁻¹', 'EASY', 'Science', 'Chemistry Constants', 'Precision Value',
      'Avogadro\'s constant is defined as exactly 6.02214076 × 10²³ particles per mole.')
add_q('What is the standard acceleration due to gravity on Earth surface (g) to two decimal places?',
      ['9.81 m/s²', '9.78 m/s²', '9.83 m/s²', '10.00 m/s²'], '9.81 m/s²', 'EASY', 'Science', 'Physics Constants', 'Precision Value',
      'Standard gravity g is defined as 9.80665 m/s² (commonly rounded to 9.81 m/s²).')
add_q('What is the atomic number of Gold (chemical symbol Au)?',
      ['47', '78', '79', '82'], '79', 'MEDIUM', 'Science', 'Periodic Table', 'Precision Value',
      'Gold has atomic number 79 (47 is Silver, 78 is Platinum, 82 is Lead).')
add_q('What is standard atmospheric pressure at sea level in Pascals (Pa)?',
      ['100,000 Pa', '101,325 Pa', '105,400 Pa', '98,066 Pa'], '101,325 Pa', 'MEDIUM', 'Science', 'Thermodynamics', 'Precision Value',
      'Standard 1 atm is defined as exactly 101,325 Pa (101.325 kPa).')
add_q('What is the elementary electric charge of a proton or electron in Coulombs (C)?',
      ['1.602 × 10⁻¹⁹ C', '6.626 × 10⁻³⁴ C', '9.109 × 10⁻³¹ C', '8.854 × 10⁻¹² C'], '1.602 × 10⁻¹⁹ C', 'MEDIUM', 'Science', 'Physics Constants', 'Precision Value',
      'The elementary charge e is defined as exactly 1.602176634 × 10⁻¹⁹ Coulombs.')
add_q('What is the universal gravitational constant (G) approximately?',
      ['6.674 × 10⁻¹¹ N·m²/kg²', '8.314 × 10⁻¹¹ N·m²/kg²', '1.381 × 10⁻²³ N·m²/kg²', '8.988 × 10⁹ N·m²/kg²'], '6.674 × 10⁻¹¹ N·m²/kg²', 'HARD', 'Science', 'Physics Constants', 'Precision Value',
      'Newton\'s gravitational constant G ≈ 6.67430 × 10⁻¹¹ N·m²/kg².')
add_q('What is the molar gas constant (R) in J/(mol·K) to two decimal places?',
      ['6.02 J/(mol·K)', '8.31 J/(mol·K)', '9.81 J/(mol·K)', '1.38 J/(mol·K)'], '8.31 J/(mol·K)', 'MEDIUM', 'Science', 'Physical Chemistry', 'Precision Value',
      'The ideal gas constant R ≈ 8.314 J/(mol·K).')
add_q('What is the atomic number of Iron (Fe)?',
      ['24', '26', '28', '30'], '26', 'EASY', 'Science', 'Periodic Table', 'Precision Value',
      'Iron has atomic number 26.')
add_q('What is the approximate rest mass of an electron in kilograms?',
      ['9.109 × 10⁻³¹ kg', '1.673 × 10⁻²⁷ kg', '1.675 × 10⁻²⁷ kg', '6.645 × 10⁻²⁷ kg'], '9.109 × 10⁻³¹ kg', 'HARD', 'Science', 'Physics Constants', 'Precision Value',
      'The electron rest mass is approximately 9.1093837 × 10⁻³¹ kg.')
add_q('What is the atomic number of Uranium (U)?',
      ['88', '90', '92', '94'], '92', 'MEDIUM', 'Science', 'Nuclear Chemistry', 'Precision Value',
      'Uranium has atomic number 92.')
add_q('What is the boiling point of pure liquid nitrogen at 1 atm in Celsius?',
      ['-196°C', '-183°C', '-210°C', '-269°C'], '-196°C', 'MEDIUM', 'Science', 'Chemistry', 'Precision Value',
      'Liquid nitrogen boils at 77 K (-195.79°C ≈ -196°C).')
add_q('What is the atomic number of Carbon (C)?',
      ['4', '6', '8', '12'], '6', 'EASY', 'Science', 'Periodic Table', 'Precision Value',
      'Carbon has atomic number 6 and standard atomic mass ≈ 12.011.')
add_q('What is the exact half-life of Carbon-14 used in radiocarbon dating?',
      ['4,500 years', '5,730 years', '6,200 years', '8,190 years'], '5,730 years', 'MEDIUM', 'Science', 'Nuclear Chemistry', 'Precision Value',
      'Carbon-14 has an internationally recognized half-life of 5,730 ± 40 years.')
add_q('What is the atomic number of Oxygen (O)?',
      ['6', '8', '10', '16'], '8', 'EASY', 'Science', 'Periodic Table', 'Precision Value',
      'Oxygen has atomic number 8.')
add_q('What is the density of pure liquid water at 4°C in grams per cubic centimeter (g/cm³)?',
      ['0.90 g/cm³', '1.00 g/cm³', '1.10 g/cm³', '1.25 g/cm³'], '1.00 g/cm³', 'EASY', 'Science', 'Physical Properties', 'Precision Value',
      'At 3.98°C, pure water reaches its maximum density of exactly 1.000 g/cm³.')
add_q('What is the atomic number of Copper (Cu)?',
      ['27', '29', '31', '33'], '29', 'EASY', 'Science', 'Periodic Table', 'Precision Value',
      'Copper has atomic number 29.')
add_q('What is the average distance from the Earth to the Sun (1 Astronomical Unit) approximately?',
      ['100 million km', '150 million km', '200 million km', '250 million km'], '150 million km', 'EASY', 'Space', 'Astronomy', 'Precision Value',
      '1 AU is officially defined as exactly 149,597,870,700 meters (≈ 150 million km).')
add_q('What is the atomic number of Lead (Pb)?',
      ['80', '82', '84', '86'], '82', 'MEDIUM', 'Science', 'Periodic Table', 'Precision Value',
      'Lead has atomic number 82.')
add_q('What is Planck\'s constant (h) in Joule-seconds (J·s) approximately?',
      ['6.626 × 10⁻³⁴ J·s', '1.055 × 10⁻³⁴ J·s', '8.854 × 10⁻¹² J·s', '5.670 × 10⁻⁸ J·s'], '6.626 × 10⁻³⁴ J·s', 'HARD', 'Science', 'Quantum Physics', 'Precision Value',
      'Planck\'s constant h is defined as exactly 6.62607015 × 10⁻³⁴ J·s.')
add_q('What is the atomic number of Helium (He)?',
      ['1', '2', '3', '4'], '2', 'EASY', 'Science', 'Periodic Table', 'Precision Value',
      'Helium has atomic number 2 and atomic weight 4.0026.')
add_q('What is the approximate age of planet Earth according to radiometric dating of meteorites?',
      ['3.5 billion years', '4.54 billion years', '5.2 billion years', '6.1 billion years'], '4.54 billion years', 'MEDIUM', 'Science', 'Geology', 'Precision Value',
      'Earth is approximately 4.54 ± 0.05 billion years old.')
add_q('What is the atomic number of Silver (Ag)?',
      ['45', '47', '49', '51'], '47', 'MEDIUM', 'Science', 'Periodic Table', 'Precision Value',
      'Silver has atomic number 47.')
add_q('What is the critical angle for total internal reflection of light from diamond into air (refractive index n ≈ 2.42)?',
      ['18.5°', '24.4°', '32.1°', '42.0°'], '24.4°', 'HARD', 'Science', 'Optics', 'Precision Value',
      'sin(θc) = 1 / 2.42 ≈ 0.4132, yielding critical angle θc ≈ 24.4°.')
add_q('What is the atomic number of Sodium (Na)?',
      ['11', '12', '13', '14'], '11', 'EASY', 'Science', 'Periodic Table', 'Precision Value',
      'Sodium has atomic number 11.')
add_q('What is the speed of sound in pure fresh water at 25°C approximately?',
      ['343 m/s', '1,497 m/s', '3,000 m/s', '5,000 m/s'], '1,497 m/s', 'MEDIUM', 'Science', 'Acoustics', 'Precision Value',
      'Sound travels at approximately 1,497 m/s in water (more than four times faster than in air).')
add_q('What is the atomic number of Platinum (Pt)?',
      ['76', '77', '78', '79'], '78', 'MEDIUM', 'Science', 'Periodic Table', 'Precision Value',
      'Platinum has atomic number 78.')
add_q('What is the estimated age of the observable universe according to cosmic microwave background data?',
      ['10.2 billion years', '13.8 billion years', '15.5 billion years', '18.0 billion years'], '13.8 billion years', 'EASY', 'Space', 'Cosmology', 'Precision Value',
      'Planck spacecraft data estimates the universe age at 13.787 ± 0.020 billion years.')
add_q('What is the atomic number of Chlorine (Cl)?',
      ['15', '16', '17', '18'], '17', 'EASY', 'Science', 'Periodic Table', 'Precision Value',
      'Chlorine has atomic number 17.')
add_q('What is the boiling point of pure water in Kelvin at 1 atm pressure?',
      ['273.15 K', '310.15 K', '373.15 K', '400.00 K'], '373.15 K', 'EASY', 'Science', 'Thermodynamics', 'Precision Value',
      '100°C + 273.15 = 373.15 K.')
add_q('What is the atomic number of Potassium (K)?',
      ['17', '18', '19', '20'], '19', 'EASY', 'Science', 'Periodic Table', 'Precision Value',
      'Potassium has atomic number 19.')
add_q('What is the freezing point of mercury at standard atmospheric pressure in Celsius?',
      ['-38.83°C', '-10.50°C', '-50.25°C', '-78.50°C'], '-38.83°C', 'HARD', 'Science', 'Physical Chemistry', 'Precision Value',
      'Mercury solidifies at -38.83°C (234.32 K).')
add_q('What is the atomic number of Calcium (Ca)?',
      ['18', '19', '20', '21'], '20', 'EASY', 'Science', 'Periodic Table', 'Precision Value',
      'Calcium has atomic number 20.')
add_q('What is the Stefan-Boltzmann constant (σ) approximately in W/(m²·K⁴)?',
      ['5.670 × 10⁻⁸ W/(m²·K⁴)', '6.674 × 10⁻¹¹ W/(m²·K⁴)', '1.381 × 10⁻²³ W/(m²·K⁴)', '8.314 × 10⁻² W/(m²·K⁴)'], '5.670 × 10⁻⁸ W/(m²·K⁴)', 'HARD', 'Science', 'Thermodynamics', 'Precision Value',
      'The Stefan-Boltzmann constant σ ≈ 5.670374 × 10⁻⁸ W/(m²·K⁴).')
add_q('What is the atomic number of Aluminum (Al)?',
      ['11', '12', '13', '14'], '13', 'EASY', 'Science', 'Periodic Table', 'Precision Value',
      'Aluminum has atomic number 13.')
add_q('What is the mass of one proton compared to an electron approximately?',
      ['100 times heavier', '500 times heavier', '1,836 times heavier', '10,000 times heavier'], '1,836 times heavier', 'MEDIUM', 'Science', 'Physics', 'Precision Value',
      'A proton mass (1.6726 × 10⁻²⁷ kg) is approximately 1,836 times the rest mass of an electron.')
add_q('What is the atomic number of Zinc (Zn)?',
      ['28', '29', '30', '31'], '30', 'EASY', 'Science', 'Periodic Table', 'Precision Value',
      'Zinc has atomic number 30.')
add_q('What is the radius of the Earth at the equator to the nearest hundred kilometers?',
      ['5,400 km', '6,378 km', '7,200 km', '8,150 km'], '6,378 km', 'MEDIUM', 'Science', 'Geophysics', 'Precision Value',
      'Earth equatorial radius is approximately 6,378.1 kilometers.')
add_q('What is the atomic number of Magnesium (Mg)?',
      ['10', '11', '12', '13'], '12', 'EASY', 'Science', 'Periodic Table', 'Precision Value',
      'Magnesium has atomic number 12.')
add_q('What is the triple point of pure water in Kelvin?',
      ['273.15 K', '273.16 K', '274.00 K', '300.00 K'], '273.16 K', 'HARD', 'Science', 'Thermodynamics', 'Precision Value',
      'The triple point of water where solid, liquid, and vapor coexist is exactly 273.16 K (0.01°C).')

# --- PART 6: Financial & Commercial Math Precision (35) ---
add_q('An item priced at ₹1,200 is offered with a 15% discount. What is the discounted price before tax?',
      ['₹1,000', '₹1,020', '₹1,050', '₹1,080'], '₹1,020', 'EASY', 'Finance', 'Commercial Math', 'Precision Calculation',
      '15% of 1,200 = 180. 1,200 - 180 = ₹1,020.')
add_q('A product costing ₹800 is sold for ₹1,000. What is the profit percentage on cost?',
      ['20%', '25%', '30%', '15%'], '25%', 'EASY', 'Finance', 'Commercial Math', 'Precision Calculation',
      'Profit = 1,000 - 800 = 200. Profit % = (200 / 800) × 100 = 25%.')
add_q('Calculate simple interest on a principal of ₹5,000 at 8% per annum for 3 years:',
      ['₹1,000', '₹1,200', '₹1,400', '₹1,500'], '₹1,200', 'EASY', 'Finance', 'Interest Math', 'Precision Calculation',
      'SI = (P × R × T) / 100 = (5,000 × 8 × 3) / 100 = ₹1,200.')
add_q('An article listed at ₹2,500 is sold with successive discounts of 10% and 20%. What is the final selling price?',
      ['₹1,750', '₹1,800', '₹1,850', '₹1,900'], '₹1,800', 'MEDIUM', 'Finance', 'Commercial Math', 'Precision Calculation',
      'First discount: 2,500 - 250 = 2,250. Second discount: 20% of 2,250 = 450. 2,250 - 450 = ₹1,800.')
add_q('What is the compound amount on ₹10,000 invested at 10% per annum compounded annually for 2 years?',
      ['₹12,000', '₹12,100', '₹12,200', '₹12,500'], '₹12,100', 'MEDIUM', 'Finance', 'Compound Interest', 'Precision Calculation',
      'A = P(1 + r)² = 10,000 × (1.10)² = 10,000 × 1.21 = ₹12,100.')
add_q('A trader marks goods 40% above cost price and allows a 20% discount. What is the net profit percentage?',
      ['10%', '12%', '15%', '20%'], '12%', 'MEDIUM', 'Finance', 'Commercial Math', 'Precision Calculation',
      'Let cost = 100. Marked price = 140. Selling price = 140 - 28 = 112. Net profit = 12%.')
add_q('If 5 pens cost ₹75, what is the exact cost of 14 pens at the same rate?',
      ['₹190', '₹200', '₹210', '₹225'], '₹210', 'EASY', 'Finance', 'Unitary Method', 'Precision Calculation',
      'Cost per pen = 75 ÷ 5 = ₹15. 14 × 15 = ₹210.')
add_q('A shopkeeper sells a book for ₹450 suffering a 10% loss. What was the original cost price?',
      ['₹480', '₹500', '₹520', '₹550'], '₹500', 'MEDIUM', 'Finance', 'Commercial Math', 'Precision Calculation',
      'Selling price = 90% of cost. Cost = 450 / 0.90 = ₹500.')
add_q('What is the effective annual rate for a nominal rate of 12% compounded semi-annually?',
      ['12.00%', '12.36%', '12.50%', '12.68%'], '12.36%', 'HARD', 'Finance', 'Interest Math', 'Precision Calculation',
      'EAR = (1 + 0.06)² - 1 = 1.1236 - 1 = 12.36%.')
add_q('An investment of ₹4,000 doubles in 6 years under simple interest. What is the annual interest rate?',
      ['14.28%', '16.67%', '18.50%', '20.00%'], '16.67%', 'MEDIUM', 'Finance', 'Interest Math', 'Precision Calculation',
      'Interest = ₹4,000. Rate = (4,000 × 100) / (4,000 × 6) = 100 / 6 = 16.67%.')
add_q('A mobile phone priced at ₹15,000 attracts 18% GST. What is the total invoice amount including tax?',
      ['₹17,200', '₹17,500', '₹17,700', '₹18,000'], '₹17,700', 'EASY', 'Finance', 'Tax Math', 'Precision Calculation',
      'GST = 18% of 15,000 = 2,700. Total = 15,000 + 2,700 = ₹17,700.')
add_q('Calculate the ratio of 45 minutes to 2.5 hours in simplest form:',
      ['3 : 10', '9 : 25', '1 : 3', '3 : 8'], '3 : 10', 'EASY', 'Mathematics', 'Ratios', 'Precision Calculation',
      '2.5 hours = 150 minutes. 45 / 150 = 3 / 10.')
add_q('If the selling price of 10 articles equals the cost price of 12 articles, what is the profit percentage?',
      ['16.67%', '20%', '25%', '15%'], '20%', 'MEDIUM', 'Finance', 'Commercial Math', 'Precision Calculation',
      'Profit on 10 articles = cost of 2 articles. Profit % = (2 / 10) × 100 = 20%.')
add_q('A sum of ₹8,000 yields ₹1,200 simple interest in 3 years. What is the annual interest rate?',
      ['4%', '5%', '6%', '7%'], '5%', 'EASY', 'Finance', 'Interest Math', 'Precision Calculation',
      'R = (1,200 × 100) / (8,000 × 3) = 120,000 / 24,000 = 5%.')
add_q('What single discount is equivalent to two successive discounts of 20% and 10%?',
      ['26%', '28%', '30%', '32%'], '28%', 'MEDIUM', 'Finance', 'Commercial Math', 'Precision Calculation',
      'Net discount = 20 + 10 - (20 × 10 / 100) = 30 - 2 = 28%.')
add_q('A car depreciates by 10% annually. If its current value is ₹500,000, what is its value after one year?',
      ['₹425,000', '₹450,000', '₹475,000', '₹400,000'], '₹450,000', 'EASY', 'Finance', 'Depreciation', 'Precision Calculation',
      'Depreciation = 10% of 500,000 = 50,000. Value = ₹450,000.')
add_q('A person buys a bike for ₹60,000 and spends ₹5,000 on repairs. He sells it for ₹78,000. What is his profit %?',
      ['15%', '18%', '20%', '22%'], '20%', 'MEDIUM', 'Finance', 'Commercial Math', 'Precision Calculation',
      'Total cost = 65,000. Profit = 78,000 - 65,000 = 13,000. Profit % = (13,000 / 65,000) × 100 = 20%.')
add_q('Divide ₹1,800 among A, B, and C in the ratio 2 : 3 : 4. What is B\'s share?',
      ['₹400', '₹600', '₹800', '₹500'], '₹600', 'EASY', 'Mathematics', 'Ratios', 'Precision Calculation',
      'Total parts = 2 + 3 + 4 = 9. Part value = 1,800 / 9 = 200. B\'s share = 3 × 200 = ₹600.')
add_q('A retailer offers Buy 3, Get 1 Free. What is the effective percentage discount offered?',
      ['20%', '25%', '33.33%', '15%'], '25%', 'MEDIUM', 'Finance', 'Commercial Math', 'Precision Calculation',
      'Customer receives 4 items for the price of 3. Discount = 1 free out of 4 total = 1/4 = 25%.')
add_q('What is the compound interest on ₹5,000 at 10% per annum for 2 years compounded annually?',
      ['₹1,000', '₹1,050', '₹1,100', '₹1,150'], '₹1,050', 'MEDIUM', 'Finance', 'Compound Interest', 'Precision Calculation',
      'Amount = 5,000 × 1.21 = 6,050. CI = 6,050 - 5,000 = ₹1,050.')
add_q('A shirt is marked at ₹1,500 and sold for ₹1,200. What is the discount percentage?',
      ['15%', '18%', '20%', '25%'], '20%', 'EASY', 'Finance', 'Commercial Math', 'Precision Calculation',
      'Discount = 300. Discount % = (300 / 1,500) × 100 = 20%.')
add_q('If a sum triples itself in 10 years under simple interest, what is the annual interest rate?',
      ['15%', '20%', '25%', '30%'], '20%', 'MEDIUM', 'Finance', 'Interest Math', 'Precision Calculation',
      'Interest = 2P. Rate = (2P × 100) / (P × 10) = 200 / 10 = 20%.')
add_q('A trader sells goods at cost price but uses a false weight of 900 grams instead of 1 kilogram. What is his profit %?',
      ['10%', '11.11%', '12.5%', '15%'], '11.11%', 'HARD', 'Finance', 'Commercial Math', 'Precision Calculation',
      'Profit % = (Error / True - Error) × 100 = (100 / 900) × 100 = 11.11%.')
add_q('If 8 men can complete a project in 15 days, how many days will 12 men take at the same work rate?',
      ['8 days', '10 days', '12 days', '14 days'], '10 days', 'EASY', 'Mathematics', 'Work and Time', 'Precision Calculation',
      'Total man-days = 8 × 15 = 120. Days for 12 men = 120 ÷ 12 = 10 days.')
add_q('An investor buys 100 shares at ₹50 each and pays 1% brokerage. What is the total outlay?',
      ['₹5,000', '₹5,050', '₹5,100', '₹5,150'], '₹5,050', 'EASY', 'Finance', 'Investment Math', 'Precision Calculation',
      'Share value = 5,000. Brokerage = 1% of 5,000 = 50. Total = ₹5,050.')
add_q('A vendor sells two items for ₹990 each, making a 10% profit on one and a 10% loss on the other. What is the net result?',
      ['No profit, no loss', '1% loss', '1% profit', '2% loss'], '1% loss', 'HARD', 'Finance', 'Commercial Math', 'Precision Calculation',
      'When two items are sold at equal price with equal profit and loss percentages x, there is always a loss of (x/10)²% = (10/10)² = 1% loss.')
add_q('If the cost price of an item is ₹250 and selling price is ₹325, what is the profit percentage?',
      ['25%', '30%', '35%', '40%'], '30%', 'EASY', 'Finance', 'Commercial Math', 'Precision Calculation',
      'Profit = 325 - 250 = 75. Profit % = (75 / 250) × 100 = 30%.')
add_q('What is the simple interest on ₹12,000 at 6% per annum for 9 months?',
      ['₹480', '₹520', '₹540', '₹600'], '₹540', 'MEDIUM', 'Finance', 'Interest Math', 'Precision Calculation',
      'Time = 9/12 = 0.75 years. SI = (12,000 × 6 × 0.75) / 100 = 120 × 4.5 = ₹540.')
add_q('A merchant offers a discount of 25% on marked price and still makes a 20% profit. If cost price is ₹500, what is marked price?',
      ['₹750', '₹800', '₹850', '₹900'], '₹800', 'HARD', 'Finance', 'Commercial Math', 'Precision Calculation',
      'SP = 500 × 1.20 = 600. MP = 600 / 0.75 = ₹800.')
add_q('If annual inflation is 6%, how much will a basket of goods costing ₹1,000 today cost one year from now?',
      ['₹1,030', '₹1,060', '₹1,090', '₹1,120'], '₹1,060', 'EASY', 'Finance', 'Inflation', 'Precision Calculation',
      '1,000 × 1.06 = ₹1,060.')
add_q('A bank charges 1.5% interest per month on credit card balances. What is the nominal annual percentage rate (APR)?',
      ['15%', '16.5%', '18%', '19.5%'], '18%', 'EASY', 'Finance', 'Banking', 'Precision Calculation',
      '1.5% × 12 months = 18% APR.')
add_q('A car is bought for ₹400,000 and sold after 2 years at a 20% total depreciation. What is the sale value?',
      ['₹300,000', '₹320,000', '₹340,000', '₹350,000'], '₹320,000', 'EASY', 'Finance', 'Depreciation', 'Precision Calculation',
      'Depreciation = 20% of 400,000 = 80,000. Sale value = 400,000 - 80,000 = ₹320,000.')
add_q('A person pays ₹3,600 annual premium on a term life policy with sum assured of ₹1,000,000. What is premium per ₹1,000 sum assured?',
      ['₹2.50', '₹3.60', '₹4.00', '₹5.00'], '₹3.60', 'EASY', 'Finance', 'Insurance', 'Precision Calculation',
      '3,600 / (1,000,000 / 1,000) = 3,600 / 1,000 = ₹3.60.')
add_q('Calculate the profit percentage when cost price is ₹1,600 and profit is ₹240:',
      ['12.5%', '15%', '16%', '17.5%'], '15%', 'EASY', 'Finance', 'Commercial Math', 'Precision Calculation',
      '(240 / 1,600) × 100 = 15%.')
add_q('If 3 apples cost ₹45, what is the cost of 2 dozen apples at the same unit rate?',
      ['₹320', '₹340', '₹360', '₹380'], '₹360', 'EASY', 'Finance', 'Unitary Method', 'Precision Calculation',
      'Cost per apple = 45 / 3 = ₹15. 2 dozen = 24 apples. 24 × 15 = ₹360.')

print(f'Total ACCURACY questions authored: {len(questions)}')

# Save to scripts/data/round4_accuracy.json
os.makedirs('scripts/data', exist_ok=True)
with open('scripts/data/round4_accuracy.json', 'w', encoding='utf-8') as out:
    json.dump(questions, out, indent=2, ensure_ascii=False)
print('Successfully saved scripts/data/round4_accuracy.json')
