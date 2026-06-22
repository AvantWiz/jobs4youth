// Step 8 email sender template for Supabase Edge Functions
// Suggested file path: supabase/functions/send-email-queue/index.ts
// Required secrets: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, RESEND_API_KEY, RESEND_FROM_EMAIL

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

Deno.serve(async () => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  const { data: queued, error: fetchError } = await supabase
    .from('email_queue')
    .select('*')
    .eq('queue_status', 'Queued')
    .order('created_at', { ascending: true })
    .limit(20);

  if (fetchError) {
    return new Response(JSON.stringify({ ok: false, error: fetchError.message }), { status: 500 });
  }

  const resendApiKey = Deno.env.get('RESEND_API_KEY');
  const fromEmail = Deno.env.get('RESEND_FROM_EMAIL');
  if (!resendApiKey || !fromEmail) {
    return new Response(JSON.stringify({ ok: false, error: 'Missing email secrets' }), { status: 500 });
  }

  const results: Array<Record<string, string>> = [];
  for (const item of queued ?? []) {
    try {
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${resendApiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          from: fromEmail,
          to: [item.recipient_email],
          subject: item.subject,
          text: item.body
        })
      });

      if (!response.ok) {
        const errorBody = await response.text();
        await supabase.from('email_queue').update({ queue_status: 'Failed', error_message: errorBody, processed_at: new Date().toISOString() }).eq('id', item.id);
        results.push({ id: item.id, status: 'Failed' });
        continue;
      }

      await supabase.from('email_queue').update({ queue_status: 'Sent', processed_at: new Date().toISOString(), error_message: null }).eq('id', item.id);
      results.push({ id: item.id, status: 'Sent' });
    } catch (error) {
      await supabase.from('email_queue').update({ queue_status: 'Failed', error_message: String(error), processed_at: new Date().toISOString() }).eq('id', item.id);
      results.push({ id: item.id, status: 'Failed' });
    }
  }

  return new Response(JSON.stringify({ ok: true, processed: results.length, results }), { status: 200 });
});
