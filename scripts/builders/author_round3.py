# scripts/builders/author_round3.py
# Generates 225 diverse, verified MEMORY questions
import json
import os

questions = []

def add_q(prompt, options, correct_answer, difficulty, category, subcategory, pattern_type, explanation, time_limit=25):
    assert len(options) == 4, f'Options count must be 4: {prompt}'
    assert len(set(options)) == 4, f'Options must be unique: {prompt}'
    assert correct_answer in options, f'Correct answer must be in options: {prompt}'
    assert difficulty in ['EASY', 'MEDIUM', 'HARD'], f'Invalid difficulty: {difficulty}'
    questions.append({
        'round_type': 'MEMORY',
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

# --- PART 1: Exact Sequence & Emoji Permutation Recall (40) ---
add_q('Memorize & recall the 4-symbol sequence: [💎, ⚡, 👑, 🔥]. Which option matches the original order?',
      ['💎, ⚡, 👑, 🔥', '⚡, 💎, 🔥, 👑', '👑, 💎, ⚡, 🔥', '🔥, ⚡, 💎, 👑'], '💎, ⚡, 👑, 🔥', 'MEDIUM', 'Memory & Recall', 'Emoji Sequences', 'Sequence Retention',
      'The original sequence is [💎, ⚡, 👑, 🔥].')
add_q('Memorize & recall the 4-color pattern: [Red, Blue, Green, Yellow]. Which option reproduces the exact sequence?',
      ['Red, Blue, Green, Yellow', 'Blue, Red, Yellow, Green', 'Green, Red, Blue, Yellow', 'Yellow, Blue, Green, Red'], 'Red, Blue, Green, Yellow', 'MEDIUM', 'Memory & Recall', 'Color Sequences', 'Sequence Retention',
      'The original order is [Red, Blue, Green, Yellow].')
add_q('Memorize the 4-fruit sequence: [Apple, Banana, Cherry, Date]. Which option matches the exact original order?',
      ['Apple, Banana, Cherry, Date', 'Banana, Apple, Date, Cherry', 'Cherry, Banana, Apple, Date', 'Date, Cherry, Banana, Apple'], 'Apple, Banana, Cherry, Date', 'EASY', 'Memory & Recall', 'Word Sequences', 'Sequence Retention',
      'The original order is [Apple, Banana, Cherry, Date].')
add_q('Memorize the 4-shape sequence: [Circle, Triangle, Square, Pentagon]. Which option reproduces the original sequence?',
      ['Circle, Triangle, Square, Pentagon', 'Triangle, Circle, Pentagon, Square', 'Square, Circle, Triangle, Pentagon', 'Pentagon, Square, Triangle, Circle'], 'Circle, Triangle, Square, Pentagon', 'EASY', 'Memory & Recall', 'Shape Sequences', 'Sequence Retention',
      'The original order is [Circle, Triangle, Square, Pentagon].')
add_q('Memorize the celestial sequence: [Sun, Moon, Star, Comet]. Which option matches the original order?',
      ['Sun, Moon, Star, Comet', 'Moon, Sun, Comet, Star', 'Star, Moon, Sun, Comet', 'Comet, Star, Moon, Sun'], 'Sun, Moon, Star, Comet', 'EASY', 'Memory & Recall', 'Celestial Sequences', 'Sequence Retention',
      'The original order is [Sun, Moon, Star, Comet].')
add_q('Memorize & recall the 4-card suit sequence: [♠ Spades, ♥ Hearts, ♦ Diamonds, ♣ Clubs]. Which option matches the original order?',
      ['♠ Spades, ♥ Hearts, ♦ Diamonds, ♣ Clubs', '♥ Hearts, ♠ Spades, ♣ Clubs, ♦ Diamonds', '♦ Diamonds, ♠ Spades, ♥ Hearts, ♣ Clubs', '♣ Clubs, ♦ Diamonds, ♥ Hearts, ♠ Spades'], '♠ Spades, ♥ Hearts, ♦ Diamonds, ♣ Clubs', 'MEDIUM', 'Memory & Recall', 'Symbol Sequences', 'Sequence Retention',
      'The original order is [♠ Spades, ♥ Hearts, ♦ Diamonds, ♣ Clubs].')
add_q('Memorize the Greek letter sequence: [Alpha, Beta, Gamma, Delta]. Which option reproduces the exact order?',
      ['Alpha, Beta, Gamma, Delta', 'Beta, Alpha, Delta, Gamma', 'Gamma, Beta, Alpha, Delta', 'Delta, Gamma, Beta, Alpha'], 'Alpha, Beta, Gamma, Delta', 'EASY', 'Memory & Recall', 'Greek Letters', 'Sequence Retention',
      'The original order is [Alpha, Beta, Gamma, Delta].')
add_q('Memorize the 4-instrument sequence: [Violin, Flute, Drum, Piano]. Which option reproduces the exact sequence?',
      ['Violin, Flute, Drum, Piano', 'Flute, Violin, Piano, Drum', 'Drum, Flute, Violin, Piano', 'Piano, Drum, Flute, Violin'], 'Violin, Flute, Drum, Piano', 'MEDIUM', 'Memory & Recall', 'Word Sequences', 'Sequence Retention',
      'The original order is [Violin, Flute, Drum, Piano].')
add_q('Memorize the 4-element sequence: [Earth, Air, Fire, Water]. Which option matches the exact order?',
      ['Earth, Air, Fire, Water', 'Air, Earth, Water, Fire', 'Fire, Air, Earth, Water', 'Water, Fire, Air, Earth'], 'Earth, Air, Fire, Water', 'EASY', 'Memory & Recall', 'Classical Elements', 'Sequence Retention',
      'The original order is [Earth, Air, Fire, Water].')
add_q('Memorize the 4-currency sequence: [Dollar, Euro, Pound, Yen]. Which option reproduces the exact original order?',
      ['Dollar, Euro, Pound, Yen', 'Euro, Dollar, Yen, Pound', 'Pound, Euro, Dollar, Yen', 'Yen, Pound, Euro, Dollar'], 'Dollar, Euro, Pound, Yen', 'EASY', 'Memory & Recall', 'Currencies', 'Sequence Retention',
      'The original order is [Dollar, Euro, Pound, Yen].')
add_q('Memorize the 4-gemstone sequence: [Ruby, Emerald, Sapphire, Diamond]. Which option matches the exact order?',
      ['Ruby, Emerald, Sapphire, Diamond', 'Emerald, Ruby, Diamond, Sapphire', 'Sapphire, Emerald, Ruby, Diamond', 'Diamond, Sapphire, Emerald, Ruby'], 'Ruby, Emerald, Sapphire, Diamond', 'MEDIUM', 'Memory & Recall', 'Gemstones', 'Sequence Retention',
      'The original order is [Ruby, Emerald, Sapphire, Diamond].')
add_q('Memorize the 4-metal sequence: [Gold, Silver, Bronze, Platinum]. Which option matches the original order?',
      ['Gold, Silver, Bronze, Platinum', 'Silver, Gold, Platinum, Bronze', 'Bronze, Silver, Gold, Platinum', 'Platinum, Bronze, Silver, Gold'], 'Gold, Silver, Bronze, Platinum', 'EASY', 'Memory & Recall', 'Metals', 'Sequence Retention',
      'The original order is [Gold, Silver, Bronze, Platinum].')
add_q('Memorize the 4-season sequence: [Spring, Summer, Autumn, Winter]. Which option reproduces the exact order?',
      ['Spring, Summer, Autumn, Winter', 'Summer, Spring, Winter, Autumn', 'Autumn, Summer, Spring, Winter', 'Winter, Autumn, Summer, Spring'], 'Spring, Summer, Autumn, Winter', 'EASY', 'Memory & Recall', 'Seasons', 'Sequence Retention',
      'The original order is [Spring, Summer, Autumn, Winter].')
add_q('Memorize the 4-direction sequence: [North, East, South, West]. Which option matches the exact order?',
      ['North, East, South, West', 'East, North, West, South', 'South, East, North, West', 'West, South, East, North'], 'North, East, South, West', 'EASY', 'Memory & Recall', 'Compass Directions', 'Sequence Retention',
      'The original order is [North, East, South, West].')
add_q('Memorize the 4-digit sequence: [7, 3, 9, 2]. Which option reproduces the exact sequence?',
      ['7, 3, 9, 2', '3, 7, 2, 9', '9, 3, 7, 2', '2, 9, 3, 7'], '7, 3, 9, 2', 'EASY', 'Memory & Recall', 'Digit Sequences', 'Sequence Retention',
      'The original order is [7, 3, 9, 2].')
add_q('Memorize the 4-digit sequence: [5, 8, 1, 4]. Which option reproduces the exact sequence?',
      ['5, 8, 1, 4', '8, 5, 4, 1', '1, 5, 8, 4', '4, 1, 8, 5'], '5, 8, 1, 4', 'EASY', 'Memory & Recall', 'Digit Sequences', 'Sequence Retention',
      'The original order is [5, 8, 1, 4].')
add_q('Memorize the 4-symbol sequence: [🚀, 🛰️, 🛸, 🪐]. Which option matches the original order?',
      ['🚀, 🛰️, 🛸, 🪐', '🛰️, 🚀, 🪐, 🛸', '🛸, 🚀, 🛰️, 🪐', '🪐, 🛸, 🛰️, 🚀'], '🚀, 🛰️, 🛸, 🪐', 'MEDIUM', 'Memory & Recall', 'Emoji Sequences', 'Sequence Retention',
      'The original sequence is [🚀, 🛰️, 🛸, 🪐].')
add_q('Memorize the 4-animal sequence: [Lion, Tiger, Leopard, Cheetah]. Which option reproduces the exact order?',
      ['Lion, Tiger, Leopard, Cheetah', 'Tiger, Lion, Cheetah, Leopard', 'Leopard, Tiger, Lion, Cheetah', 'Cheetah, Leopard, Tiger, Lion'], 'Lion, Tiger, Leopard, Cheetah', 'EASY', 'Memory & Recall', 'Animals', 'Sequence Retention',
      'The original order is [Lion, Tiger, Leopard, Cheetah].')
add_q('Memorize the 4-planet sequence: [Mercury, Venus, Earth, Mars]. Which option reproduces the exact order?',
      ['Mercury, Venus, Earth, Mars', 'Venus, Mercury, Mars, Earth', 'Earth, Venus, Mercury, Mars', 'Mars, Earth, Venus, Mercury'], 'Mercury, Venus, Earth, Mars', 'EASY', 'Memory & Recall', 'Planets', 'Sequence Retention',
      'The original order is [Mercury, Venus, Earth, Mars].')
add_q('Memorize the 4-tree sequence: [Oak, Pine, Birch, Cedar]. Which option matches the exact order?',
      ['Oak, Pine, Birch, Cedar', 'Pine, Oak, Cedar, Birch', 'Birch, Pine, Oak, Cedar', 'Cedar, Birch, Pine, Oak'], 'Oak, Pine, Birch, Cedar', 'EASY', 'Memory & Recall', 'Trees', 'Sequence Retention',
      'The original order is [Oak, Pine, Birch, Cedar].')

# --- PART 2: Ordinal Position Retrieval (40) ---
add_q('Retain this 4-word sequence: [Mercury, Venus, Earth, Mars]. Which planet appeared in the 3rd position?',
      ['Mercury', 'Venus', 'Earth', 'Mars'], 'Earth', 'EASY', 'Memory & Recall', 'Ordinal Recall', 'Position Retrieval',
      'In the sequence [Mercury, Venus, Earth, Mars], Earth is the 3rd item.')
add_q('Study this ordered list: [Router, Switch, Firewall, Gateway]. Which network device was in the 2nd position?',
      ['Router', 'Switch', 'Firewall', 'Gateway'], 'Switch', 'EASY', 'Memory & Recall', 'Ordinal Recall', 'Position Retrieval',
      'In the sequence [Router, Switch, Firewall, Gateway], Switch is the 2nd item.')
add_q('Remember this 4-item list: [Argon, Neon, Helium, Krypton]. Which noble gas occupied the 1st position?',
      ['Argon', 'Neon', 'Helium', 'Krypton'], 'Argon', 'EASY', 'Memory & Recall', 'Ordinal Recall', 'Position Retrieval',
      'In the list [Argon, Neon, Helium, Krypton], Argon is the 1st item.')
add_q('Study the 4-city order: [Tokyo, Paris, Cairo, Lima]. Which city appeared in the 4th position?',
      ['Tokyo', 'Paris', 'Cairo', 'Lima'], 'Lima', 'EASY', 'Memory & Recall', 'Ordinal Recall', 'Position Retrieval',
      'In [Tokyo, Paris, Cairo, Lima], Lima is the 4th item.')
add_q('Memorize the code sequence: [Echo, Bravo, Delta, Alpha]. Which phonetic codeword was 3rd?',
      ['Echo', 'Bravo', 'Delta', 'Alpha'], 'Delta', 'MEDIUM', 'Memory & Recall', 'Phonetic Codes', 'Position Retrieval',
      'In [Echo, Bravo, Delta, Alpha], Delta is in the 3rd position.')
add_q('Retain this list: [Copper, Zinc, Nickel, Cobalt]. Which metal was listed in the 2nd position?',
      ['Copper', 'Zinc', 'Nickel', 'Cobalt'], 'Zinc', 'EASY', 'Memory & Recall', 'Ordinal Recall', 'Position Retrieval',
      'In [Copper, Zinc, Nickel, Cobalt], Zinc is the 2nd item.')
add_q('Study the sequence: [Cello, Viola, Harp, Flute]. Which instrument was in the 3rd position?',
      ['Cello', 'Viola', 'Harp', 'Flute'], 'Harp', 'EASY', 'Memory & Recall', 'Ordinal Recall', 'Position Retrieval',
      'In [Cello, Viola, Harp, Flute], Harp is the 3rd item.')
add_q('Memorize this sequence of terrestrial planets: [Mercury, Venus, Earth, Mars]. Which planet was 1st?',
      ['Mercury', 'Venus', 'Earth', 'Mars'], 'Mercury', 'EASY', 'Memory & Recall', 'Ordinal Recall', 'Position Retrieval',
      'In [Mercury, Venus, Earth, Mars], Mercury is the 1st item.')
add_q('Retain this list: [Amazon, Nile, Yangtze, Danube]. Which river was in the 4th position?',
      ['Amazon', 'Nile', 'Yangtze', 'Danube'], 'Danube', 'EASY', 'Memory & Recall', 'Ordinal Recall', 'Position Retrieval',
      'In [Amazon, Nile, Yangtze, Danube], Danube is the 4th item.')
add_q('Study the sequence: [Graphene, Diamond, Fullerene, Graphite]. Which allotrope was 2nd?',
      ['Graphene', 'Diamond', 'Fullerene', 'Graphite'], 'Diamond', 'MEDIUM', 'Memory & Recall', 'Ordinal Recall', 'Position Retrieval',
      'In [Graphene, Diamond, Fullerene, Graphite], Diamond is in the 2nd position.')
add_q('Memorize the list: [Proton, Electron, Neutron, Positron]. Which subatomic particle was 3rd?',
      ['Proton', 'Electron', 'Neutron', 'Positron'], 'Neutron', 'EASY', 'Memory & Recall', 'Ordinal Recall', 'Position Retrieval',
      'In [Proton, Electron, Neutron, Positron], Neutron is in the 3rd position.')
add_q('Retain the sequence: [Sapphire, Ruby, Topaz, Opal]. Which gemstone was 1st?',
      ['Sapphire', 'Ruby', 'Topaz', 'Opal'], 'Sapphire', 'EASY', 'Memory & Recall', 'Ordinal Recall', 'Position Retrieval',
      'In [Sapphire, Ruby, Topaz, Opal], Sapphire is the 1st item.')
add_q('Study this list: [Himalayas, Andes, Rockies, Alps]. Which mountain range was 2nd?',
      ['Himalayas', 'Andes', 'Rockies', 'Alps'], 'Andes', 'EASY', 'Memory & Recall', 'Ordinal Recall', 'Position Retrieval',
      'In [Himalayas, Andes, Rockies, Alps], Andes is the 2nd item.')
add_q('Memorize the 4 numbers: [42, 17, 89, 63]. Which number was in the 4th position?',
      ['42', '17', '89', '63'], '63', 'EASY', 'Memory & Recall', 'Ordinal Recall', 'Position Retrieval',
      'In [42, 17, 89, 63], 63 is the 4th number.')
add_q('Retain this order: [Python, Rust, Kotlin, Swift]. Which programming language was 1st?',
      ['Python', 'Rust', 'Kotlin', 'Swift'], 'Python', 'EASY', 'Memory & Recall', 'Ordinal Recall', 'Position Retrieval',
      'In [Python, Rust, Kotlin, Swift], Python is the 1st language.')
add_q('Study the order: [Oxygen, Nitrogen, Hydrogen, Carbon]. Which element was in the 3rd position?',
      ['Oxygen', 'Nitrogen', 'Hydrogen', 'Carbon'], 'Hydrogen', 'EASY', 'Memory & Recall', 'Ordinal Recall', 'Position Retrieval',
      'In [Oxygen, Nitrogen, Hydrogen, Carbon], Hydrogen is the 3rd element.')
add_q('Memorize the list: [Cornea, Retina, Iris, Pupil]. Which anatomical part of the eye was 2nd?',
      ['Cornea', 'Retina', 'Iris', 'Pupil'], 'Retina', 'MEDIUM', 'Memory & Recall', 'Ordinal Recall', 'Position Retrieval',
      'In [Cornea, Retina, Iris, Pupil], Retina is the 2nd item.')
add_q('Retain this list: [Linux, Windows, macOS, Android]. Which operating system was 4th?',
      ['Linux', 'Windows', 'macOS', 'Android'], 'Android', 'EASY', 'Memory & Recall', 'Ordinal Recall', 'Position Retrieval',
      'In [Linux, Windows, macOS, Android], Android is the 4th OS.')
add_q('Study the sequence: [TCP, UDP, IP, ICMP]. Which protocol was in the 1st position?',
      ['TCP', 'UDP', 'IP', 'ICMP'], 'TCP', 'EASY', 'Memory & Recall', 'Ordinal Recall', 'Position Retrieval',
      'In [TCP, UDP, IP, ICMP], TCP is the 1st protocol.')
add_q('Memorize the list: [Gold, Silver, Platinum, Palladium]. Which precious metal was 3rd?',
      ['Gold', 'Silver', 'Platinum', 'Palladium'], 'Platinum', 'MEDIUM', 'Memory & Recall', 'Ordinal Recall', 'Position Retrieval',
      'In [Gold, Silver, Platinum, Palladium], Platinum is the 3rd metal.')

# --- PART 3: Predecessor & Successor Recall (35) ---
add_q('Study this order: [Router, Switch, Firewall, Server]. Which device immediately preceded Firewall?',
      ['Router', 'Switch', 'Server', 'Gateway'], 'Switch', 'MEDIUM', 'Memory & Recall', 'Relative Position', 'Predecessor Recall',
      'In [Router, Switch, Firewall, Server], Switch immediately precedes Firewall.')
add_q('Memorize this sequence: [Alpha, Beta, Gamma, Delta]. Which letter immediately followed Beta?',
      ['Alpha', 'Gamma', 'Delta', 'Epsilon'], 'Gamma', 'EASY', 'Memory & Recall', 'Relative Position', 'Successor Recall',
      'Gamma immediately follows Beta in the sequence [Alpha, Beta, Gamma, Delta].')
add_q('Study the order: [Mercury, Venus, Earth, Mars]. Which planet immediately preceded Earth?',
      ['Mercury', 'Venus', 'Mars', 'Jupiter'], 'Venus', 'EASY', 'Memory & Recall', 'Relative Position', 'Predecessor Recall',
      'Venus immediately precedes Earth in the sequence [Mercury, Venus, Earth, Mars].')
add_q('Memorize this list: [Spring, Summer, Autumn, Winter]. Which season immediately followed Summer?',
      ['Spring', 'Autumn', 'Winter', 'Monsoon'], 'Autumn', 'EASY', 'Memory & Recall', 'Relative Position', 'Successor Recall',
      'Autumn immediately follows Summer in [Spring, Summer, Autumn, Winter].')
add_q('Study the sequence: [Red, Orange, Yellow, Green]. Which color immediately preceded Yellow?',
      ['Red', 'Orange', 'Green', 'Blue'], 'Orange', 'EASY', 'Memory & Recall', 'Relative Position', 'Predecessor Recall',
      'Orange immediately precedes Yellow in [Red, Orange, Yellow, Green].')
add_q('Memorize the order: [Gold, Silver, Bronze, Copper]. Which metal immediately followed Silver?',
      ['Gold', 'Bronze', 'Copper', 'Iron'], 'Bronze', 'EASY', 'Memory & Recall', 'Relative Position', 'Successor Recall',
      'Bronze immediately follows Silver in [Gold, Silver, Bronze, Copper].')
add_q('Study this list: [Circle, Triangle, Square, Pentagon]. Which shape immediately preceded Square?',
      ['Circle', 'Triangle', 'Pentagon', 'Hexagon'], 'Triangle', 'EASY', 'Memory & Recall', 'Relative Position', 'Predecessor Recall',
      'Triangle immediately precedes Square in [Circle, Triangle, Square, Pentagon].')
add_q('Memorize the sequence: [North, East, South, West]. Which direction immediately followed East?',
      ['North', 'South', 'West', 'Northeast'], 'South', 'EASY', 'Memory & Recall', 'Relative Position', 'Successor Recall',
      'South immediately follows East in [North, East, South, West].')
add_q('Study the list: [Violin, Viola, Cello, Bass]. Which instrument immediately preceded Cello?',
      ['Violin', 'Viola', 'Bass', 'Harp'], 'Viola', 'MEDIUM', 'Memory & Recall', 'Relative Position', 'Predecessor Recall',
      'Viola immediately precedes Cello in [Violin, Viola, Cello, Bass].')
add_q('Memorize this order: [Solid, Liquid, Gas, Plasma]. Which state of matter immediately followed Liquid?',
      ['Solid', 'Gas', 'Plasma', 'Superfluid'], 'Gas', 'EASY', 'Memory & Recall', 'Relative Position', 'Successor Recall',
      'Gas immediately follows Liquid in [Solid, Liquid, Gas, Plasma].')
add_q('Study this order: [Apple, Banana, Cherry, Date]. Which fruit immediately preceded Date?',
      ['Apple', 'Banana', 'Cherry', 'Elderberry'], 'Cherry', 'EASY', 'Memory & Recall', 'Relative Position', 'Predecessor Recall',
      'Cherry immediately precedes Date in [Apple, Banana, Cherry, Date].')
add_q('Memorize the list: [Proton, Neutron, Electron, Photon]. Which particle immediately followed Neutron?',
      ['Proton', 'Electron', 'Photon', 'Neutrino'], 'Electron', 'EASY', 'Memory & Recall', 'Relative Position', 'Successor Recall',
      'Electron immediately follows Neutron in [Proton, Neutron, Electron, Photon].')
add_q('Study the sequence: [Kilobyte, Megabyte, Gigabyte, Terabyte]. Which unit immediately preceded Terabyte?',
      ['Kilobyte', 'Megabyte', 'Gigabyte', 'Petabyte'], 'Gigabyte', 'EASY', 'Memory & Recall', 'Relative Position', 'Predecessor Recall',
      'Gigabyte immediately precedes Terabyte in [Kilobyte, Megabyte, Gigabyte, Terabyte].')
add_q('Memorize the order: [Delhi, Mumbai, Kolkata, Chennai]. Which city immediately followed Mumbai?',
      ['Delhi', 'Kolkata', 'Chennai', 'Bengaluru'], 'Kolkata', 'EASY', 'Memory & Recall', 'Relative Position', 'Successor Recall',
      'Kolkata immediately follows Mumbai in [Delhi, Mumbai, Kolkata, Chennai].')
add_q('Study the list: [Troposphere, Stratosphere, Mesosphere, Thermosphere]. Which atmospheric layer immediately preceded Mesosphere?',
      ['Troposphere', 'Stratosphere', 'Thermosphere', 'Exosphere'], 'Stratosphere', 'MEDIUM', 'Memory & Recall', 'Relative Position', 'Predecessor Recall',
      'Stratosphere immediately precedes Mesosphere in [Troposphere, Stratosphere, Mesosphere, Thermosphere].')
add_q('Memorize the sequence: [10, 25, 50, 100]. Which number immediately followed 25?',
      ['10', '50', '100', '75'], '50', 'EASY', 'Memory & Recall', 'Relative Position', 'Successor Recall',
      '50 immediately follows 25 in [10, 25, 50, 100].')
add_q('Study the list: [Genesis, Exodus, Leviticus, Numbers]. Which book immediately preceded Numbers?',
      ['Genesis', 'Exodus', 'Leviticus', 'Deuteronomy'], 'Leviticus', 'HARD', 'Memory & Recall', 'Relative Position', 'Predecessor Recall',
      'Leviticus immediately precedes Numbers in the provided list.')
add_q('Memorize this order: [Iron, Copper, Silver, Gold]. Which metal immediately followed Copper?',
      ['Iron', 'Silver', 'Gold', 'Bronze'], 'Silver', 'EASY', 'Memory & Recall', 'Relative Position', 'Successor Recall',
      'Silver immediately follows Copper in [Iron, Copper, Silver, Gold].')

# --- PART 4: Missing & Included Item Recall (35) ---
add_q('A presented list contained: [Argon, Neon, Helium, Krypton]. Which of the following elements was present in that list?',
      ['Xenon', 'Radon', 'Argon', 'Nitrogen'], 'Argon', 'EASY', 'Memory & Recall', 'Set Membership', 'Item Recognition',
      'Argon was one of the four elements in [Argon, Neon, Helium, Krypton].')
add_q('The memorized set was: [Sapphire, Emerald, Ruby, Topaz]. Which gemstone was part of the original set?',
      ['Diamond', 'Opal', 'Emerald', 'Amethyst'], 'Emerald', 'EASY', 'Memory & Recall', 'Set Membership', 'Item Recognition',
      'Emerald was included in [Sapphire, Emerald, Ruby, Topaz].')
add_q('A four-item list showed: [Nile, Amazon, Yangtze, Mississippi]. Which river was in the original list?',
      ['Danube', 'Volga', 'Yangtze', 'Thames'], 'Yangtze', 'EASY', 'Memory & Recall', 'Set Membership', 'Item Recognition',
      'Yangtze was in the original four-item list.')
add_q('The initial list contained: [Pluto, Ceres, Eris, Haumea]. Which dwarf planet was NOT in the initial list?',
      ['Pluto', 'Ceres', 'Makemake', 'Eris'], 'Makemake', 'MEDIUM', 'Memory & Recall', 'Exclusion Recognition', 'Item Recognition',
      'Makemake was not in the original list [Pluto, Ceres, Eris, Haumea].')
add_q('A set contained the animals: [Lion, Leopard, Cheetah, Jaguar]. Which animal was in the set?',
      ['Tiger', 'Puma', 'Leopard', 'Cougar'], 'Leopard', 'EASY', 'Memory & Recall', 'Set Membership', 'Item Recognition',
      'Leopard was part of the set [Lion, Leopard, Cheetah, Jaguar].')
add_q('The memorized group consisted of: [Tokyo, Seoul, Beijing, Bangkok]. Which Asian capital was in the group?',
      ['Hanoi', 'Seoul', 'Manila', 'Jakarta'], 'Seoul', 'EASY', 'Memory & Recall', 'Set Membership', 'Item Recognition',
      'Seoul was in the list [Tokyo, Seoul, Beijing, Bangkok].')
add_q('A sequence displayed: [Python, C++, Java, JavaScript]. Which language was NOT in the sequence?',
      ['Python', 'Rust', 'Java', 'C++'], 'Rust', 'EASY', 'Memory & Recall', 'Exclusion Recognition', 'Item Recognition',
      'Rust was not in the original list [Python, C++, Java, JavaScript].')
add_q('The initial group showed: [Mars, Venus, Saturn, Neptune]. Which planet was present in the group?',
      ['Jupiter', 'Uranus', 'Venus', 'Mercury'], 'Venus', 'EASY', 'Memory & Recall', 'Set Membership', 'Item Recognition',
      'Venus was in the group [Mars, Venus, Saturn, Neptune].')
add_q('A set contained the musical notes: [Do, Re, Mi, Fa]. Which note was part of the set?',
      ['Sol', 'La', 'Mi', 'Ti'], 'Mi', 'EASY', 'Memory & Recall', 'Set Membership', 'Item Recognition',
      'Mi was part of the set [Do, Re, Mi, Fa].')
add_q('The memorized set included: [Diamond, Graphite, Graphene, Fullerene]. Which carbon allotrope was in the set?',
      ['Lonsdaleite', 'Graphite', 'Carbyne', 'Amorphous Carbon'], 'Graphite', 'MEDIUM', 'Memory & Recall', 'Set Membership', 'Item Recognition',
      'Graphite was in the set [Diamond, Graphite, Graphene, Fullerene].')
add_q('A list showed: [Hydrogen, Helium, Lithium, Beryllium]. Which chemical element was in the list?',
      ['Boron', 'Carbon', 'Lithium', 'Nitrogen'], 'Lithium', 'EASY', 'Memory & Recall', 'Set Membership', 'Item Recognition',
      'Lithium was present in [Hydrogen, Helium, Lithium, Beryllium].')
add_q('The initial set showed: [TCP, UDP, FTP, HTTP]. Which protocol was in the set?',
      ['SMTP', 'DNS', 'UDP', 'SSH'], 'UDP', 'EASY', 'Memory & Recall', 'Set Membership', 'Item Recognition',
      'UDP was in the set [TCP, UDP, FTP, HTTP].')
add_q('A four-item list showed: [Whale, Dolphin, Porpoise, Seal]. Which mammal was present in the list?',
      ['Walrus', 'Sea Otter', 'Dolphin', 'Manatee'], 'Dolphin', 'EASY', 'Memory & Recall', 'Set Membership', 'Item Recognition',
      'Dolphin was part of [Whale, Dolphin, Porpoise, Seal].')
add_q('The memorized list contained: [Red, Blue, Yellow, Green]. Which secondary color was NOT in the list?',
      ['Orange', 'Yellow', 'Blue', 'Red'], 'Orange', 'EASY', 'Memory & Recall', 'Exclusion Recognition', 'Item Recognition',
      'Orange was not in the original list [Red, Blue, Yellow, Green].')
add_q('A displayed set showed: [Andes, Alps, Rockies, Urals]. Which mountain chain was in the set?',
      ['Caucasus', 'Himalayas', 'Alps', 'Pyrenees'], 'Alps', 'EASY', 'Memory & Recall', 'Set Membership', 'Item Recognition',
      'Alps was in the set [Andes, Alps, Rockies, Urals].')
add_q('The group contained: [Guitar, Bass, Drums, Keyboard]. Which musical instrument was in the group?',
      ['Saxophone', 'Trumpet', 'Keyboard', 'Violin'], 'Keyboard', 'EASY', 'Memory & Recall', 'Set Membership', 'Item Recognition',
      'Keyboard was in the group [Guitar, Bass, Drums, Keyboard].')
add_q('A list displayed: [11, 13, 17, 19]. Which prime number was in the list?',
      ['23', '29', '17', '31'], '17', 'EASY', 'Memory & Recall', 'Set Membership', 'Item Recognition',
      '17 was in the list [11, 13, 17, 19].')
add_q('The memorized items were: [Chrome, Firefox, Safari, Edge]. Which browser was in the group?',
      ['Opera', 'Brave', 'Safari', 'Tor'], 'Safari', 'EASY', 'Memory & Recall', 'Set Membership', 'Item Recognition',
      'Safari was in the group [Chrome, Firefox, Safari, Edge].')

# --- PART 5: Reverse Sequence Retrieval (35) ---
add_q('Memorize the 4-color pattern: [Amber, Cyan, Magenta, Violet]. What is the exact reverse order?',
      ['Violet, Magenta, Cyan, Amber', 'Magenta, Violet, Amber, Cyan', 'Cyan, Amber, Violet, Magenta', 'Amber, Cyan, Magenta, Violet'], 'Violet, Magenta, Cyan, Amber', 'MEDIUM', 'Memory & Recall', 'Reverse Recall', 'Reverse Order',
      'Reversing [Amber, Cyan, Magenta, Violet] yields [Violet, Magenta, Cyan, Amber].')
add_q('Remember the 4-letter sequence: [W, X, Y, Z]. What is the exact reverse sequence?',
      ['Z, Y, X, W', 'Y, Z, W, X', 'X, W, Z, Y', 'W, X, Y, Z'], 'Z, Y, X, W', 'EASY', 'Memory & Recall', 'Reverse Recall', 'Reverse Order',
      'Reversing [W, X, Y, Z] gives [Z, Y, X, W].')
add_q('Memorize the word list: [North, East, South, West]. What is the exact reverse order?',
      ['West, South, East, North', 'South, West, North, East', 'East, North, West, South', 'North, East, South, West'], 'West, South, East, North', 'EASY', 'Memory & Recall', 'Reverse Recall', 'Reverse Order',
      'Reversing [North, East, South, West] gives [West, South, East, North].')
add_q('Remember the 4 numbers: [1, 2, 3, 4]. What is the reverse sequence?',
      ['4, 3, 2, 1', '3, 4, 1, 2', '2, 1, 4, 3', '1, 2, 3, 4'], '4, 3, 2, 1', 'EASY', 'Memory & Recall', 'Reverse Recall', 'Reverse Order',
      'Reversing [1, 2, 3, 4] gives [4, 3, 2, 1].')
add_q('Memorize this sequence: [Gold, Silver, Bronze, Iron]. What is the reverse order?',
      ['Iron, Bronze, Silver, Gold', 'Bronze, Iron, Gold, Silver', 'Silver, Gold, Iron, Bronze', 'Gold, Silver, Bronze, Iron'], 'Iron, Bronze, Silver, Gold', 'EASY', 'Memory & Recall', 'Reverse Recall', 'Reverse Order',
      'Reversing [Gold, Silver, Bronze, Iron] yields [Iron, Bronze, Silver, Gold].')
add_q('Remember the 4 seasons: [Spring, Summer, Autumn, Winter]. What is the exact reverse order?',
      ['Winter, Autumn, Summer, Spring', 'Autumn, Winter, Spring, Summer', 'Summer, Spring, Winter, Autumn', 'Spring, Summer, Autumn, Winter'], 'Winter, Autumn, Summer, Spring', 'EASY', 'Memory & Recall', 'Reverse Recall', 'Reverse Order',
      'Reversing [Spring, Summer, Autumn, Winter] yields [Winter, Autumn, Summer, Spring].')
add_q('Memorize the list: [Sun, Earth, Moon, Mars]. What is the reverse sequence?',
      ['Mars, Moon, Earth, Sun', 'Moon, Mars, Sun, Earth', 'Earth, Sun, Mars, Moon', 'Sun, Earth, Moon, Mars'], 'Mars, Moon, Earth, Sun', 'EASY', 'Memory & Recall', 'Reverse Recall', 'Reverse Order',
      'Reversing [Sun, Earth, Moon, Mars] yields [Mars, Moon, Earth, Sun].')
add_q('Remember the order: [Alpha, Beta, Gamma, Delta]. What is the reverse order?',
      ['Delta, Gamma, Beta, Alpha', 'Gamma, Delta, Alpha, Beta', 'Beta, Alpha, Delta, Gamma', 'Alpha, Beta, Gamma, Delta'], 'Delta, Gamma, Beta, Alpha', 'EASY', 'Memory & Recall', 'Reverse Recall', 'Reverse Order',
      'Reversing [Alpha, Beta, Gamma, Delta] yields [Delta, Gamma, Beta, Alpha].')
add_q('Memorize the 4 animals: [Cat, Dog, Fox, Wolf]. What is the reverse order?',
      ['Wolf, Fox, Dog, Cat', 'Fox, Wolf, Cat, Dog', 'Dog, Cat, Wolf, Fox', 'Cat, Dog, Fox, Wolf'], 'Wolf, Fox, Dog, Cat', 'EASY', 'Memory & Recall', 'Reverse Recall', 'Reverse Order',
      'Reversing [Cat, Dog, Fox, Wolf] yields [Wolf, Fox, Dog, Cat].')
add_q('Remember the list: [Red, Green, Blue, White]. What is the exact reverse order?',
      ['White, Blue, Green, Red', 'Blue, White, Red, Green', 'Green, Red, White, Blue', 'Red, Green, Blue, White'], 'White, Blue, Green, Red', 'EASY', 'Memory & Recall', 'Reverse Recall', 'Reverse Order',
      'Reversing [Red, Green, Blue, White] yields [White, Blue, Green, Red].')
add_q('Memorize the digits: [9, 6, 3, 0]. What is the exact reverse order?',
      ['0, 3, 6, 9', '3, 0, 9, 6', '6, 9, 0, 3', '9, 6, 3, 0'], '0, 3, 6, 9', 'EASY', 'Memory & Recall', 'Reverse Recall', 'Reverse Order',
      'Reversing [9, 6, 3, 0] gives [0, 3, 6, 9].')
add_q('Remember the order: [Rome, Paris, Berlin, Madrid]. What is the reverse order?',
      ['Madrid, Berlin, Paris, Rome', 'Berlin, Madrid, Rome, Paris', 'Paris, Rome, Madrid, Berlin', 'Rome, Paris, Berlin, Madrid'], 'Madrid, Berlin, Paris, Rome', 'EASY', 'Memory & Recall', 'Reverse Recall', 'Reverse Order',
      'Reversing [Rome, Paris, Berlin, Madrid] yields [Madrid, Berlin, Paris, Rome].')
add_q('Memorize the 4 trees: [Cedar, Birch, Pine, Oak]. What is the reverse order?',
      ['Oak, Pine, Birch, Cedar', 'Pine, Oak, Cedar, Birch', 'Birch, Cedar, Oak, Pine', 'Cedar, Birch, Pine, Oak'], 'Oak, Pine, Birch, Cedar', 'EASY', 'Memory & Recall', 'Reverse Recall', 'Reverse Order',
      'Reversing [Cedar, Birch, Pine, Oak] gives [Oak, Pine, Birch, Cedar].')
add_q('Remember the sequence: [Solid, Liquid, Gas, Plasma]. What is the reverse order?',
      ['Plasma, Gas, Liquid, Solid', 'Gas, Plasma, Solid, Liquid', 'Liquid, Solid, Plasma, Gas', 'Solid, Liquid, Gas, Plasma'], 'Plasma, Gas, Liquid, Solid', 'EASY', 'Memory & Recall', 'Reverse Recall', 'Reverse Order',
      'Reversing [Solid, Liquid, Gas, Plasma] gives [Plasma, Gas, Liquid, Solid].')
add_q('Memorize the list: [Pen, Pencil, Brush, Chalk]. What is the reverse order?',
      ['Chalk, Brush, Pencil, Pen', 'Brush, Chalk, Pen, Pencil', 'Pencil, Pen, Chalk, Brush', 'Pen, Pencil, Brush, Chalk'], 'Chalk, Brush, Pencil, Pen', 'EASY', 'Memory & Recall', 'Reverse Recall', 'Reverse Order',
      'Reversing [Pen, Pencil, Brush, Chalk] gives [Chalk, Brush, Pencil, Pen].')
add_q('Remember the list: [Hour, Minute, Second, Millisecond]. What is the reverse sequence?',
      ['Millisecond, Second, Minute, Hour', 'Second, Millisecond, Hour, Minute', 'Minute, Hour, Millisecond, Second', 'Hour, Minute, Second, Millisecond'], 'Millisecond, Second, Minute, Hour', 'EASY', 'Memory & Recall', 'Reverse Recall', 'Reverse Order',
      'Reversing [Hour, Minute, Second, Millisecond] gives [Millisecond, Second, Minute, Hour].')
add_q('Memorize the items: [Cup, Plate, Bowl, Fork]. What is the exact reverse order?',
      ['Fork, Bowl, Plate, Cup', 'Bowl, Fork, Cup, Plate', 'Plate, Cup, Fork, Bowl', 'Cup, Plate, Bowl, Fork'], 'Fork, Bowl, Plate, Cup', 'EASY', 'Memory & Recall', 'Reverse Recall', 'Reverse Order',
      'Reversing [Cup, Plate, Bowl, Fork] gives [Fork, Bowl, Plate, Cup].')

# --- PART 6: Paired Associations & Attribute Retention (40) ---
add_q('Memory test: [Alpha = 12, Beta = 34, Gamma = 56, Delta = 78]. Which number was paired with Gamma?',
      ['12', '34', '56', '78'], '56', 'MEDIUM', 'Memory & Recall', 'Paired Associations', 'Attribute Recall',
      'In the pairings, Gamma was paired with 56.')
add_q('Study the pairings: [Red = Circle, Blue = Square, Green = Triangle, Yellow = Star]. What shape was paired with Green?',
      ['Circle', 'Square', 'Triangle', 'Star'], 'Triangle', 'MEDIUM', 'Memory & Recall', 'Paired Associations', 'Attribute Recall',
      'Green was paired with Triangle.')
add_q('Memorize the codes: [Server = 8080, Database = 5432, Cache = 6379, Web = 443]. Which port was paired with Database?',
      ['8080', '5432', '6379', '443'], '5432', 'MEDIUM', 'Memory & Recall', 'Paired Associations', 'Attribute Recall',
      'Database was paired with port 5432.')
add_q('Study the pairings: [Cat = Whiskers, Dog = Bark, Bird = Feather, Fish = Scales]. What attribute was paired with Bird?',
      ['Whiskers', 'Bark', 'Feather', 'Scales'], 'Feather', 'EASY', 'Memory & Recall', 'Paired Associations', 'Attribute Recall',
      'Bird was paired with Feather.')
add_q('Memorize the associations: [Paris = France, Berlin = Germany, Rome = Italy, Madrid = Spain]. Which capital was paired with Italy?',
      ['Paris', 'Berlin', 'Rome', 'Madrid'], 'Rome', 'EASY', 'Memory & Recall', 'Paired Associations', 'Attribute Recall',
      'Rome was paired with Italy.')
add_q('Study the pairings: [Gold = Au, Silver = Ag, Iron = Fe, Copper = Cu]. What symbol was paired with Iron?',
      ['Au', 'Ag', 'Fe', 'Cu'], 'Fe', 'EASY', 'Memory & Recall', 'Paired Associations', 'Attribute Recall',
      'Iron was paired with Fe.')
add_q('Memorize the values: [X = 15, Y = 25, Z = 35, W = 45]. What value was paired with Z?',
      ['15', '25', '35', '45'], '35', 'EASY', 'Memory & Recall', 'Paired Associations', 'Attribute Recall',
      'Z was paired with 35.')
add_q('Study the associations: [Jupiter = Europa, Saturn = Titan, Uranus = Titania, Neptune = Triton]. Which moon was paired with Saturn?',
      ['Europa', 'Titan', 'Titania', 'Triton'], 'Titan', 'MEDIUM', 'Memory & Recall', 'Paired Associations', 'Attribute Recall',
      'Saturn was paired with Titan.')
add_q('Memorize the colors: [Apple = Red, Banana = Yellow, Lime = Green, Blueberry = Blue]. What color was paired with Lime?',
      ['Red', 'Yellow', 'Green', 'Blue'], 'Green', 'EASY', 'Memory & Recall', 'Paired Associations', 'Attribute Recall',
      'Lime was paired with Green.')
add_q('Study the associations: [Hydrogen = 1, Helium = 2, Lithium = 3, Carbon = 6]. What atomic number was paired with Lithium?',
      ['1', '2', '3', '6'], '3', 'EASY', 'Memory & Recall', 'Paired Associations', 'Attribute Recall',
      'Lithium was paired with atomic number 3.')
add_q('Memorize the pairings: [India = Rupee, USA = Dollar, UK = Pound, Japan = Yen]. Which currency was paired with Japan?',
      ['Rupee', 'Dollar', 'Pound', 'Yen'], 'Yen', 'EASY', 'Memory & Recall', 'Paired Associations', 'Attribute Recall',
      'Japan was paired with Yen.')
add_q('Study the list: [Car = Road, Plane = Sky, Boat = Water, Train = Tracks]. What path was paired with Train?',
      ['Road', 'Sky', 'Water', 'Tracks'], 'Tracks', 'EASY', 'Memory & Recall', 'Paired Associations', 'Attribute Recall',
      'Train was paired with Tracks.')
add_q('Memorize the pairings: [Doctor = Stethoscope, Chef = Knife, Painter = Brush, Carpenter = Hammer]. What tool was paired with Chef?',
      ['Stethoscope', 'Knife', 'Brush', 'Hammer'], 'Knife', 'EASY', 'Memory & Recall', 'Paired Associations', 'Attribute Recall',
      'Chef was paired with Knife.')
add_q('Study the pairings: [A = 100, B = 200, C = 300, D = 400]. What number was paired with B?',
      ['100', '200', '300', '400'], '200', 'EASY', 'Memory & Recall', 'Paired Associations', 'Attribute Recall',
      'B was paired with 200.')
add_q('Memorize the pairings: [Lion = Roar, Cow = Moo, Sheep = Baa, Horse = Neigh]. Which sound was paired with Cow?',
      ['Roar', 'Moo', 'Baa', 'Neigh'], 'Moo', 'EASY', 'Memory & Recall', 'Paired Associations', 'Attribute Recall',
      'Cow was paired with Moo.')
add_q('Study the pairings: [Mars = Red, Earth = Blue, Sun = Yellow, Moon = Grey]. What color was paired with Earth?',
      ['Red', 'Blue', 'Yellow', 'Grey'], 'Blue', 'EASY', 'Memory & Recall', 'Paired Associations', 'Attribute Recall',
      'Earth was paired with Blue.')
add_q('Memorize the pairings: [Winter = Cold, Summer = Hot, Spring = Warm, Autumn = Cool]. Which temperature was paired with Autumn?',
      ['Cold', 'Hot', 'Warm', 'Cool'], 'Cool', 'EASY', 'Memory & Recall', 'Paired Associations', 'Attribute Recall',
      'Autumn was paired with Cool.')
add_q('Study the pairings: [Water = H2O, Salt = NaCl, Carbon Dioxide = CO2, Methane = CH4]. What formula was paired with Salt?',
      ['H2O', 'NaCl', 'CO2', 'CH4'], 'NaCl', 'EASY', 'Memory & Recall', 'Paired Associations', 'Attribute Recall',
      'Salt was paired with NaCl.')
add_q('Memorize the pairings: [Eagle = Sky, Shark = Ocean, Mole = Ground, Monkey = Tree]. Which habitat was paired with Shark?',
      ['Sky', 'Ocean', 'Ground', 'Tree'], 'Ocean', 'EASY', 'Memory & Recall', 'Paired Associations', 'Attribute Recall',
      'Shark was paired with Ocean.')
add_q('Study the pairings: [1st = Gold, 2nd = Silver, 3rd = Bronze, 4th = Ribbon]. What was paired with 2nd place?',
      ['Gold', 'Silver', 'Bronze', 'Ribbon'], 'Silver', 'EASY', 'Memory & Recall', 'Paired Associations', 'Attribute Recall',
      '2nd place was paired with Silver.')



# --- PART 7: Route, Movement & Path Sequence Recall (25) ---
add_q('A drone followed the flight path: [North, East, East, South, West]. What was the 4th navigational movement?',
      ['North', 'East', 'South', 'West'], 'South', 'EASY', 'Memory & Recall', 'Navigation Recall', 'Movement Sequence',
      'The sequence of movements was 1: North, 2: East, 3: East, 4: South, 5: West. The 4th movement was South.')
add_q('A robot navigates a grid with steps: [Forward, Turn Right, Forward, Forward, Turn Left]. What was the 2nd command?',
      ['Forward', 'Turn Right', 'Turn Left', 'Reverse'], 'Turn Right', 'EASY', 'Memory & Recall', 'Navigation Recall', 'Movement Sequence',
      'The 2nd command in the sequence was Turn Right.')
add_q('Study the delivery path: [Warehouse, Hub A, Depot B, Station C, Customer]. Which stop was 3rd?',
      ['Warehouse', 'Hub A', 'Depot B', 'Station C'], 'Depot B', 'EASY', 'Memory & Recall', 'Navigation Recall', 'Movement Sequence',
      'The 3rd stop was Depot B.')
add_q('Memorize the directions: [Up, Up, Down, Left, Right]. What was the 4th command?',
      ['Up', 'Down', 'Left', 'Right'], 'Left', 'EASY', 'Memory & Recall', 'Navigation Recall', 'Movement Sequence',
      'The 4th command was Left.')
add_q('Study the metro stops: [Station 1, Station 2, Station 3, Station 4, Station 5]. Which station was immediately before Station 4?',
      ['Station 1', 'Station 2', 'Station 3', 'Station 5'], 'Station 3', 'EASY', 'Memory & Recall', 'Navigation Recall', 'Movement Sequence',
      'Station 3 immediately preceded Station 4.')
add_q('A ship steered through coordinates: [Alpha, Echo, Delta, Zulu]. Which coordinate was in the 2nd position?',
      ['Alpha', 'Echo', 'Delta', 'Zulu'], 'Echo', 'EASY', 'Memory & Recall', 'Navigation Recall', 'Movement Sequence',
      'The 2nd coordinate was Echo.')
add_q('Memorize the path: [Left, Right, Straight, Right, Left]. Which action immediately followed the first Right?',
      ['Left', 'Right', 'Straight', 'Stop'], 'Straight', 'MEDIUM', 'Memory & Recall', 'Navigation Recall', 'Movement Sequence',
      'Straight immediately followed the first Right.')
add_q('Study the vehicle transit: [Garage, Highway, Bridge, Tunnel, Airport]. Which location was 4th?',
      ['Highway', 'Bridge', 'Tunnel', 'Airport'], 'Tunnel', 'EASY', 'Memory & Recall', 'Navigation Recall', 'Movement Sequence',
      'Tunnel was the 4th location.')
add_q('Memorize the climb: [Base Camp, Camp 1, Camp 2, Camp 3, Summit]. Which location was 3rd?',
      ['Camp 1', 'Camp 2', 'Camp 3', 'Summit'], 'Camp 2', 'EASY', 'Memory & Recall', 'Navigation Recall', 'Movement Sequence',
      'Camp 2 was the 3rd location.')
add_q('A hiker took bearings: [30°, 90°, 180°, 270°]. Which bearing was in the 3rd position?',
      ['30°', '90°', '180°', '270°'], '180°', 'EASY', 'Memory & Recall', 'Navigation Recall', 'Movement Sequence',
      'The 3rd bearing was 180°.')
add_q('Memorize the turns: [East, South, East, North]. What was the last turn?',
      ['East', 'South', 'North', 'West'], 'North', 'EASY', 'Memory & Recall', 'Navigation Recall', 'Movement Sequence',
      'The last turn was North.')
add_q('Study the track laps: [Lap 1: Orange, Lap 2: Purple, Lap 3: Teal, Lap 4: Amber]. What color was Lap 3?',
      ['Orange', 'Purple', 'Teal', 'Amber'], 'Teal', 'EASY', 'Memory & Recall', 'Navigation Recall', 'Movement Sequence',
      'Lap 3 was Teal.')
add_q('Memorize the movement: [Hop, Skip, Jump, Step]. What was the 2nd movement?',
      ['Hop', 'Skip', 'Jump', 'Step'], 'Skip', 'EASY', 'Memory & Recall', 'Navigation Recall', 'Movement Sequence',
      'The 2nd movement was Skip.')
add_q('Study the trail: [Canyon, Ridge, Valley, Peak]. Which landmark was 1st?',
      ['Canyon', 'Ridge', 'Valley', 'Peak'], 'Canyon', 'EASY', 'Memory & Recall', 'Navigation Recall', 'Movement Sequence',
      'The 1st landmark was Canyon.')
add_q('A rover moved: [Forward 5m, Turn 90°, Forward 10m, Reverse 2m]. What was the 3rd action?',
      ['Forward 5m', 'Turn 90°', 'Forward 10m', 'Reverse 2m'], 'Forward 10m', 'MEDIUM', 'Memory & Recall', 'Navigation Recall', 'Movement Sequence',
      'The 3rd action was Forward 10m.')
add_q('Memorize the route: [Paris, Lyon, Marseille, Nice]. Which city was 2nd?',
      ['Paris', 'Lyon', 'Marseille', 'Nice'], 'Lyon', 'EASY', 'Memory & Recall', 'Navigation Recall', 'Movement Sequence',
      'Lyon was the 2nd city.')
add_q('Study the itinerary: [London, Brussels, Amsterdam, Berlin]. Which city was 3rd?',
      ['London', 'Brussels', 'Amsterdam', 'Berlin'], 'Amsterdam', 'EASY', 'Memory & Recall', 'Navigation Recall', 'Movement Sequence',
      'Amsterdam was the 3rd city.')
add_q('A package moved: [Sender, Sorting Center, Regional Hub, Delivery Van, Doorstep]. Which stage was 4th?',
      ['Sorting Center', 'Regional Hub', 'Delivery Van', 'Doorstep'], 'Delivery Van', 'EASY', 'Memory & Recall', 'Navigation Recall', 'Movement Sequence',
      'Delivery Van was the 4th stage.')
add_q('Memorize the flight stops: [Dubai, Singapore, Sydney, Auckland]. Which stop was immediately before Sydney?',
      ['Dubai', 'Singapore', 'Auckland', 'Perth'], 'Singapore', 'EASY', 'Memory & Recall', 'Navigation Recall', 'Movement Sequence',
      'Singapore was immediately before Sydney.')
add_q('Study the track: [Start, Checkpoint 1, Checkpoint 2, Checkpoint 3, Finish]. Which checkpoint was 2nd in order?',
      ['Start', 'Checkpoint 1', 'Checkpoint 2', 'Checkpoint 3'], 'Checkpoint 2', 'EASY', 'Memory & Recall', 'Navigation Recall', 'Movement Sequence',
      'Checkpoint 2 was the 2nd checkpoint in order.')
add_q('Memorize the compass steps: [NW, NE, SE, SW]. What was the 3rd bearing?',
      ['NW', 'NE', 'SE', 'SW'], 'SE', 'EASY', 'Memory & Recall', 'Navigation Recall', 'Movement Sequence',
      'SE was the 3rd bearing.')
add_q('Study the orbit phases: [Launch, Staging, Burn, Orbit Insertion]. Which phase was 2nd?',
      ['Launch', 'Staging', 'Burn', 'Orbit Insertion'], 'Staging', 'MEDIUM', 'Memory & Recall', 'Navigation Recall', 'Movement Sequence',
      'Staging was the 2nd phase.')
add_q('Memorize the relay: [Runner A, Runner B, Runner C, Runner D]. Who ran the 4th leg?',
      ['Runner A', 'Runner B', 'Runner C', 'Runner D'], 'Runner D', 'EASY', 'Memory & Recall', 'Navigation Recall', 'Movement Sequence',
      'Runner D ran the 4th leg.')
add_q('Study the corridor: [Room 101, Room 102, Room 103, Room 104]. Which room was 1st?',
      ['Room 101', 'Room 102', 'Room 103', 'Room 104'], 'Room 101', 'EASY', 'Memory & Recall', 'Navigation Recall', 'Movement Sequence',
      'Room 101 was 1st.')
add_q('Memorize the maze turns: [Left, Left, Right, Straight]. What was the 3rd turn?',
      ['Left', 'Right', 'Straight', 'Reverse'], 'Right', 'EASY', 'Memory & Recall', 'Navigation Recall', 'Movement Sequence',
      'The 3rd turn was Right.')

# --- PART 8: PIN, Code & Numerical Digit Memory (25) ---
add_q('Memorize the 5-digit PIN: [8, 2, 9, 4, 1]. Which digit occupied the 3rd position?',
      ['8', '2', '9', '4'], '9', 'EASY', 'Memory & Recall', 'Digit Recall', 'PIN Sequence',
      'In [8, 2, 9, 4, 1], the 3rd digit is 9.')
add_q('Study the 5-digit security code: [3, 7, 1, 8, 5]. Which digit was 1st?',
      ['3', '7', '1', '8'], '3', 'EASY', 'Memory & Recall', 'Digit Recall', 'PIN Sequence',
      'The 1st digit was 3.')
add_q('Memorize the sequence: [6, 0, 4, 2, 8]. Which digit occupied the 4th position?',
      ['6', '0', '4', '2'], '2', 'EASY', 'Memory & Recall', 'Digit Recall', 'PIN Sequence',
      'The 4th digit was 2.')
add_q('Remember this sequence: [1, 9, 7, 5, 3]. Which digit was in the 2nd position?',
      ['1', '9', '7', '5'], '9', 'EASY', 'Memory & Recall', 'Digit Recall', 'PIN Sequence',
      'The 2nd digit was 9.')
add_q('Study the code: [4, 4, 8, 2, 6]. Which digit was 5th?',
      ['4', '8', '2', '6'], '6', 'EASY', 'Memory & Recall', 'Digit Recall', 'PIN Sequence',
      'The 5th digit was 6.')
add_q('Memorize the numbers: [9, 1, 8, 2, 7]. What was the 3rd number?',
      ['9', '1', '8', '2'], '8', 'EASY', 'Memory & Recall', 'Digit Recall', 'PIN Sequence',
      'The 3rd number was 8.')
add_q('Study the sequence: [5, 2, 0, 9, 4]. Which digit immediately followed 0?',
      ['5', '2', '9', '4'], '9', 'EASY', 'Memory & Recall', 'Digit Recall', 'PIN Sequence',
      '9 immediately followed 0.')
add_q('Memorize the code: [7, 3, 6, 1, 0]. Which digit immediately preceded 6?',
      ['7', '3', '1', '0'], '3', 'EASY', 'Memory & Recall', 'Digit Recall', 'PIN Sequence',
      '3 immediately preceded 6.')
add_q('Remember the values: [15, 30, 45, 60, 75]. Which value was 4th?',
      ['30', '45', '60', '75'], '60', 'EASY', 'Memory & Recall', 'Digit Recall', 'PIN Sequence',
      'The 4th value was 60.')
add_q('Study the digits: [2, 8, 4, 6, 0]. What was the reverse order?',
      ['0, 6, 4, 8, 2', '0, 4, 6, 8, 2', '2, 4, 6, 8, 0', '6, 0, 4, 8, 2'], '0, 6, 4, 8, 2', 'MEDIUM', 'Memory & Recall', 'Digit Recall', 'Reverse PIN',
      'The reverse order is 0, 6, 4, 8, 2.')
add_q('Memorize the sequence: [9, 8, 7, 6, 5]. What digit was 2nd?',
      ['9', '8', '7', '6'], '8', 'EASY', 'Memory & Recall', 'Digit Recall', 'PIN Sequence',
      'The 2nd digit was 8.')
add_q('Study the numbers: [11, 22, 33, 44, 55]. Which number was 3rd?',
      ['11', '22', '33', '44'], '33', 'EASY', 'Memory & Recall', 'Digit Recall', 'PIN Sequence',
      'The 3rd number was 33.')
add_q('Memorize the digits: [3, 1, 4, 1, 5]. What was the 4th digit?',
      ['3', '1', '4', '5'], '1', 'MEDIUM', 'Memory & Recall', 'Digit Recall', 'PIN Sequence',
      'The 4th digit was 1.')
add_q('Remember this code: [2, 7, 1, 8, 2]. What was the 3rd digit?',
      ['2', '7', '1', '8'], '1', 'EASY', 'Memory & Recall', 'Digit Recall', 'PIN Sequence',
      'The 3rd digit was 1.')
add_q('Study the digits: [1, 6, 1, 8, 0]. What was the 5th digit?',
      ['1', '6', '8', '0'], '0', 'EASY', 'Memory & Recall', 'Digit Recall', 'PIN Sequence',
      'The 5th digit was 0.')
add_q('Memorize the code: [4, 0, 4, 2, 0]. What was the 2nd digit?',
      ['4', '0', '2', '5'], '0', 'EASY', 'Memory & Recall', 'Digit Recall', 'PIN Sequence',
      'The 2nd digit was 0.')
add_q('Study the numbers: [100, 200, 300, 400]. Which number was 1st?',
      ['100', '200', '300', '400'], '100', 'EASY', 'Memory & Recall', 'Digit Recall', 'PIN Sequence',
      'The 1st number was 100.')
add_q('Memorize this sequence: [5, 5, 5, 1]. Which digit was in the 4th position?',
      ['5', '1', '0', '2'], '1', 'EASY', 'Memory & Recall', 'Digit Recall', 'PIN Sequence',
      'The 4th digit was 1.')
add_q('Study the code: [8, 3, 5, 9, 2]. Which digit immediately preceded 2?',
      ['8', '3', '5', '9'], '9', 'EASY', 'Memory & Recall', 'Digit Recall', 'PIN Sequence',
      '9 immediately preceded 2.')
add_q('Memorize the values: [12, 24, 36, 48]. What was the 2nd value?',
      ['12', '24', '36', '48'], '24', 'EASY', 'Memory & Recall', 'Digit Recall', 'PIN Sequence',
      'The 2nd value was 24.')
add_q('Study the digits: [7, 0, 7, 0, 7]. What was the 4th digit?',
      ['7', '0', '1', '5'], '0', 'EASY', 'Memory & Recall', 'Digit Recall', 'PIN Sequence',
      'The 4th digit was 0.')
add_q('Memorize the sequence: [6, 1, 9, 3, 5]. What was the 1st digit?',
      ['6', '1', '9', '3'], '6', 'EASY', 'Memory & Recall', 'Digit Recall', 'PIN Sequence',
      'The 1st digit was 6.')
add_q('Study the numbers: [25, 50, 75, 100]. Which number was 3rd?',
      ['25', '50', '75', '100'], '75', 'EASY', 'Memory & Recall', 'Digit Recall', 'PIN Sequence',
      'The 3rd number was 75.')
add_q('Memorize the digits: [1, 3, 5, 7, 9]. What digit immediately followed 5?',
      ['1', '3', '7', '9'], '7', 'EASY', 'Memory & Recall', 'Digit Recall', 'PIN Sequence',
      '7 immediately followed 5.')
add_q('Study the code: [9, 4, 2, 7, 1]. Which digit was 5th?',
      ['9', '4', '2', '1'], '1', 'EASY', 'Memory & Recall', 'Digit Recall', 'PIN Sequence',
      'The 5th digit was 1.')

# --- PART 9: Timeline, Historic Milestones & Vocabulary Lists (35) ---
add_q('Historic timeline displayed: [1776, 1789, 1804, 1815]. Which year was in the 2nd position?',
      ['1776', '1789', '1804', '1815'], '1789', 'MEDIUM', 'Memory & Recall', 'Timeline Recall', 'Milestone Order',
      'The 2nd year displayed was 1789.')
add_q('Study the chronology: [1914, 1918, 1939, 1945]. Which year occupied the 3rd position?',
      ['1914', '1918', '1939', '1945'], '1939', 'EASY', 'Memory & Recall', 'Timeline Recall', 'Milestone Order',
      'The 3rd year was 1939.')
add_q('Memorize the sequence of scientific eras: [Classical, Renaissance, Enlightenment, Modern]. Which era was 3rd?',
      ['Classical', 'Renaissance', 'Enlightenment', 'Modern'], 'Enlightenment', 'MEDIUM', 'Memory & Recall', 'Timeline Recall', 'Milestone Order',
      'The 3rd era was Enlightenment.')
add_q('Study the list of space missions: [Sputnik 1, Vostok 1, Apollo 11, Voyager 1]. Which mission was 2nd?',
      ['Sputnik 1', 'Vostok 1', 'Apollo 11', 'Voyager 1'], 'Vostok 1', 'MEDIUM', 'Memory & Recall', 'Timeline Recall', 'Milestone Order',
      'Vostok 1 was in the 2nd position.')
add_q('Memorize the vocabulary list: [Benevolent, Courageous, Diligent, Eloquent, Fearless]. Which word was 4th?',
      ['Benevolent', 'Courageous', 'Diligent', 'Eloquent'], 'Eloquent', 'MEDIUM', 'Memory & Recall', 'Word Recall', 'Vocabulary List',
      'Eloquent was the 4th word in the list.')
add_q('Study the word sequence: [Zenith, Apex, Pinnacle, Summit]. Which synonym was in the 1st position?',
      ['Zenith', 'Apex', 'Pinnacle', 'Summit'], 'Zenith', 'EASY', 'Memory & Recall', 'Word Recall', 'Vocabulary List',
      'Zenith was the 1st word.')
add_q('Memorize the adjectives: [Swift, Agile, Nimble, Quick]. Which word was in the 3rd position?',
      ['Swift', 'Agile', 'Nimble', 'Quick'], 'Nimble', 'EASY', 'Memory & Recall', 'Word Recall', 'Vocabulary List',
      'Nimble was the 3rd adjective.')
add_q('Remember the sequence of elements: [Iron, Bronze, Steel, Titanium]. Which material was 2nd?',
      ['Iron', 'Bronze', 'Steel', 'Titanium'], 'Bronze', 'EASY', 'Memory & Recall', 'Word Recall', 'Material List',
      'Bronze was in the 2nd position.')
add_q('Study this list: [Neutron, Proton, Electron, Quark]. Which particle was 4th?',
      ['Neutron', 'Proton', 'Electron', 'Quark'], 'Quark', 'EASY', 'Memory & Recall', 'Word Recall', 'Particle List',
      'Quark was in the 4th position.')
add_q('Memorize the color palette: [Teal, Indigo, Maroon, Ochre]. Which pigment was in the 3rd position?',
      ['Teal', 'Indigo', 'Maroon', 'Ochre'], 'Maroon', 'EASY', 'Memory & Recall', 'Color Recall', 'Color Palette',
      'Maroon was the 3rd pigment.')
add_q('Study the tech sequence: [Vacuum Tube, Transistor, Integrated Circuit, Microprocessor]. Which generation was 2nd?',
      ['Vacuum Tube', 'Transistor', 'Integrated Circuit', 'Microprocessor'], 'Transistor', 'MEDIUM', 'Memory & Recall', 'Timeline Recall', 'Tech Generations',
      'Transistor was in the 2nd position.')
add_q('Memorize the architectural terms: [Column, Arch, Dome, Spire]. Which feature was 3rd?',
      ['Column', 'Arch', 'Dome', 'Spire'], 'Dome', 'EASY', 'Memory & Recall', 'Word Recall', 'Architectural Terms',
      'Dome was in the 3rd position.')
add_q('Study the sequence: [Seed, Sprout, Sapling, Tree]. Which growth phase was 2nd?',
      ['Seed', 'Sprout', 'Sapling', 'Tree'], 'Sprout', 'EASY', 'Memory & Recall', 'Word Recall', 'Botany Lifecycle',
      'Sprout was the 2nd growth phase.')
add_q('Memorize the list: [Kilogram, Gram, Milligram, Microgram]. Which unit was in the 3rd position?',
      ['Kilogram', 'Gram', 'Milligram', 'Microgram'], 'Milligram', 'EASY', 'Memory & Recall', 'Measurement Recall', 'Mass Units',
      'Milligram was the 3rd unit.')
add_q('Study the four oceans: [Pacific, Atlantic, Indian, Arctic]. Which ocean was 2nd in the displayed list?',
      ['Pacific', 'Atlantic', 'Indian', 'Arctic'], 'Atlantic', 'EASY', 'Memory & Recall', 'Geography Recall', 'Ocean List',
      'Atlantic was the 2nd ocean in the list.')
add_q('Memorize this sequence: [Byte, Kilobyte, Megabyte, Gigabyte]. Which storage unit was 1st?',
      ['Byte', 'Kilobyte', 'Megabyte', 'Gigabyte'], 'Byte', 'EASY', 'Memory & Recall', 'Computers Recall', 'Storage Units',
      'Byte was the 1st storage unit.')
add_q('Study the terms: [Hypothesis, Experiment, Observation, Conclusion]. Which scientific stage was 3rd?',
      ['Hypothesis', 'Experiment', 'Observation', 'Conclusion'], 'Observation', 'EASY', 'Memory & Recall', 'Scientific Method', 'Process Steps',
      'Observation was the 3rd stage in the list.')
add_q('Memorize the list of gems: [Emerald, Diamond, Pearl, Jade]. Which item was in the 4th position?',
      ['Emerald', 'Diamond', 'Pearl', 'Jade'], 'Jade', 'EASY', 'Memory & Recall', 'Gem Recall', 'Gemstones',
      'Jade was the 4th item.')
add_q('Study the sports: [Cricket, Football, Tennis, Badminton]. Which sport was 1st in the list?',
      ['Cricket', 'Football', 'Tennis', 'Badminton'], 'Cricket', 'EASY', 'Memory & Recall', 'Sports Recall', 'Sports List',
      'Cricket was the 1st sport.')
add_q('Memorize the sequence: [Solid, Liquid, Gas, Supercritical Fluid]. Which state was 4th?',
      ['Solid', 'Liquid', 'Gas', 'Supercritical Fluid'], 'Supercritical Fluid', 'MEDIUM', 'Memory & Recall', 'Science Recall', 'States of Matter',
      'Supercritical Fluid was the 4th state in the list.')
add_q('Study the four directions: [North, West, South, East]. Which direction was in the 2nd position?',
      ['North', 'West', 'South', 'East'], 'West', 'EASY', 'Memory & Recall', 'Direction Recall', 'Compass',
      'West was in the 2nd position in this list.')
add_q('Memorize the animals: [Falcon, Hawk, Eagle, Owl]. Which bird was 3rd in the list?',
      ['Falcon', 'Hawk', 'Eagle', 'Owl'], 'Eagle', 'EASY', 'Memory & Recall', 'Animal Recall', 'Birds of Prey',
      'Eagle was 3rd in the list.')
add_q('Study the instruments: [Piano, Guitar, Drums, Bass]. Which instrument was in the 4th position?',
      ['Piano', 'Guitar', 'Drums', 'Bass'], 'Bass', 'EASY', 'Memory & Recall', 'Instrument Recall', 'Music Gear',
      'Bass was the 4th instrument.')
add_q('Memorize this order: [Spring, Autumn, Summer, Winter]. Which season was in the 2nd position in this list?',
      ['Spring', 'Autumn', 'Summer', 'Winter'], 'Autumn', 'EASY', 'Memory & Recall', 'Season Recall', 'Seasons List',
      'Autumn was in the 2nd position in this specific list.')
add_q('Study the list: [Gold, Bronze, Silver, Copper]. Which metal was 3rd in the list?',
      ['Gold', 'Bronze', 'Silver', 'Copper'], 'Silver', 'EASY', 'Memory & Recall', 'Metal Recall', 'Metals List',
      'Silver was the 3rd metal in this list.')
add_q('Memorize the planets: [Jupiter, Saturn, Earth, Mars]. Which planet was 1st in the list?',
      ['Jupiter', 'Saturn', 'Earth', 'Mars'], 'Jupiter', 'EASY', 'Memory & Recall', 'Planet Recall', 'Planets List',
      'Jupiter was 1st in this list.')
add_q('Study the sequence: [Red, Yellow, Blue, Green]. Which color was 3rd in the list?',
      ['Red', 'Yellow', 'Blue', 'Green'], 'Blue', 'EASY', 'Memory & Recall', 'Color Recall', 'Colors List',
      'Blue was the 3rd color in this list.')
add_q('Memorize the list: [Triangle, Circle, Square, Hexagon]. Which polygon was in the 1st position?',
      ['Triangle', 'Circle', 'Square', 'Hexagon'], 'Triangle', 'EASY', 'Memory & Recall', 'Shape Recall', 'Shapes List',
      'Triangle was in the 1st position.')
add_q('Study the terms: [Input, Processing, Storage, Output]. Which computing stage was in the 3rd position?',
      ['Input', 'Processing', 'Storage', 'Output'], 'Storage', 'EASY', 'Memory & Recall', 'Computers Recall', 'System Flow',
      'Storage was in the 3rd position.')
add_q('Memorize the vehicles: [Car, Bicycle, Train, Plane]. Which mode of transport was 2nd?',
      ['Car', 'Bicycle', 'Train', 'Plane'], 'Bicycle', 'EASY', 'Memory & Recall', 'Vehicle Recall', 'Transport List',
      'Bicycle was 2nd in the list.')



# --- PART 10: Extra Association & Attribute Memory (35) ---
add_q('Study the element symbols: [Na = Sodium, K = Potassium, Fe = Iron, Pb = Lead]. Which element was paired with K?',
      ['Sodium', 'Potassium', 'Iron', 'Lead'], 'Potassium', 'EASY', 'Memory & Recall', 'Chemical Symbols', 'Paired Associations',
      'K is paired with Potassium.')
add_q('Memorize the pairings: [Hg = Mercury, Sn = Tin, W = Tungsten, Ag = Silver]. Which element was paired with W?',
      ['Mercury', 'Tin', 'Tungsten', 'Silver'], 'Tungsten', 'MEDIUM', 'Memory & Recall', 'Chemical Symbols', 'Paired Associations',
      'W is paired with Tungsten (from Wolfram).')
add_q('Study the pairings: [Oxygen = 8, Carbon = 6, Nitrogen = 7, Neon = 10]. Which atomic number was paired with Nitrogen?',
      ['8', '6', '7', '10'], '7', 'EASY', 'Memory & Recall', 'Chemistry Recall', 'Paired Associations',
      'Nitrogen was paired with 7.')
add_q('Memorize the pairings: [Helium = 2, Beryllium = 4, Fluorine = 9, Magnesium = 12]. What was paired with Fluorine?',
      ['2', '4', '9', '12'], '9', 'EASY', 'Memory & Recall', 'Chemistry Recall', 'Paired Associations',
      'Fluorine was paired with atomic number 9.')
add_q('Study the animal habitats: [Penguin = Antarctica, Kangaroo = Australia, Panda = China, Bison = North America]. Which animal was paired with Australia?',
      ['Penguin', 'Kangaroo', 'Panda', 'Bison'], 'Kangaroo', 'EASY', 'Memory & Recall', 'Zoology Recall', 'Paired Associations',
      'Kangaroo was paired with Australia.')
add_q('Memorize the pairings: [Tiger = Forest, Camel = Desert, Polar Bear = Tundra, Dolphin = Sea]. Which habitat was paired with Camel?',
      ['Forest', 'Desert', 'Tundra', 'Sea'], 'Desert', 'EASY', 'Memory & Recall', 'Zoology Recall', 'Paired Associations',
      'Camel was paired with Desert.')
add_q('Study the pairings: [Tokyo = Yen, London = Pound, Washington = Dollar, New Delhi = Rupee]. What currency was paired with London?',
      ['Yen', 'Pound', 'Dollar', 'Rupee'], 'Pound', 'EASY', 'Memory & Recall', 'Geography Recall', 'Paired Associations',
      'London was paired with Pound.')
add_q('Memorize the pairings: [Madrid = Spain, Lisbon = Portugal, Rome = Italy, Athens = Greece]. What capital was paired with Portugal?',
      ['Madrid', 'Lisbon', 'Rome', 'Athens'], 'Lisbon', 'EASY', 'Memory & Recall', 'Geography Recall', 'Paired Associations',
      'Lisbon was paired with Portugal.')
add_q('Study the pairings: [Nile = Africa, Amazon = South America, Yangtze = Asia, Danube = Europe]. Which river was paired with South America?',
      ['Nile', 'Amazon', 'Yangtze', 'Danube'], 'Amazon', 'EASY', 'Memory & Recall', 'Geography Recall', 'Paired Associations',
      'Amazon was paired with South America.')
add_q('Memorize the pairings: [Everest = Asia, Aconcagua = South America, Denali = North America, Elbrus = Europe]. Which peak was paired with Europe?',
      ['Everest', 'Aconcagua', 'Denali', 'Elbrus'], 'Elbrus', 'MEDIUM', 'Memory & Recall', 'Geography Recall', 'Paired Associations',
      'Mount Elbrus was paired with Europe.')
add_q('Study the device roles: [Router = IP Routing, Switch = MAC Switching, Firewall = Security Filter, Modem = Signal Modulation]. Which role was paired with Modem?',
      ['IP Routing', 'MAC Switching', 'Security Filter', 'Signal Modulation'], 'Signal Modulation', 'EASY', 'Memory & Recall', 'Tech Recall', 'Paired Associations',
      'Modem was paired with Signal Modulation.')
add_q('Memorize the pairings: [HTTP = 80, HTTPS = 443, SSH = 22, DNS = 53]. Which port was paired with SSH?',
      ['80', '443', '22', '53'], '22', 'EASY', 'Memory & Recall', 'Tech Recall', 'Paired Associations',
      'SSH was paired with port 22.')
add_q('Study the pairings: [RAM = Volatile, ROM = Non-volatile, SSD = Flash, HDD = Magnetic]. Which attribute was paired with RAM?',
      ['Volatile', 'Non-volatile', 'Flash', 'Magnetic'], 'Volatile', 'EASY', 'Memory & Recall', 'Tech Recall', 'Paired Associations',
      'RAM was paired with Volatile.')
add_q('Memorize the pairings: [CPU = Processor, GPU = Graphics, PSU = Power, Motherboard = Mainboard]. Which component was paired with GPU?',
      ['Processor', 'Graphics', 'Power', 'Mainboard'], 'Graphics', 'EASY', 'Memory & Recall', 'Tech Recall', 'Paired Associations',
      'GPU was paired with Graphics.')
add_q('Study the pairings: [Red = 1, Blue = 2, Green = 3, Yellow = 4]. What number was paired with Yellow?',
      ['1', '2', '3', '4'], '4', 'EASY', 'Memory & Recall', 'Color Codes', 'Paired Associations',
      'Yellow was paired with 4.')
add_q('Memorize the pairings: [Circle = 0 corners, Triangle = 3 corners, Square = 4 corners, Pentagon = 5 corners]. What was paired with Square?',
      ['0 corners', '3 corners', '4 corners', '5 corners'], '4 corners', 'EASY', 'Memory & Recall', 'Geometry Recall', 'Paired Associations',
      'Square was paired with 4 corners.')
add_q('Study the pairings: [Diamond = Hardest, Talc = Softest, Gold = Malleable, Copper = Ductile]. Which mineral was paired with Softest?',
      ['Diamond', 'Talc', 'Gold', 'Copper'], 'Talc', 'EASY', 'Memory & Recall', 'Science Recall', 'Paired Associations',
      'Talc was paired with Softest (Mohs scale 1).')
add_q('Memorize the pairings: [Mercury = Closest, Venus = Hottest, Saturn = Rings, Neptune = Coldest]. What planet was paired with Hottest?',
      ['Mercury', 'Venus', 'Saturn', 'Neptune'], 'Venus', 'EASY', 'Memory & Recall', 'Astronomy Recall', 'Paired Associations',
      'Venus was paired with Hottest.')
add_q('Study the pairings: [A = 10, B = 20, C = 30, D = 40]. What letter was paired with 30?',
      ['A', 'B', 'C', 'D'], 'C', 'EASY', 'Memory & Recall', 'Letter Codes', 'Paired Associations',
      'C was paired with 30.')
add_q('Memorize the pairings: [Sun = Star, Earth = Planet, Moon = Satellite, Halley = Comet]. What was paired with Halley?',
      ['Star', 'Planet', 'Satellite', 'Comet'], 'Comet', 'EASY', 'Memory & Recall', 'Astronomy Recall', 'Paired Associations',
      'Halley was paired with Comet.')
add_q('Study the pairings: [Proton = Positive, Electron = Negative, Neutron = Neutral, Photon = Zero mass]. What charge was paired with Proton?',
      ['Positive', 'Negative', 'Neutral', 'Zero mass'], 'Positive', 'EASY', 'Memory & Recall', 'Physics Recall', 'Paired Associations',
      'Proton was paired with Positive.')
add_q('Memorize the pairings: [Winter = December, Spring = March, Summer = June, Autumn = September]. Which month was paired with Spring?',
      ['December', 'March', 'June', 'September'], 'March', 'EASY', 'Memory & Recall', 'Season Recall', 'Paired Associations',
      'March was paired with Spring.')
add_q('Study the pairings: [Square = 4 sides, Pentagon = 5 sides, Hexagon = 6 sides, Octagon = 8 sides]. What was paired with Octagon?',
      ['4 sides', '5 sides', '6 sides', '8 sides'], '8 sides', 'EASY', 'Memory & Recall', 'Geometry Recall', 'Paired Associations',
      'Octagon was paired with 8 sides.')
add_q('Memorize the pairings: [Oxygen = Respiration, Chlorophyll = Photosynthesis, Hemoglobin = Transport, Enzyme = Catalysis]. What process was paired with Chlorophyll?',
      ['Respiration', 'Photosynthesis', 'Transport', 'Catalysis'], 'Photosynthesis', 'EASY', 'Memory & Recall', 'Biology Recall', 'Paired Associations',
      'Chlorophyll was paired with Photosynthesis.')
add_q('Study the pairings: [India = New Delhi, France = Paris, Germany = Berlin, Italy = Rome]. What capital was paired with France?',
      ['New Delhi', 'Paris', 'Berlin', 'Rome'], 'Paris', 'EASY', 'Memory & Recall', 'Geography Recall', 'Paired Associations',
      'Paris was paired with France.')
add_q('Memorize the pairings: [Apple = iOS, Google = Android, Microsoft = Windows, Canonical = Ubuntu]. What was paired with Microsoft?',
      ['iOS', 'Android', 'Windows', 'Ubuntu'], 'Windows', 'EASY', 'Memory & Recall', 'Tech Recall', 'Paired Associations',
      'Windows was paired with Microsoft.')
add_q('Study the pairings: [Newton = Force, Joule = Energy, Watt = Power, Pascal = Pressure]. What unit was paired with Power?',
      ['Newton', 'Joule', 'Watt', 'Pascal'], 'Watt', 'EASY', 'Memory & Recall', 'Physics Recall', 'Paired Associations',
      'Watt was paired with Power.')
add_q('Memorize the pairings: [Meter = Length, Kilogram = Mass, Second = Time, Kelvin = Temperature]. What unit was paired with Temperature?',
      ['Meter', 'Kilogram', 'Second', 'Kelvin'], 'Kelvin', 'EASY', 'Memory & Recall', 'Physics Recall', 'Paired Associations',
      'Kelvin was paired with Temperature.')
add_q('Study the pairings: [Gold = 79, Silver = 47, Copper = 29, Iron = 26]. What atomic number was paired with Gold?',
      ['79', '47', '29', '26'], '79', 'MEDIUM', 'Memory & Recall', 'Chemistry Recall', 'Paired Associations',
      'Gold was paired with atomic number 79.')
add_q('Memorize the pairings: [Mars = Phobos, Earth = Moon, Jupiter = Ganymede, Pluto = Charon]. What moon was paired with Jupiter?',
      ['Phobos', 'Moon', 'Ganymede', 'Charon'], 'Ganymede', 'MEDIUM', 'Memory & Recall', 'Astronomy Recall', 'Paired Associations',
      'Ganymede was paired with Jupiter.')
add_q('Study the pairings: [Water = 100°C, Ethanol = 78°C, Mercury = 357°C, Acetone = 56°C]. What boiling point was paired with Ethanol?',
      ['100°C', '78°C', '357°C', '56°C'], '78°C', 'MEDIUM', 'Memory & Recall', 'Chemistry Recall', 'Paired Associations',
      'Ethanol was paired with 78°C.')
add_q('Memorize the pairings: [Cricket = 11 players, Football = 11 players, Basketball = 5 players, Volleyball = 6 players]. How many players were paired with Basketball?',
      ['11 players', '5 players', '6 players', '7 players'], '5 players', 'EASY', 'Memory & Recall', 'Sports Recall', 'Paired Associations',
      'Basketball was paired with 5 players.')
add_q('Study the pairings: [Red = Stop, Green = Go, Yellow = Caution, Blue = Info]. What action was paired with Green?',
      ['Stop', 'Go', 'Caution', 'Info'], 'Go', 'EASY', 'Memory & Recall', 'Signaling Recall', 'Paired Associations',
      'Green was paired with Go.')
add_q('Memorize the pairings: [Hydrogen = H, Helium = He, Lithium = Li, Beryllium = Be]. What symbol was paired with Helium?',
      ['H', 'He', 'Li', 'Be'], 'He', 'EASY', 'Memory & Recall', 'Chemistry Recall', 'Paired Associations',
      'He was paired with Helium.')
add_q('Study the pairings: [1st = Gold medal, 2nd = Silver medal, 3rd = Bronze medal, 4th = Certificate]. What medal was paired with 3rd place?',
      ['Gold medal', 'Silver medal', 'Bronze medal', 'Certificate'], 'Bronze medal', 'EASY', 'Memory & Recall', 'Award Recall', 'Paired Associations',
      '3rd place was paired with Bronze medal.')

print(f'Total MEMORY questions authored: {len(questions)}')

# Save to scripts/data/round3_memory.json
os.makedirs('scripts/data', exist_ok=True)
with open('scripts/data/round3_memory.json', 'w', encoding='utf-8') as out:
    json.dump(questions, out, indent=2, ensure_ascii=False)
print('Successfully saved scripts/data/round3_memory.json')
