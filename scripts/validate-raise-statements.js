import fs from 'fs';

const content = fs.readFileSync('supabase/migrations/049_lifafa_payout_fee_escrow.sql', 'utf8');
const lines = content.split('\n');

let totalStatements = 0;
let mismatches = [];

for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('RAISE')) {
    let stmt = lines[i].trim();
    let j = i;
    while (!stmt.includes(';') && j < lines.length - 1) {
      j++;
      stmt += ' ' + lines[j].trim();
    }
    totalStatements++;
    console.log(`Line ${i + 1}: ${stmt}`);

    // Parse RAISE statement
    // Format could be RAISE EXCEPTION 'msg', arg1, arg2; or RAISE EXCEPTION USING MESSAGE = ...
    if (stmt.includes('USING MESSAGE')) {
      console.log('  -> Uses USING MESSAGE clause (safe)');
    } else {
      const match = stmt.match(/RAISE\s+(?:EXCEPTION|WARNING|NOTICE|INFO)\s+'((?:''|[^'])*)'(.*);/i);
      if (match) {
        const msg = match[1];
        const argsStr = match[2].trim();
        // Count non-escaped '%' (in postgres plpgsql, %% is escaped %)
        // But if % is followed by %, it's %%
        const singlePercents = (msg.match(/(?<!%)%(?!%)/g) || []).length;
        const doublePercents = (msg.match(/%%/g) || []).length;
        const totalPercents = (msg.match(/%/g) || []).length;

        let args = [];
        if (argsStr.startsWith(',')) {
          // parse comma-separated args, respecting function calls / parentheses
          let depth = 0;
          let current = '';
          for (let c of argsStr.substring(1)) {
            if (c === '(') depth++;
            else if (c === ')') depth--;
            if (c === ',' && depth === 0) {
              args.push(current.trim());
              current = '';
            } else {
              current += c;
            }
          }
          if (current.trim()) args.push(current.trim());
        }

        console.log(`  -> Format string: "${msg}"`);
        console.log(`  -> Placeholder count: ${singlePercents} (total %: ${totalPercents}, %%: ${doublePercents}), Arguments count: ${args.length}`);
        args.forEach((a, idx) => console.log(`     Arg ${idx + 1}: ${a}`));

        if (singlePercents !== args.length) {
          mismatches.push({ line: i + 1, stmt, singlePercents, argsCount: args.length });
          console.log(`  *** MISMATCH DETECTED at Line ${i + 1}: Expected ${singlePercents} args, got ${args.length} ***`);
        }
      }
    }
  }
}

console.log('\n========================================');
console.log(`Total RAISE statements inspected: ${totalStatements}`);
console.log(`Mismatches found: ${mismatches.length}`);
mismatches.forEach(m => console.log(`- Line ${m.line}: ${m.stmt}`));
console.log('========================================');
