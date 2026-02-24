export const dynamic = "force-dynamic";
'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { createBrowserSupabase } from '@/lib/supabase/client';

type Snapshot = {
  id: string;
  week_date: string;
  imported_at: string;
  status: string;
  total_products: number;
  total_qty_on_hand: number;
  total_qty_available: number;
  total_value_on_hand: number | null;
  value_coverage: number;
  zero_qty: number;
  negative_qty: number;
};

type Line = {
  product_id: string;
  name: string;
  sku_raw: string | null;
  unit_price: number | null;
  qty_on_hand: number;
  qty_available: number;
  value_on_hand: number | null;
};

export default function DashboardPage() {
  const supabase = useMemo(() => createBrowserSupabase(), []);
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [selectedId, setSelectedId] = useState<string>('');
  const [lines, setLines] = useState<Line[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function authHeader(): Promise<Record<string, string>> {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) throw new Error('Você precisa estar logado.');
    return { Authorization: `Bearer ${token}` };
  }

  useEffect(() => {
    (async () => {
      try {
        setError(null);
        const headers = await authHeader();
        const res = await fetch('/api/snapshots', { headers });
        if (!res.ok) throw new Error(await res.text());
        const data = await res.json();
        setSnapshots(data.snapshots);
        if (data.snapshots?.length) setSelectedId(data.snapshots[0].id);
      } catch (e: any) {
        setError(e.message ?? String(e));
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    (async () => {
      if (!selectedId) return;
      try {
        setLoading(true);
        setError(null);
        const headers = await authHeader();
        const res = await fetch(`/api/snapshots?id=${encodeURIComponent(selectedId)}`, { headers });
        if (!res.ok) throw new Error(await res.text());
        const data = await res.json();
        setLines(data.lines);
      } catch (e: any) {
        setError(e.message ?? String(e));
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  const selected = snapshots.find((s) => s.id === selectedId);

  const topByQty = [...lines].sort((a, b) => b.qty_on_hand - a.qty_on_hand).slice(0, 20);
  const bottomByQty = [...lines].sort((a, b) => a.qty_on_hand - b.qty_on_hand).slice(0, 20);

  return (
    <main>
      <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <h1 style={{ margin: 0 }}>Dashboard</h1>
        <nav style={{ display: 'flex', gap: 12 }}>
          <Link href="/importar">Importar semana</Link>
          <Link href="/comparar">Comparar</Link>
          <Link href="/produtos">Produtos</Link>
          <Link href="/login">Login</Link>
        </nav>
      </header>

      {error && <p style={{ color: 'crimson' }}>{error}</p>}

      <section style={{ marginTop: 16, display: 'flex', gap: 12, alignItems: 'center' }}>
        <label>
          Semana:
          <select value={selectedId} onChange={(e) => setSelectedId(e.target.value)} style={{ marginLeft: 8 }}>
            {snapshots.map((s) => (
              <option key={s.id} value={s.id}>
                {s.week_date}
              </option>
            ))}
          </select>
        </label>
      </section>

      {selected && (
        <section style={{ marginTop: 16, display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 12 }}>
          <Kpi title="Produtos" value={selected.total_products} />
          <Kpi title="Qtd. total (atual)" value={selected.total_qty_on_hand} />
          <Kpi title="Qtd. disponível" value={selected.total_qty_available} />
          <Kpi
            title="Valor total (parcial)"
            value={selected.total_value_on_hand === null ? '—' : selected.total_value_on_hand.toFixed(2)}
            subtitle={`Cobertura de preço: ${(selected.value_coverage * 100).toFixed(1)}%`}
          />
          <Kpi title="Zerados" value={selected.zero_qty} />
          <Kpi title="Negativos" value={selected.negative_qty} />
          <Kpi title="Status" value={selected.status} />
          <Kpi title="Importado em" value={new Date(selected.imported_at).toLocaleString('pt-BR')} />
        </section>
      )}

      <section style={{ marginTop: 18, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <div>
          <h2 style={{ marginTop: 0 }}>Top 20 por quantidade</h2>
          <Table lines={topByQty} />
        </div>
        <div>
          <h2 style={{ marginTop: 0 }}>Bottom 20 por quantidade</h2>
          <Table lines={bottomByQty} />
        </div>
      </section>

      {loading && <p>Carregando…</p>}
    </main>
  );
}

function Kpi({ title, value, subtitle }: { title: string; value: any; subtitle?: string }) {
  return (
    <div style={{ border: '1px solid #ddd', borderRadius: 10, padding: 12 }}>
      <div style={{ fontSize: 12, opacity: 0.75 }}>{title}</div>
      <div style={{ fontSize: 22, fontWeight: 650 }}>{String(value)}</div>
      {subtitle && <div style={{ fontSize: 12, opacity: 0.7 }}>{subtitle}</div>}
    </div>
  );
}

function Table({ lines }: { lines: Line[] }) {
  return (
    <div style={{ border: '1px solid #eee', borderRadius: 10, overflow: 'hidden' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ background: '#fafafa' }}>
            <th style={th}>SKU</th>
            <th style={th}>Produto</th>
            <th style={th}>Qtd</th>
            <th style={th}>Disp</th>
          </tr>
        </thead>
        <tbody>
          {lines.map((l) => (
            <tr key={l.product_id}>
              <td style={td}>{l.sku_raw ?? '—'}</td>
              <td style={td}>{l.name}</td>
              <td style={tdRight}>{l.qty_on_hand}</td>
              <td style={tdRight}>{l.qty_available}</td>
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
