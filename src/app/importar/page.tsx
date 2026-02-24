'use client';
export const dynamic = "force-dynamic";


import { useMemo, useState } from 'react';
import Link from 'next/link';
import { createBrowserSupabase } from '@/lib/supabase/client';

type StartResp = {
  import_run_id: string;
  storage_path: string;
  filename: string;
};

type CommitResp = {
  snapshot_id: string;
  stats: any;
  warnings: any[];
  errors: any[];
};

export default function ImportarPage() {
  const supabase = useMemo(() => createBrowserSupabase(), []);

  const [weekDate, setWeekDate] = useState<string>('');
  const [file, setFile] = useState<File | null>(null);
  const [step, setStep] = useState<'idle' | 'uploading' | 'committing' | 'done'>('idle');
  const [result, setResult] = useState<CommitResp | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function authHeader() {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) throw new Error('Você precisa estar logado.');
    return { Authorization: `Bearer ${token}` };
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setResult(null);

    if (!file) {
      setError('Selecione um arquivo Excel.');
      return;
    }
    if (!weekDate) {
      setError('Informe a data de referência da semana.');
      return;
    }

    try {
      setStep('uploading');
      const headers = await authHeader();

      const fd = new FormData();
      fd.append('file', file);

      const startRes = await fetch('/api/import/start', {
        method: 'POST',
        headers,
        body: fd
      });

      if (!startRes.ok) throw new Error(await startRes.text());
      const start: StartResp = await startRes.json();

      setStep('committing');
      const commitRes = await fetch('/api/import/commit', {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          import_run_id: start.import_run_id,
          week_date: weekDate,
          storage_path: start.storage_path
        })
      });

      if (!commitRes.ok) throw new Error(await commitRes.text());
      const commit: CommitResp = await commitRes.json();
      setResult(commit);
      setStep('done');
    } catch (e: any) {
      setError(e.message ?? String(e));
      setStep('idle');
    }
  }

  return (
    <main style={{ maxWidth: 720 }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
        <h1>Importar Semana</h1>
        <nav style={{ display: 'flex', gap: 12 }}>
          <Link href="/dashboard">Dashboard</Link>
          <Link href="/comparar">Comparar</Link>
          <Link href="/produtos">Produtos</Link>
        </nav>
      </header>

      <form onSubmit={onSubmit} style={{ display: 'grid', gap: 12, padding: 12, border: '1px solid #eee', borderRadius: 12 }}>
        <label>
          Data de referência (week_date)
          <input
            type="date"
            value={weekDate}
            onChange={(e) => setWeekDate(e.target.value)}
            style={{ display: 'block', marginTop: 6 }}
            required
          />
        </label>

        <label>
          Arquivo Excel (Inventário)
          <input type="file" accept=".xlsx,.xls" onChange={(e) => setFile(e.target.files?.[0] ?? null)} style={{ display: 'block', marginTop: 6 }} />
        </label>

        <button type="submit" disabled={step !== 'idle'}>
          {step === 'idle' && 'Importar'}
          {step === 'uploading' && 'Enviando…'}
          {step === 'committing' && 'Processando…'}
          {step === 'done' && 'Concluído'}
        </button>

        {error && <p style={{ color: 'crimson' }}>{error}</p>}
      </form>

      {result && (
        <section style={{ marginTop: 16 }}>
          <h2>Resultado</h2>
          <p>
            Snapshot: <code>{result.snapshot_id}</code>
          </p>

          <div style={{ display: 'grid', gap: 10 }}>
            <Card title="Stats" json={result.stats} />
            <Card title={`Warnings (${result.warnings.length})`} json={result.warnings} />
            <Card title={`Errors (${result.errors.length})`} json={result.errors} />
          </div>
        </section>
      )}

      <p style={{ marginTop: 16, fontSize: 13, opacity: 0.8 }}>
        Sugestão: use a <b>segunda-feira</b> como data de referência da semana para padronizar.
      </p>
    </main>
  );
}

function Card({ title, json }: { title: string; json: any }) {
  return (
    <div style={{ border: '1px solid #eee', borderRadius: 12, padding: 12 }}>
      <div style={{ fontWeight: 650, marginBottom: 8 }}>{title}</div>
      <pre style={{ margin: 0, whiteSpace: 'pre-wrap', fontSize: 12 }}>{JSON.stringify(json, null, 2)}</pre>
    </div>
  );
}
