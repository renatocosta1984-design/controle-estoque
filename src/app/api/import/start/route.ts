import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createServerSupabaseAdmin } from '@/lib/supabase/server';
import { requireUser } from '@/lib/supabase/auth';

export const runtime = 'nodejs';

const EnvSchema = z.object({
  IMPORTS_BUCKET: z.string().default('imports'),
  IMPORTS_PREFIX: z.string().default('inventario')
});

export async function POST(req: NextRequest) {
  try {
    const { user } = await requireUser(req);
    const supabase = createServerSupabaseAdmin();
    const env = EnvSchema.parse({
      IMPORTS_BUCKET: process.env.IMPORTS_BUCKET ?? 'imports',
      IMPORTS_PREFIX: process.env.IMPORTS_PREFIX ?? 'inventario'
    });

    const form = await req.formData();
    const file = form.get('file');
    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: 'Arquivo não enviado (campo "file").' }, { status: 400 });
    }

    const filename = file.name || 'inventario.xlsx';
    const ts = new Date().toISOString().replace(/[:.]/g, '-');
    const storagePath = `${env.IMPORTS_PREFIX}/${user.id}/${ts}_${filename}`;

    // Create import run
    const { data: run, error: runErr } = await supabase
      .from('import_runs')
      .insert({ user_id: user.id })
      .select('id')
      .single();
    if (runErr) throw runErr;

    // Upload file to private bucket
    const arrayBuffer = await file.arrayBuffer();
    const { error: upErr } = await supabase.storage.from(env.IMPORTS_BUCKET).upload(storagePath, arrayBuffer, {
      contentType: file.type || 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      upsert: true
    });
    if (upErr) throw upErr;

    return NextResponse.json({
      import_run_id: run.id,
      storage_path: storagePath,
      filename
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message ?? String(e) }, { status: 401 });
  }
}
