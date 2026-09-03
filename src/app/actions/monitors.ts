'use server';

import { currentUser } from '@clerk/nextjs/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { revalidatePath } from 'next/cache';

export async function createMonitor(formData: FormData) {
  const user = await currentUser();
  if (!user) {
    throw new Error('Unauthorized');
  }

  const name = formData.get('name') as string;
  const rawUrl = formData.get('url') as string;
  const method = (formData.get('method') as string) || 'GET';
  const timeoutMs = parseInt(formData.get('timeout_ms') as string, 10) || 5000;
  const notifyEmail = (formData.get('notify_email') as string) || user.emailAddresses[0]?.emailAddress;

  // URL cleanup
  let cleanUrl = rawUrl.trim();
  if (!cleanUrl.startsWith('http://') && !cleanUrl.startsWith('https://')) {
    cleanUrl = `https://${cleanUrl}`;
  }

  // 1. Insert monitor
  const { data: monitor, error: monitorError } = await supabaseAdmin
    .from('monitors')
    .insert({
      user_id: user.id,
      name,
      url: cleanUrl,
      method,
      timeout_ms: timeoutMs,
      status: 'Operational',
    })
    .select()
    .single();

  if (monitorError || !monitor) {
    throw new Error(monitorError?.message || 'Failed to create monitor');
  }

  // 2. Insert alert settings
  if (notifyEmail) {
    await supabaseAdmin.from('alert_settings').insert({
      monitor_id: monitor.id,
      notify_email: notifyEmail,
      failure_threshold: 1,
    });
  }

  revalidatePath('/');
  return { success: true };
}