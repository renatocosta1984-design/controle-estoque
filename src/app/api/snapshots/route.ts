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

    if (!id) {
      const { data, error } = await supabase
        .from('inventory_snapshots')
        .select('id, week_date, imported_at, status, total_products, total_qty_on_hand, total_qty_available, total_value_on_hand')
        .eq('user_id', user.id)
        .order('week_date', { ascending: false });
      if (error) throw error;

      // compute extra fields cheaply: value_coverage/zero/negative per snapshot with 1 query each would be heavy.
      // For MVP: compute only for latest snapshot (first) if needed.
      const snapshots = (data ?? []).map((s) => ({
        ...s,
        value_coverage: 0,
        zero_qty: 0,
        negative_qty: 0
      }));

      // If there is at least one snapshot, enrich the first with computed metrics
      if (snapshots.length) {
        const snapId = snapshots[0].id;
        const { data: lines, error: lErr } = await supabase
          .from('inventory_snapshot_lines')
          .select('qty_on_hand, qty_available, value_on_hand, unit_price')
          .eq('user_id', user.id)
          .eq('snapshot_id', snapId);
        if (!lErr && lines) {
          let valueCount = 0;
          let zeroQty = 0;
          let negativeQty = 0;
          for (const l of lines) {
            if (l.value_on_hand !== null && Number.isFinite(Number(l.value_on_hand))) valueCount++;
            if (Number(l.qty_on_hand) === 0) zeroQty++;
            if (Number(l.qty_on_hand) < 0 || Number(l.qty_available) < 0) negativeQty++;
          }
          snapshots[0].value_coverage = lines.length ? valueCount / lines.length : 0;
          snapshots[0].zero_qty = zeroQty;
          snapshots[0].negative_qty = negativeQty;
        }
      }

      return NextResponse.json({ snapshots });
    }

    // Return snapshot lines
    const { data: snap, error: sErr } = await supabase
      .from('inventory_snapshots')
      .select('id, week_date')
      .eq('user_id', user.id)
      .eq('id', id)
      .single();
    if (sErr) throw sErr;

    const { data: lines, error: lErr } = await supabase
      .from('inventory_snapshot_lines')
      .select('product_id, sku_raw, unit_price, qty_on_hand, qty_available, value_on_hand, products(name)')
      .eq('user_id', user.id)
      .eq('snapshot_id', id);
    if (lErr) throw lErr;

    const out = (lines ?? []).map((l: any) => ({
      product_id: l.product_id,
      sku_raw: l.sku_raw,
      unit_price: l.unit_price,
      qty_on_hand: l.qty_on_hand,
      qty_available: l.qty_available,
      value_on_hand: l.value_on_hand,
      name: l.products?.name ?? ''
    }));

    return NextResponse.json({ snapshot: snap, lines: out });
  } catch (e: any) {
    return NextResponse.json({ error: e.message ?? String(e) }, { status: 401 });
  }
}
