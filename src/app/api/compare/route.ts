import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseAdmin } from '@/lib/supabase/server';
import { requireUser } from '@/lib/supabase/auth';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  try {
    const { user } = await requireUser(req);
    const supabase = createServerSupabaseAdmin();

    const url = new URL(req.url);
    const weekA = url.searchParams.get('weekA');
    const weekB = url.searchParams.get('weekB');
    if (!weekA || !weekB) {
      return NextResponse.json({ error: 'Parâmetros weekA e weekB são obrigatórios.' }, { status: 400 });
    }

    const { data: a } = await supabase
      .from('inventory_snapshots')
      .select('id')
      .eq('user_id', user.id)
      .eq('week_date', weekA)
      .maybeSingle();
    const { data: b } = await supabase
      .from('inventory_snapshots')
      .select('id')
      .eq('user_id', user.id)
      .eq('week_date', weekB)
      .maybeSingle();

    if (!a?.id || !b?.id) {
      return NextResponse.json({ error: 'Não foi possível encontrar snapshots para as semanas informadas.' }, { status: 404 });
    }

    const [linesA, linesB] = await Promise.all([
      supabase
        .from('inventory_snapshot_lines')
        .select('product_id, sku_raw, qty_on_hand, products(name)')
        .eq('user_id', user.id)
        .eq('snapshot_id', a.id),
      supabase
        .from('inventory_snapshot_lines')
        .select('product_id, sku_raw, qty_on_hand, products(name)')
        .eq('user_id', user.id)
        .eq('snapshot_id', b.id)
    ]);

    if (linesA.error) throw linesA.error;
    if (linesB.error) throw linesB.error;

    const mapA = new Map<string, any>();
    for (const l of linesA.data ?? []) mapA.set(l.product_id, l);
    const mapB = new Map<string, any>();
    for (const l of linesB.data ?? []) mapB.set(l.product_id, l);

    const ids = new Set<string>([...mapA.keys(), ...mapB.keys()]);
    const rows = Array.from(ids).map((pid) => {
      const la = mapA.get(pid);
      const lb = mapB.get(pid);
      const qtyA = Number(la?.qty_on_hand ?? 0);
      const qtyB = Number(lb?.qty_on_hand ?? 0);
      return {
        product_id: pid,
        sku: (la?.sku_raw ?? lb?.sku_raw) ?? null,
        name: la?.products?.name ?? lb?.products?.name ?? '',
        qtyA,
        qtyB,
        delta: qtyA - qtyB
      };
    });

    return NextResponse.json({ weekA, weekB, rows });
  } catch (e: any) {
    return NextResponse.json({ error: e.message ?? String(e) }, { status: 401 });
  }
}
