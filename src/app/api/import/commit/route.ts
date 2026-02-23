import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createServerSupabaseAdmin } from '@/lib/supabase/server';
import { requireUser } from '@/lib/supabase/auth';
import { parseInventoryExcel } from '@/lib/inventory/parseExcel';
import { aggregateAndValidate } from '@/lib/inventory/importLogic';

export const runtime = 'nodejs';

const BodySchema = z.object({
  import_run_id: z.string().min(1),
  week_date: z.string().min(10),
  storage_path: z.string().min(1)
});

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

export async function POST(req: NextRequest) {
  const supabase = createServerSupabaseAdmin();

  let userId = '';
  let importRunId = '';

  try {
    const { user } = await requireUser(req);
    userId = user.id;

    const body = BodySchema.parse(await req.json());
    importRunId = body.import_run_id;

    // Prevent duplicate week import
    const { data: existing } = await supabase
      .from('inventory_snapshots')
      .select('id')
      .eq('user_id', userId)
      .eq('week_date', body.week_date)
      .maybeSingle();
    if (existing?.id) {
      await supabase
        .from('import_runs')
        .update({
          finished_at: new Date().toISOString(),
          errors_count: 1,
          errors_json: [{ code: 'week_already_exists', message: `Já existe snapshot para a semana ${body.week_date}.` }]
        })
        .eq('id', importRunId)
        .eq('user_id', userId);

      return NextResponse.json({ error: `Já existe snapshot para a semana ${body.week_date}.` }, { status: 409 });
    }

    const bucket = process.env.IMPORTS_BUCKET ?? 'imports';

    // Download file from storage
    const dl = await supabase.storage.from(bucket).download(body.storage_path);
    if (dl.error) throw dl.error;
    const buffer = await dl.data.arrayBuffer();

    const parsed = parseInventoryExcel(buffer);
    const agg = aggregateAndValidate(parsed.rows);

    const warnings = [...parsed.warnings, ...agg.warnings];

    // Create snapshot
    const status = warnings.length > 0 ? 'imported_with_warnings' : 'imported';
    const { data: snapshot, error: snapErr } = await supabase
      .from('inventory_snapshots')
      .insert({
        user_id: userId,
        week_date: body.week_date,
        source_filename: body.storage_path.split('/').pop() ?? null,
        total_rows_read: agg.stats.rowsRead,
        total_products: agg.stats.rowsAggregated,
        status
      })
      .select('id')
      .single();
    if (snapErr) throw snapErr;

    const snapshotId = snapshot.id as string;

    // Upsert products (manual select/insert for compatibility with partial unique index)
    const productIdByKey = new Map<string, string>();

    for (const r of agg.aggregated) {
      const sku = r.sku?.trim() || null;

      if (sku) {
        const { data: found, error: fErr } = await supabase
          .from('products')
          .select('id')
          .eq('user_id', userId)
          .eq('sku', sku)
          .maybeSingle();
        if (fErr) throw fErr;

        if (found?.id) {
          // update metadata
          const { error: uErr } = await supabase
            .from('products')
            .update({ name: r.name, unit: r.unit, location: r.location })
            .eq('id', found.id)
            .eq('user_id', userId);
          if (uErr) throw uErr;
          productIdByKey.set(`SKU:${sku.toUpperCase()}`, found.id);
        } else {
          const { data: ins, error: iErr } = await supabase
            .from('products')
            .insert({ user_id: userId, sku, name: r.name, unit: r.unit, location: r.location })
            .select('id')
            .single();
          if (iErr) throw iErr;
          productIdByKey.set(`SKU:${sku.toUpperCase()}`, ins.id);
        }
      } else {
        // sku null: match by name+sku null
        const { data: found, error: fErr } = await supabase
          .from('products')
          .select('id')
          .eq('user_id', userId)
          .is('sku', null)
          .eq('name', r.name)
          .maybeSingle();
        if (fErr) throw fErr;

        if (found?.id) {
          const { error: uErr } = await supabase
            .from('products')
            .update({ unit: r.unit, location: r.location })
            .eq('id', found.id)
            .eq('user_id', userId);
          if (uErr) throw uErr;
          productIdByKey.set(`NAME:${r.name.toUpperCase()}`, found.id);
        } else {
          const { data: ins, error: iErr } = await supabase
            .from('products')
            .insert({ user_id: userId, sku: null, name: r.name, unit: r.unit, location: r.location })
            .select('id')
            .single();
          if (iErr) throw iErr;
          productIdByKey.set(`NAME:${r.name.toUpperCase()}`, ins.id);
        }
      }
    }

    // Insert snapshot lines
    const lines = agg.aggregated.map((r) => {
      const sku = r.sku?.trim() || null;
      const productId = sku
        ? productIdByKey.get(`SKU:${sku.toUpperCase()}`)
        : productIdByKey.get(`NAME:${r.name.toUpperCase()}`);
      if (!productId) throw new Error(`Falha ao resolver product_id para: ${r.name} (${sku ?? 'sem SKU'})`);

      const unitPrice = r.unitPrice === null ? null : Number(r.unitPrice);
      const valueOnHand = unitPrice && unitPrice > 0 ? Number(r.qtyOnHand) * unitPrice : null;

      return {
        user_id: userId,
        snapshot_id: snapshotId,
        product_id: productId,
        sku_raw: sku,
        unit_price: unitPrice,
        qty_on_hand: Number(r.qtyOnHand),
        qty_available: Number(r.qtyAvailable),
        value_on_hand: valueOnHand
      };
    });

    let rowsInserted = 0;
    for (const part of chunk(lines, 500)) {
      const { error: lErr } = await supabase.from('inventory_snapshot_lines').insert(part);
      if (lErr) throw lErr;
      rowsInserted += part.length;
    }

    // Compute totals
    let totalOnHand = 0;
    let totalAvailable = 0;
    let totalValue = 0;
    let valueCount = 0;
    let zeroQty = 0;
    let negativeQty = 0;

    for (const l of lines) {
      totalOnHand += l.qty_on_hand;
      totalAvailable += l.qty_available;
      if (l.qty_on_hand === 0) zeroQty++;
      if (l.qty_on_hand < 0 || l.qty_available < 0) negativeQty++;
      if (l.value_on_hand !== null) {
        totalValue += l.value_on_hand;
        valueCount++;
      }
    }

    const totalValueOrNull = valueCount > 0 ? totalValue : null;
    const valueCoverage = lines.length ? valueCount / lines.length : 0;

    const { error: upSnapErr } = await supabase
      .from('inventory_snapshots')
      .update({
        total_qty_on_hand: totalOnHand,
        total_qty_available: totalAvailable,
        total_value_on_hand: totalValueOrNull
      })
      .eq('id', snapshotId)
      .eq('user_id', userId);
    if (upSnapErr) throw upSnapErr;

    // Close import run
    await supabase
      .from('import_runs')
      .update({
        snapshot_id: snapshotId,
        finished_at: new Date().toISOString(),
        rows_read: agg.stats.rowsRead,
        rows_imported: rowsInserted,
        warnings_count: warnings.length,
        errors_count: 0,
        warnings_json: warnings,
        errors_json: []
      })
      .eq('id', importRunId)
      .eq('user_id', userId);

    return NextResponse.json({
      snapshot_id: snapshotId,
      stats: {
        ...agg.stats,
        sheet_name: parsed.sheetName,
        value_coverage: valueCoverage,
        zero_qty: zeroQty,
        negative_qty: negativeQty
      },
      warnings,
      errors: []
    });
  } catch (e: any) {
    // best-effort error logging
    if (userId && importRunId) {
      await supabase
        .from('import_runs')
        .update({
          finished_at: new Date().toISOString(),
          errors_count: 1,
          errors_json: [{ code: 'import_failed', message: e.message ?? String(e) }]
        })
        .eq('id', importRunId)
        .eq('user_id', userId);
    }

    return NextResponse.json({ error: e.message ?? String(e) }, { status: 400 });
  }
}
