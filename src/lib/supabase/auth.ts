import { NextRequest } from 'next/server';
import { createServerSupabaseAdmin } from './server';

export async function requireUser(req: NextRequest) {
  const auth = req.headers.get('authorization') ?? '';
  const match = auth.match(/^Bearer\s+(.+)$/i);
  const token = match?.[1];
  if (!token) throw new Error('Missing Authorization: Bearer <token>');

  const supabase = createServerSupabaseAdmin();
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) throw new Error('Unauthorized');
  return { user: data.user, token };
}
