import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseAdmin } from '@/lib/supabase/server';
import { requireUser } from '@/lib/supabase/auth';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  try {
    const { user } = await requireUser(req);
    const supabase = createServerSupabaseAdmin();

    const url = new URL(req.url);
    const id = url.searchParams.get('id');
    if (id) {
      const { data, error } = await supabase
        .from('products')
        .select('id, sku, name, unit, location')
        .eq('user_id', user.id)
        .eq('id', id)
        .single();
      if (error) throw error;
      return NextResponse.json({ product: data });
    }

    const search = (url.searchParams.get('search') ?? '').trim();

    let q = supabase
      .from('products')
      .select('id, sku, name, unit, location')
      .eq('user_id', user.id)
      .order('name', { ascending: true })
      .limit(200);

    if (search) {
      // simple OR filter
      q = q.or(`name.ilike.%${search}%,sku.ilike.%${search}%`);
    }

    const { data, error } = await q;
    if (error) throw error;

    return NextResponse.json({ products: data ?? [] });
  } catch (e: any) {
    return NextResponse.json({ error: e.message ?? String(e) }, { status: 401 });
  }
}
