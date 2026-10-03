import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://pxqyeonymwlpiklfyjbb.supabase.co';
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB4cXllb255bXdscGlrbGZ5amJiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg5MTc2NzAsImV4cCI6MjEwNDQ5MzY3MH0.Oo5y8zsMbS4uq3HuZmWUbkk_VGkvRW0_J-jCGQkhTlg';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function inspectTelegramData() {
  console.log('--- Inspecting Telegram Tasks and Completions ---');

  // 1. Fetch recent lifafa_tasks where task_type includes TELEGRAM
  const { data: tasks, error: taskErr } = await supabase
    .from('lifafa_tasks')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(10);

  console.log('Recent lifafa_tasks count:', tasks?.length, 'error:', taskErr?.message);
  if (tasks && tasks.length > 0) {
    tasks.forEach((t) => {
      console.log(`Task [${t.id}] type=${t.task_type} title=${t.title} ch_username=${t.telegram_channel_username} ch_id=${t.telegram_channel_id} url=${t.target_url}`);
    });
  }

  // 2. Fetch task_completions
  const { data: completions, error: compErr } = await supabase
    .from('task_completions')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(10);

  console.log('\nRecent task_completions count:', completions?.length, 'error:', compErr?.message);
  if (completions && completions.length > 0) {
    completions.forEach((c) => {
      console.log(`Completion [${c.id}] task_id=${c.task_id} user_id=${c.user_id} status=${c.status} verified_via_bot=${c.verified_via_bot} metadata=${JSON.stringify(c.metadata)}`);
    });
  }

  // 3. Check profiles with telegram binding
  const { data: profiles, error: profErr } = await supabase
    .from('profiles')
    .select('id, full_name, telegram_user_id, telegram_username, updated_at')
    .not('telegram_user_id', 'is', null)
    .limit(10);

  console.log('\nBound profiles count:', profiles?.length, 'error:', profErr?.message);
  if (profiles && profiles.length > 0) {
    profiles.forEach((p) => {
      console.log(`Profile [${p.id}] tg_id=${p.telegram_user_id} tg_user=${p.telegram_username}`);
    });
  }
}

inspectTelegramData().catch(console.error);
