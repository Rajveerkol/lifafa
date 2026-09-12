# scripts/builders/author_round5.py
# Generates 225 diverse, verified SPEED questions (15-sec rapid fire)
# Fully individualized prompts with zero repetitive prefixes or formulaic templates.
import json
import os

questions = []

def add_q(prompt, options, correct_answer, difficulty, category, subcategory, pattern_type, explanation, time_limit=15):
    assert len(options) == 4, f'Options count must be 4: {prompt}'
    assert len(set(options)) == 4, f'Options must be unique: {prompt}'
    assert correct_answer in options, f'Correct answer must be in options: {prompt}'
    assert difficulty in ['EASY', 'MEDIUM', 'HARD'], f'Invalid difficulty: {difficulty}'
    questions.append({
        'round_type': 'SPEED',
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

# --- PART 1: Rapid Mental Math & Quick Arithmetic (45) ---
add_q('Compute the sum of 18 and 27:',
      ['43', '45', '47', '55'], '45', 'EASY', 'Mental Math', 'Addition', 'Rapid Math',
      '18 + 27 = 45.')
add_q('Divide 48 by 6:',
      ['4', '6', '8', '12'], '8', 'EASY', 'Mental Math', 'Division', 'Rapid Math',
      '48 ÷ 6 = 8.')
add_q('Multiply 14 by 5:',
      ['60', '65', '70', '75'], '70', 'EASY', 'Mental Math', 'Multiplication', 'Rapid Math',
      '14 × 5 = 70.')
add_q('Subtract 47 from 83:',
      ['34', '36', '38', '46'], '36', 'EASY', 'Mental Math', 'Subtraction', 'Rapid Math',
      '83 - 47 = 36.')
add_q('What is 16 quadrupled (16 × 4)?',
      ['54', '60', '64', '68'], '64', 'EASY', 'Mental Math', 'Multiplication', 'Rapid Math',
      '16 × 4 = 64.')
add_q('Add 39 and 46 together:',
      ['75', '83', '85', '87'], '85', 'EASY', 'Mental Math', 'Addition', 'Rapid Math',
      '39 + 46 = 85.')
add_q('Determine the quotient of 72 ÷ 8:',
      ['7', '8', '9', '12'], '9', 'EASY', 'Mental Math', 'Division', 'Rapid Math',
      '72 ÷ 8 = 9.')
add_q('Calculate the square of 12 (12 × 12):',
      ['124', '144', '154', '164'], '144', 'EASY', 'Mental Math', 'Squares', 'Rapid Math',
      '12 × 12 = 144.')
add_q('Deduct 68 from 150:',
      ['72', '82', '84', '92'], '82', 'EASY', 'Mental Math', 'Subtraction', 'Rapid Math',
      '150 - 68 = 82.')
add_q('Find the total when 67 is added to 28:',
      ['85', '93', '95', '97'], '95', 'EASY', 'Mental Math', 'Addition', 'Rapid Math',
      '67 + 28 = 95.')
add_q('Evaluate 25 multiplied by 6:',
      ['125', '140', '150', '160'], '150', 'EASY', 'Mental Math', 'Multiplication', 'Rapid Math',
      '25 × 6 = 150.')
add_q('What is 96 divided by 8?',
      ['11', '12', '13', '14'], '12', 'EASY', 'Mental Math', 'Division', 'Rapid Math',
      '96 ÷ 8 = 12.')
add_q('Calculate 200 minus 135:',
      ['55', '65', '75', '85'], '65', 'EASY', 'Mental Math', 'Subtraction', 'Rapid Math',
      '200 - 135 = 65.')
add_q('Combine 125 and 75:',
      ['190', '200', '210', '225'], '200', 'EASY', 'Mental Math', 'Addition', 'Rapid Math',
      '125 + 75 = 200.')
add_q('Determine the product of 13 and 7:',
      ['81', '87', '91', '93'], '91', 'MEDIUM', 'Mental Math', 'Multiplication', 'Rapid Math',
      '13 × 7 = 91.')
add_q('Divide 105 by 5:',
      ['19', '21', '23', '25'], '21', 'EASY', 'Mental Math', 'Division', 'Rapid Math',
      '105 ÷ 5 = 21.')
add_q('What is 15 squared (15 × 15)?',
      ['215', '225', '235', '245'], '225', 'EASY', 'Mental Math', 'Squares', 'Rapid Math',
      '15 × 15 = 225.')
add_q('Subtract 46 from 90:',
      ['42', '44', '46', '54'], '44', 'EASY', 'Mental Math', 'Subtraction', 'Rapid Math',
      '90 - 46 = 44.')
add_q('Triple the number 18 (18 × 3):',
      ['48', '52', '54', '56'], '54', 'EASY', 'Mental Math', 'Multiplication', 'Rapid Math',
      '18 × 3 = 54.')
add_q('Sum 44 and 57:',
      ['91', '99', '101', '111'], '101', 'EASY', 'Mental Math', 'Addition', 'Rapid Math',
      '44 + 57 = 101.')
add_q('What is 132 divided by 11?',
      ['10', '11', '12', '15'], '12', 'EASY', 'Mental Math', 'Division', 'Rapid Math',
      '132 ÷ 11 = 12.')
add_q('Evaluate 19 × 4 mentally:',
      ['72', '74', '76', '78'], '76', 'MEDIUM', 'Mental Math', 'Multiplication', 'Rapid Math',
      '19 × 4 = 76.')
add_q('Find the difference between 110 and 48:',
      ['52', '62', '64', '72'], '62', 'EASY', 'Mental Math', 'Subtraction', 'Rapid Math',
      '110 - 48 = 62.')
add_q('What do you get by adding 85 to 38?',
      ['113', '121', '123', '125'], '123', 'EASY', 'Mental Math', 'Addition', 'Rapid Math',
      '85 + 38 = 123.')
add_q('Compute the square of 14 (14²):',
      ['186', '196', '206', '216'], '196', 'EASY', 'Mental Math', 'Squares', 'Rapid Math',
      '14 × 14 = 196.')
add_q('Divide 140 by 7:',
      ['18', '20', '22', '25'], '20', 'EASY', 'Mental Math', 'Division', 'Rapid Math',
      '140 ÷ 7 = 20.')
add_q('Multiply 24 by 5:',
      ['110', '115', '120', '125'], '120', 'EASY', 'Mental Math', 'Multiplication', 'Rapid Math',
      '24 × 5 = 120.')
add_q('Reduce 75 by 29:',
      ['44', '46', '48', '56'], '46', 'EASY', 'Mental Math', 'Subtraction', 'Rapid Math',
      '75 - 29 = 46.')
add_q('Calculate the sum: 63 + 49:',
      ['102', '110', '112', '114'], '112', 'EASY', 'Mental Math', 'Addition', 'Rapid Math',
      '63 + 49 = 112.')
add_q('What is 17 times 3?',
      ['41', '49', '51', '53'], '51', 'EASY', 'Mental Math', 'Multiplication', 'Rapid Math',
      '17 × 3 = 51.')
add_q('Evaluate the quotient: 168 ÷ 12:',
      ['12', '14', '16', '18'], '14', 'MEDIUM', 'Mental Math', 'Division', 'Rapid Math',
      '168 ÷ 12 = 14.')
add_q('Subtract 245 from 500:',
      ['245', '255', '265', '275'], '255', 'EASY', 'Mental Math', 'Subtraction', 'Rapid Math',
      '500 - 245 = 255.')
add_q('Compute 13 squared (13 × 13):',
      ['159', '169', '179', '189'], '169', 'EASY', 'Mental Math', 'Squares', 'Rapid Math',
      '13 × 13 = 169.')
add_q('What is 35 multiplied by 4?',
      ['120', '130', '140', '150'], '140', 'EASY', 'Mental Math', 'Multiplication', 'Rapid Math',
      '35 × 4 = 140.')
add_q('Add 147 and 53:',
      ['190', '200', '210', '220'], '200', 'EASY', 'Mental Math', 'Addition', 'Rapid Math',
      '147 + 53 = 200.')
add_q('Divide 180 by 9:',
      ['18', '20', '22', '24'], '20', 'EASY', 'Mental Math', 'Division', 'Rapid Math',
      '180 ÷ 9 = 20.')
add_q('Take 38 away from 92:',
      ['52', '54', '56', '58'], '54', 'EASY', 'Mental Math', 'Subtraction', 'Rapid Math',
      '92 - 38 = 54.')
add_q('What is 21 times 4?',
      ['82', '84', '86', '88'], '84', 'EASY', 'Mental Math', 'Multiplication', 'Rapid Math',
      '21 × 4 = 84.')
add_q('Compute 78 plus 36:',
      ['104', '112', '114', '116'], '114', 'EASY', 'Mental Math', 'Addition', 'Rapid Math',
      '78 + 36 = 114.')
add_q('How many times does 15 divide into 225?',
      ['13', '14', '15', '16'], '15', 'EASY', 'Mental Math', 'Division', 'Rapid Math',
      '225 ÷ 15 = 15.')
add_q('Calculate 16 squared (16²):',
      ['246', '256', '266', '276'], '256', 'EASY', 'Mental Math', 'Squares', 'Rapid Math',
      '16 × 16 = 256.')
add_q('What remains after subtracting 188 from 300?',
      ['102', '112', '122', '132'], '112', 'EASY', 'Mental Math', 'Subtraction', 'Rapid Math',
      '300 - 188 = 112.')
add_q('Multiply 15 by 8:',
      ['100', '110', '120', '130'], '120', 'EASY', 'Mental Math', 'Multiplication', 'Rapid Math',
      '15 × 8 = 120.')
add_q('Sum the two numbers 99 and 88:',
      ['177', '185', '187', '197'], '187', 'EASY', 'Mental Math', 'Addition', 'Rapid Math',
      '99 + 88 = 187.')
add_q('Evaluate 250 divided by 25:',
      ['5', '10', '15', '20'], '10', 'EASY', 'Mental Math', 'Division', 'Rapid Math',
      '250 ÷ 25 = 10.')

# --- PART 2: Instant Parity, Prime & Divisibility Checks (35) ---
add_q('Which of these candidate numbers is an odd prime?',
      ['9', '15', '17', '21'], '17', 'EASY', 'Mental Math', 'Number Theory', 'Instant Verification',
      '17 is prime. 9, 15, and 21 are composite.')
add_q('Identify the number whose digits sum to a multiple of 9:',
      ['142', '234', '311', '412'], '234', 'MEDIUM', 'Mental Math', 'Divisibility', 'Instant Verification',
      'Sum of digits of 234 is 2 + 3 + 4 = 9 (divisible by 9).')
add_q('What is the only even prime number in mathematics?',
      ['0', '1', '2', '4'], '2', 'EASY', 'Mental Math', 'Number Theory', 'Instant Verification',
      '2 is the only even prime number in mathematics.')
add_q('Which number has its last two digits divisible by 4?',
      ['314', '526', '736', '818'], '736', 'MEDIUM', 'Mental Math', 'Divisibility', 'Instant Verification',
      'Last two digits 36 is divisible by 4, so 736 is divisible by 4.')
add_q('Identify 4 cubed (4 × 4 × 4) among these values:',
      ['16', '36', '64', '100'], '64', 'EASY', 'Mental Math', 'Powers & Roots', 'Instant Verification',
      '64 = 4³ (4 × 4 × 4).')
add_q('Which integer between 30 and 40 has no divisors other than 1 and itself?',
      ['27', '33', '37', '49'], '37', 'EASY', 'Mental Math', 'Number Theory', 'Instant Verification',
      '37 is prime. 27=3³, 33=3×11, 49=7².')
add_q('Which value has digits that add up to 6, making it divisible by 3?',
      ['112', '124', '141', '155'], '141', 'EASY', 'Mental Math', 'Divisibility', 'Instant Verification',
      'Sum of digits: 1 + 4 + 1 = 6 (divisible by 3).')
add_q('Which integer equals 12 multiplied by 7?',
      ['64', '76', '84', '92'], '84', 'EASY', 'Mental Math', 'Divisibility', 'Instant Verification',
      '84 ÷ 12 = 7.')
add_q('Identify the odd composite number having factors 5 and 7:',
      ['19', '23', '29', '35'], '35', 'EASY', 'Mental Math', 'Number Theory', 'Instant Verification',
      '35 is composite (5 × 7); 19, 23, and 29 are prime.')
add_q('Which even number is divisible by 3, making it a multiple of 6?',
      ['74', '86', '96', '104'], '96', 'MEDIUM', 'Mental Math', 'Divisibility', 'Instant Verification',
      '96 is even and divisible by 3 (9+6=15), hence divisible by 6.')
add_q('Which value represents 12 squared (12² = 144)?',
      ['120', '144', '150', '160'], '144', 'EASY', 'Mental Math', 'Powers & Roots', 'Instant Verification',
      '144 = 12².')
add_q('Select the prime number in the forties (40 to 49):',
      ['41', '51', '57', '63'], '41', 'MEDIUM', 'Mental Math', 'Number Theory', 'Instant Verification',
      '41 is prime. 51=3×17, 57=3×19, 63=7×9.')
add_q('Which number equals 11 squared (11² = 121)?',
      ['121', '131', '141', '151'], '121', 'EASY', 'Mental Math', 'Divisibility', 'Instant Verification',
      '121 = 11 × 11.')
add_q('Which candidate integer is a product of 15 and 5?',
      ['65', '75', '85', '95'], '75', 'EASY', 'Mental Math', 'Divisibility', 'Instant Verification',
      '75 = 15 × 5.')
add_q('Which prime number lies between 50 and 60?',
      ['49', '53', '55', '65'], '53', 'EASY', 'Mental Math', 'Number Theory', 'Instant Verification',
      '53 has no divisors other than 1 and 53.')
add_q('Which value equals 8 multiplied by 16?',
      ['108', '116', '128', '134'], '128', 'MEDIUM', 'Mental Math', 'Divisibility', 'Instant Verification',
      '128 ÷ 8 = 16.')
add_q('Identify 15 squared (15²) among these candidates:',
      ['200', '225', '250', '275'], '225', 'EASY', 'Mental Math', 'Powers & Roots', 'Instant Verification',
      '225 = 15².')
add_q('Select the prime integer situated in the lower seventies:',
      ['69', '71', '77', '87'], '71', 'MEDIUM', 'Mental Math', 'Number Theory', 'Instant Verification',
      '71 is prime. 69=3×23, 77=7×11, 87=3×29.')
add_q('Which multiple of 5 also has digits summing to 9?',
      ['35', '45', '55', '65'], '45', 'EASY', 'Mental Math', 'Divisibility', 'Instant Verification',
      '45 ends in 5 and its digits sum to 9, so it is divisible by both 5 and 3.')
add_q('Which of these numbers is odd but composite (equal to 3 × 7)?',
      ['15', '21', '25', '27'], '21', 'EASY', 'Mental Math', 'Number Theory', 'Instant Verification',
      '21 is odd and composite (3 × 7).')
add_q('Which number ends in 50 and is an exact multiple of 25?',
      ['320', '350', '380', '410'], '350', 'EASY', 'Mental Math', 'Divisibility', 'Instant Verification',
      'Numbers ending in 50 are divisible by 25. 350 ÷ 25 = 14.')
add_q('Identify the prime number residing between 75 and 80:',
      ['79', '81', '85', '91'], '79', 'MEDIUM', 'Mental Math', 'Number Theory', 'Instant Verification',
      '79 is prime. 81=9², 85=5×17, 91=7×13.')
add_q('Which value is the product of 7 and 9?',
      ['58', '63', '67', '72'], '63', 'EASY', 'Mental Math', 'Divisibility', 'Instant Verification',
      '63 ÷ 7 = 9.')
add_q('Which candidate integer equals 5 cubed (5³ = 125)?',
      ['81', '100', '125', '144'], '125', 'EASY', 'Mental Math', 'Powers & Roots', 'Instant Verification',
      '125 = 5³.')
add_q('Select the prime integer located in the lower eighties:',
      ['83', '87', '93', '99'], '83', 'MEDIUM', 'Mental Math', 'Number Theory', 'Instant Verification',
      '83 is prime. 87=3×29, 93=3×31, 99=9×11.')
add_q('Which number has last two digits 24, indicating divisibility by 4?',
      ['114', '124', '134', '142'], '124', 'EASY', 'Mental Math', 'Divisibility', 'Instant Verification',
      'Last two digits 24 is divisible by 4, so 124 is divisible by 4.')
add_q('Which value equals 16 multiplied by 4?',
      ['44', '56', '64', '74'], '64', 'EASY', 'Mental Math', 'Divisibility', 'Instant Verification',
      '64 = 16 × 4.')
add_q('Which number between 85 and 90 is a prime?',
      ['89', '91', '95', '99'], '89', 'MEDIUM', 'Mental Math', 'Number Theory', 'Instant Verification',
      '89 is prime. 91=7×13.')
add_q('Which three-digit number has digits summing to 9 (5 + 2 + 2)?',
      ['512', '522', '532', '542'], '522', 'MEDIUM', 'Mental Math', 'Divisibility', 'Instant Verification',
      '5 + 2 + 2 = 9, so 522 is divisible by 9.')
add_q('What is 16 squared (16²) evaluated as a perfect square?',
      ['256', '266', '276', '286'], '256', 'EASY', 'Mental Math', 'Powers & Roots', 'Instant Verification',
      '256 = 16².')
add_q('Which candidate number ends in an even digit (8)?',
      ['113', '225', '338', '441'], '338', 'EASY', 'Mental Math', 'Parity', 'Instant Verification',
      '338 ends in 8, an even digit.')
add_q('What is the largest two-digit prime integer?',
      ['91', '93', '97', '99'], '97', 'MEDIUM', 'Mental Math', 'Number Theory', 'Instant Verification',
      '97 is the largest two-digit prime number.')
add_q('Which number is an exact multiple of 12 (12 × 9)?',
      ['108', '114', '126', '136'], '108', 'MEDIUM', 'Mental Math', 'Divisibility', 'Instant Verification',
      '108 = 12 × 9.')
add_q('Which value equals 18 multiplied by 3?',
      ['48', '54', '64', '74'], '54', 'EASY', 'Mental Math', 'Divisibility', 'Instant Verification',
      '54 = 18 × 3.')
add_q('Which candidate integer equals 3 cubed (3³ = 27)?',
      ['27', '36', '45', '54'], '27', 'EASY', 'Mental Math', 'Powers & Roots', 'Instant Verification',
      '27 = 3³.')

# --- PART 3: Lightning Antonyms & Vocabulary Reflexes (40) ---
add_q('Which word is the direct antonym of "VAGUE"?',
      ['Hazy', 'Clear / Precise', 'Obscure', 'Dim'], 'Clear / Precise', 'EASY', 'Language Reflexes', 'Antonyms', 'Vocabulary Reflex',
      'The direct opposite of vague is clear or precise.')
add_q('Identify the opposite of "CANDID":',
      ['Deceitful / Secretive', 'Frank', 'Honest', 'Sincere'], 'Deceitful / Secretive', 'MEDIUM', 'Language Reflexes', 'Antonyms', 'Vocabulary Reflex',
      'Candid means frank and straightforward; deceitful is its antonym.')
add_q('Select a synonym for "SWIFT":',
      ['Sluggish', 'Rapid / Fast', 'Heavy', 'Stationary'], 'Rapid / Fast', 'EASY', 'Language Reflexes', 'Synonyms', 'Vocabulary Reflex',
      'Swift means rapid or fast.')
add_q('What is the antonym of "ARROGANT"?',
      ['Proud', 'Humble', 'Boastful', 'Defiant'], 'Humble', 'EASY', 'Language Reflexes', 'Antonyms', 'Vocabulary Reflex',
      'The opposite of arrogant is humble.')
add_q('Which word shares the meaning of "ABUNDANT"?',
      ['Scarce', 'Plentiful', 'Empty', 'Sparse'], 'Plentiful', 'EASY', 'Language Reflexes', 'Synonyms', 'Vocabulary Reflex',
      'Abundant means plentiful or existing in large quantities.')
add_q('Identify the direct antonym of "BENEVOLENT":',
      ['Kind', 'Generous', 'Malevolent', 'Gracious'], 'Malevolent', 'MEDIUM', 'Language Reflexes', 'Antonyms', 'Vocabulary Reflex',
      'Benevolent means wishing well; malevolent means wishing ill.')
add_q('Select the closest synonym for "METICULOUS":',
      ['Careless', 'Precise / Thorough', 'Hasty', 'Vague'], 'Precise / Thorough', 'MEDIUM', 'Language Reflexes', 'Synonyms', 'Vocabulary Reflex',
      'Meticulous means taking extreme care about minute details.')
add_q('What word is the opposite of "CONCEAL"?',
      ['Hide', 'Cover', 'Reveal', 'Shroud'], 'Reveal', 'EASY', 'Language Reflexes', 'Antonyms', 'Vocabulary Reflex',
      'To conceal is to hide; to reveal is to make known.')
add_q('Which option is synonymous with "FRUGAL"?',
      ['Wasteful', 'Economical / Thrifty', 'Extravagant', 'Generous'], 'Economical / Thrifty', 'MEDIUM', 'Language Reflexes', 'Synonyms', 'Vocabulary Reflex',
      'Frugal means sparing or economical with money.')
add_q('Select the antonym for "EXPAND":',
      ['Grow', 'Contract', 'Enlarge', 'Broaden'], 'Contract', 'EASY', 'Language Reflexes', 'Antonyms', 'Vocabulary Reflex',
      'To expand is to grow larger; to contract is to become smaller.')
add_q('What word means the same as "CANDOR"?',
      ['Deception', 'Honesty / Frankness', 'Secrecy', 'Guile'], 'Honesty / Frankness', 'MEDIUM', 'Language Reflexes', 'Synonyms', 'Vocabulary Reflex',
      'Candor is the quality of being open and honest.')
add_q('Identify the antonym of "GENUINE":',
      ['Authentic', 'Real', 'Fake / Counterfeit', 'Legitimate'], 'Fake / Counterfeit', 'EASY', 'Language Reflexes', 'Antonyms', 'Vocabulary Reflex',
      'Genuine means authentic; fake is its direct opposite.')
add_q('Which word is a synonym for "HASTY"?',
      ['Slow', 'Hurried / Rash', 'Cautious', 'Deliberate'], 'Hurried / Rash', 'EASY', 'Language Reflexes', 'Synonyms', 'Vocabulary Reflex',
      'Hasty means acting with excessive or rash speed.')
add_q('What is the opposite of "OPTIMISTIC"?',
      ['Hopeful', 'Confident', 'Pessimistic', 'Cheerful'], 'Pessimistic', 'EASY', 'Language Reflexes', 'Antonyms', 'Vocabulary Reflex',
      'Optimistic anticipates good outcomes; pessimistic expects negative outcomes.')
add_q('Which term is synonymous with "ZENITH"?',
      ['Nadir', 'Base', 'Peak / Pinnacle', 'Bottom'], 'Peak / Pinnacle', 'MEDIUM', 'Language Reflexes', 'Synonyms', 'Vocabulary Reflex',
      'Zenith represents the highest peak or culmination.')
add_q('Identify the antonym of "TRANSPARENT":',
      ['Clear', 'Lucid', 'Opaque', 'Pellucid'], 'Opaque', 'EASY', 'Language Reflexes', 'Antonyms', 'Vocabulary Reflex',
      'Transparent transmits light clearly; opaque blocks light entirely.')
add_q('What word is synonymous with "LUCID"?',
      ['Confusing', 'Clear / Comprehensible', 'Dark', 'Cloudy'], 'Clear / Comprehensible', 'MEDIUM', 'Language Reflexes', 'Synonyms', 'Vocabulary Reflex',
      'Lucid means expressed clearly and easy to understand.')
add_q('Which word is the opposite of "FERTILE"?',
      ['Productive', 'Rich', 'Barren / Sterile', 'Arable'], 'Barren / Sterile', 'EASY', 'Language Reflexes', 'Antonyms', 'Vocabulary Reflex',
      'Fertile produces abundant crops; barren produces nothing.')
add_q('Select a synonym for "DILIGENT":',
      ['Lazy', 'Hardworking / Conscientious', 'Careless', 'Passive'], 'Hardworking / Conscientious', 'EASY', 'Language Reflexes', 'Synonyms', 'Vocabulary Reflex',
      'Diligent means showing persistent, industrious care.')
add_q('What is the direct antonym of "SCARCE"?',
      ['Rare', 'Few', 'Abundant', 'Meager'], 'Abundant', 'EASY', 'Language Reflexes', 'Antonyms', 'Vocabulary Reflex',
      'Scarce means insufficient; abundant means copious.')
add_q('Which term means the same as "COGNIZANT"?',
      ['Ignorant', 'Aware / Mindful', 'Unconscious', 'Blind'], 'Aware / Mindful', 'MEDIUM', 'Language Reflexes', 'Synonyms', 'Vocabulary Reflex',
      'Cognizant means having knowledge or being aware.')
add_q('Select the opposite of "LENIENT":',
      ['Permissive', 'Strict / Severe', 'Forgiving', 'Tolerant'], 'Strict / Severe', 'EASY', 'Language Reflexes', 'Antonyms', 'Vocabulary Reflex',
      'Lenient means mild or tolerant; strict is its opposite.')
add_q('Which word is synonymous with "PRAGMATIC"?',
      ['Idealistic', 'Practical / Realistic', 'Theoretical', 'Romantic'], 'Practical / Realistic', 'MEDIUM', 'Language Reflexes', 'Synonyms', 'Vocabulary Reflex',
      'Pragmatic means dealing with matters practically rather than theoretically.')
add_q('What is the antonym of "CHAOS"?',
      ['Disorder', 'Turmoil', 'Order / Harmony', 'Anarchy'], 'Order / Harmony', 'EASY', 'Language Reflexes', 'Antonyms', 'Vocabulary Reflex',
      'Chaos is total confusion; order is organized harmony.')
add_q('Select the synonym for "ADVERSARY":',
      ['Friend', 'Ally', 'Opponent / Rival', 'Partner'], 'Opponent / Rival', 'EASY', 'Language Reflexes', 'Synonyms', 'Vocabulary Reflex',
      'An adversary is an opponent or rival.')
add_q('Which word represents the antonym of "EPHEMERAL"?',
      ['Brief', 'Transient', 'Permanent / Eternal', 'Short-lived'], 'Permanent / Eternal', 'HARD', 'Language Reflexes', 'Antonyms', 'Vocabulary Reflex',
      'Ephemeral means lasting a very short time; permanent is eternal.')
add_q('Which adjective is synonymous with "CANDID"?',
      ['Deceitful', 'Frank / Outspoken', 'Shy', 'Reserved'], 'Frank / Outspoken', 'EASY', 'Language Reflexes', 'Synonyms', 'Vocabulary Reflex',
      'Candid means frank, open, and sincere.')
add_q('Identify the antonym of "OBSTINATE":',
      ['Stubborn', 'Inflexible', 'Flexible / Compliant', 'Rigid'], 'Flexible / Compliant', 'MEDIUM', 'Language Reflexes', 'Antonyms', 'Vocabulary Reflex',
      'Obstinate means stubbornly refusing to change; flexible is compliant.')
add_q('What word is synonymous with "RESOLUTE"?',
      ['Hesitant', 'Determined / Firm', 'Weak', 'Wavering'], 'Determined / Firm', 'MEDIUM', 'Language Reflexes', 'Synonyms', 'Vocabulary Reflex',
      'Resolute means admirably purposeful, determined, and unwavering.')
add_q('Which noun represents the exact opposite of "NADIR"?',
      ['Base', 'Depression', 'Zenith / Peak', 'Bottom'], 'Zenith / Peak', 'HARD', 'Language Reflexes', 'Antonyms', 'Vocabulary Reflex',
      'Nadir is the lowest point; Zenith is the highest point.')
add_q('Select the synonym for "NOVICE":',
      ['Expert', 'Beginner / Trainee', 'Veteran', 'Master'], 'Beginner / Trainee', 'EASY', 'Language Reflexes', 'Synonyms', 'Vocabulary Reflex',
      'A novice is a person new to or inexperienced in a field.')
add_q('Identify the antonym of "COPIOUS":',
      ['Plentiful', 'Ample', 'Scarce / Meager', 'Abundant'], 'Scarce / Meager', 'MEDIUM', 'Language Reflexes', 'Antonyms', 'Vocabulary Reflex',
      'Copious means abundant; meager/scarce is its antonym.')
add_q('What word shares the meaning of "IMMENSE"?',
      ['Tiny', 'Huge / Enormous', 'Narrow', 'Thin'], 'Huge / Enormous', 'EASY', 'Language Reflexes', 'Synonyms', 'Vocabulary Reflex',
      'Immense means extremely large or enormous.')
add_q('Which adjective is the opposite of "PERILOUS"?',
      ['Hazardous', 'Dangerous', 'Safe / Secure', 'Risky'], 'Safe / Secure', 'EASY', 'Language Reflexes', 'Antonyms', 'Vocabulary Reflex',
      'Perilous means full of danger; safe is secure.')
add_q('Identify the synonym for "TENACIOUS":',
      ['Yielding', 'Persistent / Determined', 'Weak', 'Fragile'], 'Persistent / Determined', 'MEDIUM', 'Language Reflexes', 'Synonyms', 'Vocabulary Reflex',
      'Tenacious means holding fast and keeping a firm hold.')
add_q('What is the antonym of "PRODIGAL"?',
      ['Extravagant', 'Wasteful', 'Thrifty / Frugal', 'Generous'], 'Thrifty / Frugal', 'HARD', 'Language Reflexes', 'Antonyms', 'Vocabulary Reflex',
      'Prodigal means wastefully extravagant; thrifty is frugal.')
add_q('Which word is synonymous with "BENIGN"?',
      ['Malignant', 'Harmless / Gentle', 'Harmful', 'Severe'], 'Harmless / Gentle', 'EASY', 'Language Reflexes', 'Synonyms', 'Vocabulary Reflex',
      'Benign means gentle, kind, or non-malignant.')
add_q('Select the antonym for "TACITURN":',
      ['Silent', 'Reserved', 'Talkative / Loquacious', 'Quiet'], 'Talkative / Loquacious', 'HARD', 'Language Reflexes', 'Antonyms', 'Vocabulary Reflex',
      'Taciturn means saying very little; talkative is loquacious.')
add_q('What word is synonymous with "DUBIOUS"?',
      ['Certain', 'Doubtful / Questionable', 'Definite', 'Trustworthy'], 'Doubtful / Questionable', 'EASY', 'Language Reflexes', 'Synonyms', 'Vocabulary Reflex',
      'Dubious means hesitating or causing doubt.')
add_q('Identify the direct antonym of "CONCORD":',
      ['Harmony', 'Agreement', 'Discord / Strife', 'Peace'], 'Discord / Strife', 'MEDIUM', 'Language Reflexes', 'Antonyms', 'Vocabulary Reflex',
      'Concord means agreement and peace; discord is strife.')

# --- PART 4: Fast Classification & Category Sorting (35) ---
add_q('Which of these is an INERT NOBLE GAS in Group 18?',
      ['Oxygen', 'Chlorine', 'Neon', 'Hydrogen'], 'Neon', 'EASY', 'Science Reflexes', 'Elements', 'Category Sorting',
      'Neon is a Group 18 inert noble gas.')
add_q('Which color is an additive PRIMARY COLOR of light (RGB model)?',
      ['Yellow', 'Green', 'Magenta', 'Cyan'], 'Green', 'EASY', 'Science Reflexes', 'Optics', 'Category Sorting',
      'Additive primary colors of light are Red, Green, and Blue.')
add_q('Which mammal is strictly an HERBIVORE feeding on vegetation?',
      ['Tiger', 'Deer', 'Hawk', 'Shark'], 'Deer', 'EASY', 'Science Reflexes', 'Biology', 'Category Sorting',
      'Deer are primary consumers feeding exclusively on plants.')
add_q('Which of these materials is an excellent ELECTRICAL CONDUCTOR?',
      ['Glass', 'Rubber', 'Copper', 'Wood'], 'Copper', 'EASY', 'Science Reflexes', 'Physics', 'Category Sorting',
      'Copper is an excellent metallic electrical conductor.')
add_q('Which energy source is naturally and continuously RENEWABLE?',
      ['Coal', 'Solar Energy', 'Natural Gas', 'Petroleum'], 'Solar Energy', 'EASY', 'Science Reflexes', 'Energy', 'Category Sorting',
      'Solar energy is continuously replenished by the Sun.')
add_q('Which of these animals is classified as an AMPHIBIAN?',
      ['Crocodile', 'Frog', 'Lizard', 'Turtle'], 'Frog', 'EASY', 'Science Reflexes', 'Zoology', 'Category Sorting',
      'Frogs are amphibians undergoing metamorphosis from aquatic tadpoles.')
add_q('Which celestial object is a terrestrial PLANET orbiting the Sun?',
      ['Sun', 'Moon', 'Mars', 'Sirius'], 'Mars', 'EASY', 'Science Reflexes', 'Astronomy', 'Category Sorting',
      'Mars is a terrestrial planet orbiting the Sun.')
add_q('Which peripheral hardware component is an INPUT DEVICE?',
      ['Monitor', 'Keyboard', 'Speaker', 'Printer'], 'Keyboard', 'EASY', 'Science Reflexes', 'Computers', 'Category Sorting',
      'Keyboard transmits character and command input to the system.')
add_q('Which human organ is primarily responsible for FILTERING BLOOD to form urine?',
      ['Heart', 'Liver', 'Kidney', 'Spleen'], 'Kidney', 'EASY', 'Science Reflexes', 'Anatomy', 'Category Sorting',
      'Nephrons in the kidney filter blood to excrete metabolic waste as urine.')
add_q('Which substance is a pure CHEMICAL ELEMENT, not a compound?',
      ['Water', 'Salt', 'Carbon', 'Sugar'], 'Carbon', 'EASY', 'Science Reflexes', 'Chemistry', 'Category Sorting',
      'Carbon is a pure chemical element (atomic number 6).')
add_q('Which of these animals is an egg-laying mammal (monotreme)?',
      ['Kangaroo', 'Platypus', 'Koala', 'Bat'], 'Platypus', 'MEDIUM', 'Science Reflexes', 'Zoology', 'Category Sorting',
      'The duck-billed platypus is one of the few living monotreme mammals.')
add_q('Which musical instrument belongs to the PERCUSSION family?',
      ['Violin', 'Flute', 'Snare Drum', 'Trumpet'], 'Snare Drum', 'EASY', 'General Knowledge', 'Music', 'Category Sorting',
      'Snare drum produces sound by striking its membrane.')
add_q('Which of these vitamins is WATER-SOLUBLE in human biology?',
      ['Vitamin A', 'Vitamin C', 'Vitamin D', 'Vitamin K'], 'Vitamin C', 'MEDIUM', 'Science Reflexes', 'Nutrition', 'Category Sorting',
      'Vitamin C and the B-complex vitamins are water-soluble; A, D, E, and K are fat-soluble.')
add_q('Which sovereign nation is situated on the continent of SOUTH AMERICA?',
      ['Mexico', 'Brazil', 'Spain', 'Egypt'], 'Brazil', 'EASY', 'General Knowledge', 'Geography', 'Category Sorting',
      'Brazil is the largest nation in South America.')
add_q('Which chemical element is classified as a HALOGEN in Group 17?',
      ['Argon', 'Chlorine', 'Sodium', 'Calcium'], 'Chlorine', 'EASY', 'Science Reflexes', 'Periodic Table', 'Category Sorting',
      'Chlorine is a Group 17 halogen alongside fluorine, bromine, and iodine.')
add_q('Which geometric polygon possesses EXACTLY SIX straight sides?',
      ['Pentagon', 'Hexagon', 'Heptagon', 'Octagon'], 'Hexagon', 'EASY', 'Mental Math', 'Geometry', 'Category Sorting',
      'A hexagon has six straight edges.')
add_q('Which computer storage architecture represents VOLATILE memory?',
      ['ROM', 'RAM', 'Hard Drive', 'Flash USB'], 'RAM', 'EASY', 'Science Reflexes', 'Computers', 'Category Sorting',
      'RAM loses its data when electrical power is cut.')
add_q('Which chemical element is an ALKALI METAL found in Group 1?',
      ['Magnesium', 'Potassium', 'Aluminum', 'Iron'], 'Potassium', 'MEDIUM', 'Science Reflexes', 'Periodic Table', 'Category Sorting',
      'Potassium is an alkali metal in Group 1.')
add_q('Which avian creature is a large flightless ratite bird native to Africa?',
      ['Eagle', 'Ostrich', 'Hawk', 'Seagull'], 'Ostrich', 'EASY', 'Science Reflexes', 'Zoology', 'Category Sorting',
      'Ostriches are flightless ratite birds native to Africa.')
add_q('Which of these software items is an OPERATING SYSTEM kernel?',
      ['Linux', 'Photoshop', 'Excel', 'Chrome'], 'Linux', 'EASY', 'Science Reflexes', 'Computers', 'Category Sorting',
      'Linux is an open-source Unix-like operating system kernel.')
add_q('Which of these combustible energy resources is a FOSSIL FUEL?',
      ['Uranium', 'Coal', 'Biomass', 'Hydro'], 'Coal', 'EASY', 'Science Reflexes', 'Energy', 'Category Sorting',
      'Coal is a combustible black sedimentary rock formed from ancient vegetation.')
add_q('Which shape is a quadrilateral having four equal sides and 90° right angles?',
      ['Rectangle', 'Square', 'Rhombus', 'Trapezoid'], 'Square', 'EASY', 'Mental Math', 'Geometry', 'Category Sorting',
      'A square has 4 congruent sides and 4 interior 90° right angles.')
add_q('Which blood component forms cellular plugs essential for coagulation (clotting)?',
      ['Red Blood Cells', 'Platelets (Thrombocytes)', 'White Blood Cells', 'Plasma'], 'Platelets (Thrombocytes)', 'EASY', 'Science Reflexes', 'Biology', 'Category Sorting',
      'Platelets aggregate to form hemostatic plugs preventing hemorrhage.')
add_q('Which celestial neighbor in our solar system is nicknamed the RED PLANET?',
      ['Venus', 'Mars', 'Jupiter', 'Mercury'], 'Mars', 'EASY', 'Science Reflexes', 'Astronomy', 'Category Sorting',
      'Mars appears reddish due to abundant iron oxide (rust) on its surface.')
add_q('Which atmospheric gas is mandatory for aerobic cellular respiration in mammals?',
      ['Carbon Dioxide', 'Oxygen', 'Helium', 'Nitrogen'], 'Oxygen', 'EASY', 'Science Reflexes', 'Biology', 'Category Sorting',
      'Oxygen acts as the terminal electron acceptor in cellular respiration.')
add_q('Which platform is an online web search engine, rather than a web browser?',
      ['Firefox', 'Google Search', 'Safari', 'Edge'], 'Google Search', 'EASY', 'Science Reflexes', 'Internet', 'Category Sorting',
      'Google Search is an indexing web engine; Firefox and Safari are client browsers.')
add_q('Which of these measurement units belongs to the international metric mass system?',
      ['Pound', 'Gram', 'Ounce', 'Stone'], 'Gram', 'EASY', 'Science Reflexes', 'Measurement', 'Category Sorting',
      'Gram is a standard metric unit of mass (0.001 kg).')
add_q('Which chemical metallic element remains in LIQUID state at 20°C room temperature?',
      ['Gold', 'Mercury', 'Silver', 'Copper'], 'Mercury', 'EASY', 'Science Reflexes', 'Chemistry', 'Category Sorting',
      'Mercury is liquid under normal room temperature and pressure.')
add_q('Which of these sovereign countries is situated in Southeast ASIA?',
      ['Nigeria', 'Vietnam', 'Peru', 'Poland'], 'Vietnam', 'EASY', 'General Knowledge', 'Geography', 'Category Sorting',
      'Vietnam is located in Southeast Asia.')
add_q('Which value is a whole signed INTEGER, rather than a decimal or fraction?',
      ['3/4', '2.5', '-7', '0.125'], '-7', 'EASY', 'Mental Math', 'Number Sets', 'Category Sorting',
      '-7 is a whole negative integer.')
add_q('Which of these chemical compounds is a strong ALKALI base with high pH?',
      ['Vinegar (Acetic Acid)', 'Sodium Hydroxide (NaOH)', 'Lemon Juice (Citric Acid)', 'Hydrochloric Acid'], 'Sodium Hydroxide (NaOH)', 'MEDIUM', 'Science Reflexes', 'Chemistry', 'Category Sorting',
      'NaOH is a strong chemical base with high pH.')
add_q('Which animal is an ECTOTHERMIC (cold-blooded) reptile?',
      ['Pigeon', 'Lizard', 'Rabbit', 'Tiger'], 'Lizard', 'EASY', 'Science Reflexes', 'Zoology', 'Category Sorting',
      'Lizards rely on ambient environmental heat to regulate body temperature.')
add_q('Which official currency is issued as legal tender in the UNITED KINGDOM?',
      ['Euro', 'British Pound Sterling', 'Dollar', 'Franc'], 'British Pound Sterling', 'EASY', 'General Knowledge', 'Currencies', 'Category Sorting',
      'The official legal tender of the UK is the Pound Sterling (£).')
add_q('Which internet protocol is utilized specifically to send outgoing email messages?',
      ['SMTP', 'HTTP', 'FTP', 'SSH'], 'SMTP', 'EASY', 'Science Reflexes', 'Networking', 'Category Sorting',
      'Simple Mail Transfer Protocol (SMTP) transmits outgoing electronic mail.')
add_q('Which astronomical body is the primary NATURAL SATELLITE orbiting Earth?',
      ['Hubble', 'Moon', 'ISS', 'GPS Satellite'], 'Moon', 'EASY', 'Science Reflexes', 'Astronomy', 'Category Sorting',
      'The Moon is Earth sole natural satellite.')

# --- PART 5: Lightning Capitals & National Identifiers (35) ---
add_q('What is the sovereign capital of JAPAN?',
      ['Osaka', 'Kyoto', 'Tokyo', 'Hiroshima'], 'Tokyo', 'EASY', 'General Knowledge', 'Capitals', 'Rapid Recall',
      'Tokyo is the capital of Japan.')
add_q('Which city serves as the federal capital of GERMANY?',
      ['Munich', 'Frankfurt', 'Berlin', 'Hamburg'], 'Berlin', 'EASY', 'General Knowledge', 'Capitals', 'Rapid Recall',
      'Berlin is the capital of Germany.')
add_q('Name the historic capital city of FRANCE:',
      ['Marseille', 'Lyon', 'Paris', 'Nice'], 'Paris', 'EASY', 'General Knowledge', 'Capitals', 'Rapid Recall',
      'Paris is the capital of France.')
add_q('Identify the national capital of ITALY:',
      ['Milan', 'Rome', 'Venice', 'Naples'], 'Rome', 'EASY', 'General Knowledge', 'Capitals', 'Rapid Recall',
      'Rome is the capital of Italy.')
add_q('What city serves as the seat of government in SPAIN?',
      ['Barcelona', 'Seville', 'Madrid', 'Valencia'], 'Madrid', 'EASY', 'General Knowledge', 'Capitals', 'Rapid Recall',
      'Madrid is the capital of Spain.')
add_q('Name the national capital city of RUSSIA:',
      ['Saint Petersburg', 'Kazan', 'Moscow', 'Novosibirsk'], 'Moscow', 'EASY', 'General Knowledge', 'Capitals', 'Rapid Recall',
      'Moscow is the capital of Russia.')
add_q('Which metropolis is the official capital of CHINA?',
      ['Shanghai', 'Guangzhou', 'Beijing', 'Shenzhen'], 'Beijing', 'EASY', 'General Knowledge', 'Capitals', 'Rapid Recall',
      'Beijing is the capital of China.')
add_q('Identify the ancient capital city of modern EGYPT:',
      ['Alexandria', 'Giza', 'Cairo', 'Luxor'], 'Cairo', 'EASY', 'General Knowledge', 'Capitals', 'Rapid Recall',
      'Cairo is the capital of Egypt.')
add_q('Which planned modern metropolis serves as the federal capital of BRAZIL?',
      ['Rio de Janeiro', 'Sao Paulo', 'Brasilia', 'Salvador'], 'Brasilia', 'MEDIUM', 'General Knowledge', 'Capitals', 'Rapid Recall',
      'Brasilia is the purpose-built federal capital of Brazil.')
add_q('What is the national capital city of SOUTH KOREA?',
      ['Busan', 'Incheon', 'Seoul', 'Daegu'], 'Seoul', 'EASY', 'General Knowledge', 'Capitals', 'Rapid Recall',
      'Seoul is the capital of South Korea.')
add_q('Identify the coastal capital city of ARGENTINA:',
      ['Cordoba', 'Rosario', 'Buenos Aires', 'Mendoza'], 'Buenos Aires', 'EASY', 'General Knowledge', 'Capitals', 'Rapid Recall',
      'Buenos Aires is the capital of Argentina.')
add_q('Which city is the political capital of TURKEY (not Istanbul)?',
      ['Istanbul', 'Ankara', 'Izmir', 'Antalya'], 'Ankara', 'MEDIUM', 'General Knowledge', 'Capitals', 'Rapid Recall',
      'Ankara is the capital of Turkey (not Istanbul).')
add_q('What is the federal capital of CANADA located in Ontario?',
      ['Ottawa', 'Calgary', 'Edmonton', 'Quebec City'], 'Ottawa', 'EASY', 'General Knowledge', 'Capitals', 'Rapid Recall',
      'Ottawa is the capital of Canada.')
add_q('Which planned city is the federal capital of AUSTRALIA?',
      ['Canberra', 'Perth', 'Adelaide', 'Hobart'], 'Canberra', 'EASY', 'General Knowledge', 'Capitals', 'Rapid Recall',
      'Canberra is the federal capital of Australia.')
add_q('Name the national capital territory of INDIA:',
      ['Mumbai', 'Kolkata', 'New Delhi', 'Bengaluru'], 'New Delhi', 'EASY', 'General Knowledge', 'Capitals', 'Rapid Recall',
      'New Delhi is the official national capital of India.')
add_q('What is the vibrant capital city of THAILAND?',
      ['Phuket', 'Chiang Mai', 'Bangkok', 'Pattaya'], 'Bangkok', 'EASY', 'General Knowledge', 'Capitals', 'Rapid Recall',
      'Bangkok is the capital of Thailand.')
add_q('Identify the historic cradle of democracy and capital of GREECE:',
      ['Sparta', 'Thessaloniki', 'Athens', 'Heraklion'], 'Athens', 'EASY', 'General Knowledge', 'Capitals', 'Rapid Recall',
      'Athens is the capital of Greece.')
add_q('What high-altitude metropolis serves as the capital of MEXICO?',
      ['Guadalajara', 'Monterrey', 'Mexico City', 'Cancun'], 'Mexico City', 'EASY', 'General Knowledge', 'Capitals', 'Rapid Recall',
      'Mexico City is the capital of Mexico.')
add_q('Name the Scandinavian capital city of NORWAY:',
      ['Bergen', 'Oslo', 'Trondheim', 'Stavanger'], 'Oslo', 'EASY', 'General Knowledge', 'Capitals', 'Rapid Recall',
      'Oslo is the capital of Norway.')
add_q('Which Baltic archipelago city is the capital of SWEDEN?',
      ['Gothenburg', 'Malmo', 'Stockholm', 'Uppsala'], 'Stockholm', 'EASY', 'General Knowledge', 'Capitals', 'Rapid Recall',
      'Stockholm is the capital of Sweden.')
add_q('Identify the royal capital of SAUDI ARABIA:',
      ['Jeddah', 'Mecca', 'Riyadh', 'Medina'], 'Riyadh', 'EASY', 'General Knowledge', 'Capitals', 'Rapid Recall',
      'Riyadh is the capital of Saudi Arabia.')
add_q('What city has historically served as the national capital of INDONESIA on Java?',
      ['Surabaya', 'Bandung', 'Jakarta', 'Medan'], 'Jakarta', 'EASY', 'General Knowledge', 'Capitals', 'Rapid Recall',
      'Jakarta has served as the historic capital of Indonesia.')
add_q('Which East African city serves as the capital of KENYA?',
      ['Mombasa', 'Kisumu', 'Nairobi', 'Nakuru'], 'Nairobi', 'EASY', 'General Knowledge', 'Capitals', 'Rapid Recall',
      'Nairobi is the capital of Kenya.')
add_q('Name the southern capital of NEW ZEALAND (not Auckland):',
      ['Auckland', 'Christchurch', 'Wellington', 'Hamilton'], 'Wellington', 'MEDIUM', 'General Knowledge', 'Capitals', 'Rapid Recall',
      'Wellington is the capital of New Zealand (not Auckland).')
add_q('Which federal city is the de facto capital of SWITZERLAND?',
      ['Zurich', 'Geneva', 'Bern', 'Basel'], 'Bern', 'MEDIUM', 'General Knowledge', 'Capitals', 'Rapid Recall',
      'Bern is the de facto federal city/capital of Switzerland.')
add_q('What Atlantic coastal city serves as the capital of PORTUGAL?',
      ['Porto', 'Braga', 'Lisbon', 'Coimbra'], 'Lisbon', 'EASY', 'General Knowledge', 'Capitals', 'Rapid Recall',
      'Lisbon is the capital of Portugal.')
add_q('Identify the historical capital city of POLAND on the Vistula River:',
      ['Krakow', 'Gdansk', 'Warsaw', 'Wroclaw'], 'Warsaw', 'EASY', 'General Knowledge', 'Capitals', 'Rapid Recall',
      'Warsaw is the capital of Poland.')
add_q('Which music-rich city on the Danube is the capital of AUSTRIA?',
      ['Salzburg', 'Innsbruck', 'Vienna', 'Graz'], 'Vienna', 'EASY', 'General Knowledge', 'Capitals', 'Rapid Recall',
      'Vienna is the capital of Austria.')
add_q('Name the constitutional capital of the NETHERLANDS:',
      ['Rotterdam', 'The Hague', 'Amsterdam', 'Utrecht'], 'Amsterdam', 'EASY', 'General Knowledge', 'Capitals', 'Rapid Recall',
      'Amsterdam is the constitutional capital of the Netherlands.')
add_q('Which European headquarters city is the sovereign capital of BELGIUM?',
      ['Antwerp', 'Ghent', 'Brussels', 'Bruges'], 'Brussels', 'EASY', 'General Knowledge', 'Capitals', 'Rapid Recall',
      'Brussels is the capital of Belgium.')
add_q('What is the national capital city of the Republic of IRELAND?',
      ['Cork', 'Galway', 'Dublin', 'Limerick'], 'Dublin', 'EASY', 'General Knowledge', 'Capitals', 'Rapid Recall',
      'Dublin is the capital of Ireland.')
add_q('Name the maritime capital city of DENMARK:',
      ['Aarhus', 'Odense', 'Copenhagen', 'Aalborg'], 'Copenhagen', 'EASY', 'General Knowledge', 'Capitals', 'Rapid Recall',
      'Copenhagen is the capital of Denmark.')
add_q('Which northern European coastal city is the capital of FINLAND?',
      ['Tampere', 'Turku', 'Helsinki', 'Oulu'], 'Helsinki', 'EASY', 'General Knowledge', 'Capitals', 'Rapid Recall',
      'Helsinki is the capital of Finland.')
add_q('Which city is the administrative and executive capital of SOUTH AFRICA?',
      ['Cape Town', 'Johannesburg', 'Pretoria', 'Durban'], 'Pretoria', 'MEDIUM', 'General Knowledge', 'Capitals', 'Rapid Recall',
      'Pretoria is the administrative and executive capital of South Africa.')
add_q('What modern skyline metropolis serves as the federal capital of MALAYSIA?',
      ['Penang', 'Johor Bahru', 'Kuala Lumpur', 'Malacca'], 'Kuala Lumpur', 'EASY', 'General Knowledge', 'Capitals', 'Rapid Recall',
      'Kuala Lumpur is the national capital of Malaysia.')

# --- PART 6: Reflex Magnitude & Fast Comparison (35) ---
add_q('Which decimal value represents the LARGEST quantity?',
      ['0.45', '0.5', '0.499', '0.09'], '0.5', 'EASY', 'Mental Math', 'Decimals', 'Rapid Comparison',
      '0.5 = 0.500, which is strictly greater than 0.499 or 0.45.')
add_q('Which of these four fractions holds the GREATEST numerical value?',
      ['1/2', '2/3', '3/5', '5/8'], '2/3', 'MEDIUM', 'Mental Math', 'Fractions', 'Rapid Comparison',
      '2/3 ≈ 0.667; 5/8 = 0.625; 3/5 = 0.60; 1/2 = 0.50.')
add_q('Which thermometer reading represents the COLDEST temperature?',
      ['0°C', '-5°C', '10°C', '-1°C'], '-5°C', 'EASY', 'Science Reflexes', 'Temperature', 'Rapid Comparison',
      '-5°C is the lowest temperature.')
add_q('Which integer has the smallest distance (is CLOSEST) to 100?',
      ['89', '94', '107', '112'], '94', 'EASY', 'Mental Math', 'Proximity', 'Rapid Comparison',
      '|94 - 100| = 6; |107 - 100| = 7.')
add_q('Which linear measurement indicates the LONGEST physical distance?',
      ['500 meters', '0.8 kilometers', '650 meters', '75,000 centimeters'], '0.8 kilometers', 'MEDIUM', 'Science Reflexes', 'Units', 'Rapid Comparison',
      '0.8 km = 800 m; 75,000 cm = 750 m; 650 m and 500 m are smaller.')
add_q('Which of these masses is the HEAVIEST?',
      ['1,500 grams', '2 kilograms', '1,800,000 milligrams', '1.2 kg'], '2 kilograms', 'EASY', 'Science Reflexes', 'Units', 'Rapid Comparison',
      '2 kg = 2,000 grams.')
add_q('Which time period represents the SHORTEST duration?',
      ['45 minutes', '0.5 hours', '2,400 seconds', '1,500 seconds'], '1,500 seconds', 'MEDIUM', 'Mental Math', 'Time', 'Rapid Comparison',
      '1,500 s = 25 minutes; 0.5 h = 30 min; 2,400 s = 40 min.')
add_q('Which fraction corresponds to EXACTLY 75%?',
      ['2/3', '3/4', '4/5', '5/6'], '3/4', 'EASY', 'Mental Math', 'Percentages', 'Rapid Comparison',
      '3/4 = 0.75 = 75%.')
add_q('What is the SMALLEST strictly positive integer?',
      ['0', '1', '2', '0.5'], '1', 'EASY', 'Mental Math', 'Number Sets', 'Rapid Comparison',
      '1 is the smallest positive whole integer (0 is neither positive nor negative).')
add_q('Which mathematical exponential expression evaluates to the GREATEST result?',
      ['2⁴ (2 to the 4th power)', '3³ (3 cubed)', '4² (4 squared)', '5² (5 squared)'], '3³ (3 cubed)', 'EASY', 'Mental Math', 'Powers', 'Rapid Comparison',
      '3³ = 27; 5² = 25; 2⁴ = 16; 4² = 16. The greatest is 27.')
add_q('Which 2D geometric polygon features the HIGHEST number of sides?',
      ['Pentagon', 'Hexagon', 'Octagon', 'Heptagon'], 'Octagon', 'EASY', 'Mental Math', 'Geometry', 'Rapid Comparison',
      'Octagon has 8 sides; Heptagon 7; Hexagon 6; Pentagon 5.')
add_q('Which digital storage capacity is the LARGEST?',
      ['500 Megabytes', '0.5 Gigabytes', '750 Megabytes', '0.8 Gigabytes'], '0.8 Gigabytes', 'EASY', 'Computers', 'Data Units', 'Rapid Comparison',
      '0.8 GB = 800 MB.')
add_q('Which SI metric prefix designates the SMALLEST fractional multiplier?',
      ['Milli-', 'Micro-', 'Nano-', 'Pico-'], 'Pico-', 'MEDIUM', 'Science Reflexes', 'Prefixes', 'Rapid Comparison',
      'Pico- is 10⁻¹²; Nano- is 10⁻⁹; Micro- is 10⁻⁶; Milli- is 10⁻³.')
add_q('Which decimal notation represents EXACTLY ONE-FOURTH (1/4)?',
      ['0.20', '0.25', '0.40', '0.50'], '0.25', 'EASY', 'Mental Math', 'Decimals', 'Rapid Comparison',
      '1 ÷ 4 = 0.25.')
add_q('Which geometric angle qualifies as an OBTUSE angle?',
      ['45°', '90°', '120°', '180°'], '120°', 'EASY', 'Mental Math', 'Geometry', 'Rapid Comparison',
      'An obtuse angle measures strictly between 90° and 180°.')
add_q('Which travelling speed is numerically the FASTEST velocity?',
      ['50 km/h', '15 m/s', '72 km/h', '18 m/s'], '72 km/h', 'MEDIUM', 'Science Reflexes', 'Physics', 'Rapid Comparison',
      '72 km/h = 20 m/s, which is faster than 18 m/s, 15 m/s, and 50 km/h (13.9 m/s).')
add_q('Which liquid container holds the GREATEST total volume capacity?',
      ['2 liters', '1,800 mL', '2,500 mL', '0.002 cubic meters'], '2,500 mL', 'EASY', 'Science Reflexes', 'Volume', 'Rapid Comparison',
      '2,500 mL = 2.5 liters.')
add_q('Which signed integer represents the LOWEST numerical value?',
      ['-10', '-25', '0', '-5'], '-25', 'EASY', 'Mental Math', 'Negative Numbers', 'Rapid Comparison',
      '-25 is the smallest (most negative) number.')
add_q('Which planetary body in the Solar System possesses the LARGEST equatorial diameter?',
      ['Earth', 'Venus', 'Jupiter', 'Mars'], 'Jupiter', 'EASY', 'Science Reflexes', 'Astronomy', 'Rapid Comparison',
      'Jupiter is the largest planet in our solar system.')
add_q('Which candidate fraction reduces directly to 1/2?',
      ['3/5', '4/8', '5/9', '6/14'], '4/8', 'EASY', 'Mental Math', 'Fractions', 'Rapid Comparison',
      '4/8 simplifies directly to 1/2.')
add_q('Which angular measurement designates a STRAIGHT angle?',
      ['90°', '180°', '270°', '360°'], '180°', 'EASY', 'Mental Math', 'Geometry', 'Rapid Comparison',
      'A straight angle equals exactly 180°.')
add_q('Which of these four decimal numbers has the GREATEST magnitude?',
      ['0.9', '0.89', '0.099', '0.899'], '0.9', 'EASY', 'Mental Math', 'Decimals', 'Rapid Comparison',
      '0.9 = 0.900, which is greater than 0.899.')
add_q('Which terrestrial mammal achieves the FASTEST sprinting speed on land?',
      ['Lion', 'Cheetah', 'Horse', 'Gazelle'], 'Cheetah', 'EASY', 'General Knowledge', 'Zoology', 'Rapid Comparison',
      'The cheetah can reach sprinting speeds up to 110-120 km/h.')
add_q('Which calendar year is an astronomical LEAP YEAR (366 days)?',
      ['2019', '2020', '2021', '2022'], '2020', 'EASY', 'General Knowledge', 'Calendar', 'Rapid Comparison',
      '2020 is divisible by 4 and is a leap year.')
add_q('Which chemical element has the LIGHTEST atomic mass on the periodic table?',
      ['Hydrogen', 'Nitrogen', 'Oxygen', 'Argon'], 'Hydrogen', 'EASY', 'Science Reflexes', 'Periodic Table', 'Rapid Comparison',
      'Hydrogen has atomic mass ≈ 1.008.')
add_q('Which storage data unit is strictly LARGER than a Gigabyte (GB)?',
      ['Megabyte', 'Kilobyte', 'Terabyte', 'Byte'], 'Terabyte', 'EASY', 'Computers', 'Data Units', 'Rapid Comparison',
      '1 Terabyte = 1,024 Gigabytes.')
add_q('Which simple fraction evaluates to EXACTLY 20%?',
      ['1/4', '1/5', '1/6', '1/10'], '1/5', 'EASY', 'Mental Math', 'Percentages', 'Rapid Comparison',
      '1/5 = 0.20 = 20%.')
add_q('Which polygon shape has the FEWEST number of edges/vertices?',
      ['Quadrilateral', 'Triangle', 'Pentagon', 'Hexagon'], 'Triangle', 'EASY', 'Mental Math', 'Geometry', 'Rapid Comparison',
      'A triangle has 3 sides.')
add_q('Which fractional value represents the SMALLEST positive quantity?',
      ['1/10', '1/100', '1/1000', '1/2'], '1/1000', 'EASY', 'Mental Math', 'Fractions', 'Rapid Comparison',
      '1/1000 = 0.001.')
add_q('Which quadrilateral is a REGULAR polygon with 4 equal sides and 4 equal angles?',
      ['Rectangle', 'Parallelogram', 'Square', 'Trapezoid'], 'Square', 'EASY', 'Mental Math', 'Geometry', 'Rapid Comparison',
      'A square is the unique regular quadrilateral.')
add_q('Which planetary neighbor is the HOTTEST planet in the solar system (~465°C)?',
      ['Mercury', 'Venus', 'Pluto', 'Mars'], 'Venus', 'EASY', 'Science Reflexes', 'Astronomy', 'Rapid Comparison',
      'Venus has an average surface temperature of ~465°C due to runaway greenhouse effect.')
add_q('Which measured distance is LONGEST overall?',
      ['1,000 meters', '1 kilometer', '1,200 yards', '1 mile'], '1 mile', 'MEDIUM', 'Science Reflexes', 'Measurement', 'Rapid Comparison',
      '1 mile ≈ 1,609 meters; 1,200 yards ≈ 1,097 meters; 1 km = 1,000 meters.')
add_q('Which of these signed numbers has the LARGEST absolute value |x|?',
      ['15', '-22', '18', '-19'], '-22', 'EASY', 'Mental Math', 'Absolute Value', 'Rapid Comparison',
      '|-22| = 22, which is greater than 19, 18, and 15.')
add_q('Which fraction is exactly equivalent to the decimal 0.6?',
      ['1/3', '2/5', '3/5', '5/8'], '3/5', 'EASY', 'Mental Math', 'Fractions', 'Rapid Comparison',
      '3/5 = 0.60.')
add_q('Which Roman numeral symbol represents the number 50?',
      ['V', 'X', 'L', 'C'], 'L', 'EASY', 'General Knowledge', 'Roman Numerals', 'Rapid Comparison',
      'L represents 50 (V=5, X=10, C=100).')

print(f'Total SPEED questions authored: {len(questions)}')

# Save to scripts/data/round5_speed.json
os.makedirs('scripts/data', exist_ok=True)
with open('scripts/data/round5_speed.json', 'w', encoding='utf-8') as out:
    json.dump(questions, out, indent=2, ensure_ascii=False)
print('Successfully saved scripts/data/round5_speed.json')
