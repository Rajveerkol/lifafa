import re

with open('scripts/builders/author_round2.py', 'r', encoding='utf-8') as f:
    content = f.read()

replacements = [
    ("add_q('Complete the sequence: 0, 7, 26, 63, 124, ?'",
     "add_q('Following the cubic pattern n³ - 1 (0, 7, 26, 63, 124), what is the 6th term?'"),
    ("add_q('Identify the next number in the sequence: 10, 18, 28, 40, 54, 70, ?'",
     "add_q('With second-order increments (+8, +10, +12, +14, +16, +18), find the next term after 70 in 10, 18, 28, 40, 54, 70:'"),
    ("add_q('Complete the sequence: 64, 32, 16, 8, 4, ?'",
     "add_q('Halving each term successively (64, 32, 16, 8, 4), what number comes next?'"),
    ("add_q('Complete the sequence: 1, 5, 14, 30, 55, 91, ?'",
     "add_q('Summing consecutive squares 1² + 2² + ... (1, 5, 14, 30, 55, 91), what is the subsequent term?'"),
    ("add_q('Complete the sequence: 3, 5, 9, 17, 33, 65, ?'",
     "add_q('In the progression where differences double (3, 5, 9, 17, 33, 65), determine the succeeding value:'"),
    ("add_q('Find the next value: 100, 96, 88, 72, 40, ?'",
     "add_q('Subtracting successive powers of 2 (100, 96, 88, 72, 40), what is the next number?'"),
    ("add_q('Complete the sequence: 2, 6, 12, 20, 30, 42, ?'",
     "add_q('Following pronic numbers n(n+1) (2, 6, 12, 20, 30, 42), what is the next value?'"),
    ("add_q('Identify the next number in the sequence: 1, 4, 13, 40, 121, ?'",
     "add_q('Each term triples and adds 1 (1, 4, 13, 40, 121). What follows 121?'"),
    ("add_q('Complete the sequence: 10, 14, 26, 62, 170, ?'",
     "add_q('With gaps multiplying by 3 (10, 14, 26, 62, 170), find the next number:'"),
    ("add_q('Complete the sequence: 81, 27, 9, 3, ?'",
     "add_q('Dividing by 3 at every step (81, 27, 9, 3), what is the next term?'"),
    ("add_q('Find the next value: 0, 3, 8, 15, 24, 35, ?'",
     "add_q('In the pattern of squares minus one n² - 1 (0, 3, 8, 15, 24, 35), what value succeeds 35?'"),
    ("add_q('Identify the next number in the sequence: 5, 16, 51, 158, ?'",
     "add_q('Following the recurrence 3n + 1 (5, 16, 51, 158), what is the next term?'"),
    ("add_q('Complete the sequence: 1, 2, 6, 21, 88, ?'",
     "add_q('Following the factorial-like recurrence n × k + k (1, 2, 6, 21, 88), find the next value:'"),
    ("add_q('Identify the next number in the sequence: 1, 8, 81, 1024, ?'",
     "add_q('Evaluating powers nⁿ (1¹, 2³, 3⁴, 4⁵), what is the 5th term following 1024?'"),
    ("add_q('Complete the sequence: 2, 3, 7, 16, 32, 57, ?'",
     "add_q('With square increments +1, +4, +9, +16, +25, what succeeds 57 in 2, 3, 7, 16, 32, 57?'"),
    ("add_q('Find the next value: 7, 9, 12, 17, 24, 35, ?'",
     "add_q('Analyzing primes as step increments (+2, +3, +5, +7, +11), what follows 35 in 7, 9, 12, 17, 24, 35?'"),
    ("add_q('What is the next letter in the sequence: C, F, I, L, O, ?'",
     "add_q('Advancing by 3 letters each step (C, F, I, L, O), what is the next letter?'"),
    ("add_q('Find the next letter in the sequence: Z, W, T, Q, N, ?'",
     "add_q('Stepping backward by 3 positions from Z (Z, W, T, Q, N), which letter follows?'"),
    ("add_q('Complete the sequence: D, H, L, P, T, ?'",
     "add_q('Advancing by 4 letters across the alphabet (D, H, L, P, T), which letter comes next?'"),
    ("add_q('What is the next letter in the sequence: A, D, I, P, ?'",
     "add_q('Mapping alphabet indices to perfect squares (1²=A, 2²=D, 3²=I, 4²=P), what is the 5th letter?'"),
    ("add_q('Complete the sequence: J, M, P, S, ?'",
     "add_q('In the uniform +3 alphabetic stride J, M, P, S, what is the next letter?'"),
    ("add_q('Find the next letter in the sequence: F, G, I, L, P, ?'",
     "add_q('With accelerating letter gaps (+1, +2, +3, +4, +5), what letter follows P in F, G, I, L, P?'"),
    ("add_q('Identify the next letter: Y, U, Q, M, I, ?'",
     "add_q('Stepping backward by 4 letters each term (Y, U, Q, M, I), what letter comes next?'"),
    ("add_q('What is the next letter in the sequence: M, N, O, L, R, I, ?'",
     "add_q('In the dual interleaved series (M, O, R and N, L, I), what is the 7th letter after I?'"),
    ("add_q('Find the next letter in the sequence: A, C, F, J, O, ?'",
     "add_q('With triangular letter increments (+2, +3, +4, +5, +6), what succeeds O in A, C, F, J, O?'"),
    ("add_q('Identify the next letter: B, E, H, K, N, ?'",
     "add_q('Advancing by 3 letters starting from B (B, E, H, K, N), what letter is next?'"),
    ("add_q('Complete the sequence: Z, Y, W, T, P, ?'",
     "add_q('With expanding backward steps (-1, -2, -3, -4, -5), what letter follows P in Z, Y, W, T, P?'"),
    ("add_q('Complete the sequence: E, J, O, T, ?'",
     "add_q('Advancing by 5 letters at each step (E, J, O, T), which letter succeeds T?'"),
    ("add_q('Find the next letter in the sequence: A, D, G, J, M, P, ?'",
     "add_q('Following the arithmetic progression of letters +3 (A, D, G, J, M, P), what is next?'"),
    ("add_q('Identify the next letter: K, L, N, Q, U, ?'",
     "add_q('With increasing letter skips (+1, +2, +3, +4, +5), what letter follows U in K, L, N, Q, U?'"),
    ("add_q('Complete the sequence: AZ, CX, EV, GT, ?'",
     "add_q('Observing advancing odd letters and complementary reverse letters, what succeeds GT in AZ, CX, EV, GT?'"),
    ("add_q('Complete the sequence: Z26, Y25, X24, W23, ?'",
     "add_q('Tracing the reverse alphabet alongside positions (Z26, Y25, X24, W23), what is the next code?'"),
    ("add_q('Complete the sequence: P1, Q4, R9, S16, ?'",
     "add_q('Pairing advancing letters with square numbers (P1, Q4, R9, S16), what comes next?'"),
    ("add_q('Complete the sequence: 1X2, 2W3, 3V4, 4U5, ?'",
     "add_q('Sandwiching reverse letters between incrementing integers (1X2, 2W3, 3V4, 4U5), what is next?'")
]

replaced_count = 0
for old, new in replacements:
    if old in content:
        content = content.replace(old, new, 1)
        replaced_count += 1
    else:
        print(f"NOT FOUND: {old}")

with open('scripts/builders/author_round2.py', 'w', encoding='utf-8') as f:
    f.write(content)

print(f"Replaced {replaced_count}/{len(replacements)} prompts in author_round2.py")
