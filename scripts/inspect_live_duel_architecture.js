// Strict READ-ONLY live architecture inspection script
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://pxqyeonymwlpiklfyjbb.supabase.co';
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB4cXllb255bXdscGlrbGZ5amJiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg5MTc2NzAsImV4cCI6MjEwNDQ5MzY3MH0.Oo5y8zsMbS4uq3HuZmWUbkk_VGkvRW0_J-jCGQkhTlg';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function inspect() {
  console.log('--- LIVE SUPABASE DUEL ARCHITECTURE PROBE ---');

  // 1. Check duel_questions_public
  const { data: questions, count: qCount, error: qErr } = await supabase
    .from('duel_questions_public')
    .select('*', { count: 'exact' });

  if (qErr) {
    console.error('Error fetching duel_questions_public:', qErr.message);
  } else {
    console.log(`Live duel_questions count: ${qCount} (Fetched: ${questions.length})`);
    console.log('Columns in duel_questions_public:', Object.keys(questions[0] || {}));
    console.log('Existing Question IDs:', questions.map(q => q.id));
    
    // Group by round_type
    const roundBreakdown = {};
    questions.forEach(q => {
      roundBreakdown[q.round_type] = (roundBreakdown[q.round_type] || 0) + 1;
    });
    console.log('Round Breakdown:', roundBreakdown);
  }

  // 2. Direct query on duel_questions (should fail due to RLS / REVOKE)
  const { data: directQ, error: directErr } = await supabase
    .from('duel_questions')
    .select('id, correct_answer');
  console.log('Direct select on duel_questions permitted?:', directErr ? `NO (${directErr.message})` : `YES (Risk: ${directQ?.length} rows exposed)`);

  // 3. Check historical duel_rounds references
  const { data: rounds, count: rCount, error: rErr } = await supabase
    .from('duel_rounds')
    .select('question_id', { count: 'exact' });

  if (rErr) {
    console.log('duel_rounds query status:', rErr.message);
  } else {
    console.log(`Total historical duel_rounds: ${rCount}`);
    const usedQuestions = new Set(rounds?.map(r => r.question_id));
    console.log('Referenced question IDs in historical matches:', Array.from(usedQuestions));
  }

  // 4. Check if duel_question_exposures table exists
  const { error: expErr } = await supabase
    .from('duel_question_exposures')
    .select('id')
    .limit(1);
  console.log('Does table duel_question_exposures exist?:', expErr ? `NO (${expErr.message})` : 'YES');

  // 5. Inspect duel_matches schema
  const { data: matches, count: mCount } = await supabase
    .from('duel_matches')
    .select('*', { count: 'exact' })
    .limit(1);
  console.log(`Total matches in DB: ${mCount}`);
  if (matches && matches[0]) {
    console.log('Columns on duel_matches:', Object.keys(matches[0]));
  }
}

inspect().catch(err => {
  console.error('Fatal probe error:', err);
  process.exit(1);
});
