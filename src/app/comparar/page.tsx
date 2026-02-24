export const dynamic = "force-dynamic";
'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { createBrowserSupabase } from '@/lib/supabase/client';

type Snapshot = { id: string; week_date: string };

type Row = {
  product_id: string;
  sku: string | null;
  name: string;
  qtyA: number;
  qtyB: number;
  delta: number;
};

export default function CompararPage() {
  const supabase = useMemo(() => createBrowserSupabase(), []);
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [weekA, setWeekA] = useState<string>('');
  const [weekB, setWeekB] = useState<string>('');
  const [rows, setRows] = useState<Row[]>([]);
  const [error, setError] = useState<string | null>(null);

  async function authHeader() {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) throw new Error('Você precisa estar logado.');
    return { Authorization: `Bearer ${token}` };
  }

  useEffect(() => {
    (async () => {
      try {
        const headers = await authHeader();
        const res = await fetch('/api/snapshots', { headers });
        if (!res.ok) throw new Error(await res.text());
        const data = await res.json();
        const snaps: Snapshot[] = data.snapshots.map((s: any) => ({ id: s.id, week_date: s.week_date }));
        setSnapshots(snaps);
        if (snaps.length >= 2) {
          setWeekA(snaps[0].week_date);
          setWeekB(snaps[1].week_date);
        }
      } catch (e: any) {
        setError(e.message ?? String(e));
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function runCompare() {
    try {
      setError(null);
      const headers = await authHeader();
      const res = await fetch(`/api/compare?weekA=${encodeURIComponent(weekA)}&weekB=${encodeURIComponent(weekB)}`, { headers });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setRows(data.rows);
    } catch (e: any) {
      setError(e.message ?? String(e));
    }
  }

  const topDown = [...rows].sort((a, b) => a.delta - b.delta).slice(0, 30);
  const topUp = [...rows].sort((a, b) => b.delta - a.delta).slice(0, 30);

  return (
    <main>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
        <h1>Comparar Semanas</h1>
        <nav style={{ display: 'flex', gap: 12 }}>
          <Link href="/dashboard">Dashboard</Link>
          <Link href="/importar">Importar</Link>
          <Link href="/produtos">Produtos</Link>
        </nav>
      </header>

      {error && <p style={{ color: 'crimson' }}>{error}</p>}

      <section style={{ display: 'flex', gap: 12, alignItems: 'center', marginTop: 12, flexWrap: 'wrap' }}>
        <label>
          Semana A
          <select value={weekA} onChange={(e) => setWeekA(e.target.value)} style={{ marginLeft: 8 }}>
            {snapshots.map((s) => (
              <option key={s.week_date} value={s.week_date}>
                {s.week_date}
              </option>
            ))}
          </select>
        </label>

        <label>
          Semana B
          <select value={weekB} onChange={(e) => setWeekB(e.target.value)} style={{ marginLeft: 8 }}>
            {snapshots.map((s) => (
              <option key={s.week_date} value={s.week_date}>
                {s.week_date}
              </option>
            ))}
          </select>
        </label>

        <button onClick={runCompare}>Comparar</button>
      </section>

      {rows.length > 0 && (
        <section style={{ marginTop: 16, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div>
            <h2 style={{ marginTop: 0 }}>Top quedas (Δ menor)</h2>
            <CompareTable rows={topDown} />
          </div>
          <div>
            <h2 style={{ marginTop: 0 }}>Top aumentos (Δ maior)</h2>
            <CompareTable rows={topUp} />
          </div>
        </section>
      )}
    </main>
  );
}

function CompareTable({ rows }: { rows: Row[] }) {
  return (
    <div style={{ border: '1px solid #eee', borderRadius: 10, overflow: 'hidden' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ background: '#fafafa' }}>
            <th style={th}>SKU</th>
            <th style={th}>Produto</th>
            <th style={th}>A</th>
            <th style={th}>B</th>
            <th style={th}>Δ</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.product_id}>
              <td style={td}>{r.sku ?? '—'}</td>
              <td style={td}>{r.name}</td>
              <td style={tdRight}>{r.qtyA}</td>
              <td style={tdRight}>{r.qtyB}</td>
              <td style={tdRight}>{r.delta}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const th: React.CSSProperties = { textAlign: 'left', fontSize: 12, padding: '10px 10px', borderBottom: '1px solid #eee' };
const td: React.CSSProperties = { padding: '10px 10px', borderBottom: '1px solid #f1f1f1', fontSize: 13 };
const tdRight: React.CSSProperties = { ...td, textAlign: 'right', fontVariantNumeric: 'tabular-nums' };
