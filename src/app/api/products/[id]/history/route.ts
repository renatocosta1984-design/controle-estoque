import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseAdmin } from '@/lib/supabase/server';
import { requireUser } from '@/lib/supabase/auth';

export const runtime = 'nodejs';

export async function GET(req: NextRequest, ctx: { params: { id: string } }) {
  try {
    const { user } = await requireUser(req);
    const supabase = createServerSupabaseAdmin();
    const productId = ctx.params.id;

    const { data, error } = await supabase
      .from('inventory_snapshot_lines')
      .select('qty_on_hand, qty_available, unit_price, inventory_snapshots(week_date)')
      .eq('user_id', user.id)
      .eq('product_id', productId)
      .order('created_at', { ascending: false })
      .limit(52);

    if (error) throw error;

    const history = (data ?? []).map((r: any) => ({
      week_date: r.inventory_snapshots?.week_date,
      qty_on_hand: r.qty_on_hand,
      qty_available: r.qty_available,
      unit_price: r.unit_price
    }));

    return NextResponse.json({ history });
  } catch (e: any) {
    return NextResponse.json({ error: e.message ?? String(e) }, { status: 401 });
  }
}
