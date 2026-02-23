'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { createBrowserSupabase } from '@/lib/supabase/client';

type HistoryRow = {
  week_date: string;
  qty_on_hand: number;
  qty_available: number;
  unit_price: number | null;
};

type Product = {
  id: string;
  sku: string | null;
  name: string;
  unit: string | null;
  location: string | null;
};

export default function ProdutoDetalhePage() {
  const supabase = useMemo(() => createBrowserSupabase(), []);
  const params = useParams<{ id: string }>();
  const id = params.id;

  const [product, setProduct] = useState<Product | null>(null);
  const [history, setHistory] = useState<HistoryRow[]>([]);
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
        setError(null);
        const headers = await authHeader();
        const res = await fetch(`/api/products?id=${encodeURIComponent(id)}`, { headers });
        if (!res.ok) throw new Error(await res.text());
        const data = await res.json();
        setProduct(data.product);

        const h = await fetch(`/api/products/${encodeURIComponent(id)}/history`, { headers });
        if (!h.ok) throw new Error(await h.text());
        const hd = await h.json();
        setHistory(hd.history);
      } catch (e: any) {
        setError(e.message ?? String(e));
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  return (
    <main>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
        <h1>Produto</h1>
        <nav style={{ display: 'flex', gap: 12 }}>
          <Link href="/produtos">Voltar</Link>
          <Link href="/dashboard">Dashboard</Link>
        </nav>
      </header>

      {error && <p style={{ color: 'crimson' }}>{error}</p>}

      {product && (
        <section style={{ border: '1px solid #eee', borderRadius: 12, padding: 12, marginTop: 12 }}>
          <div style={{ fontSize: 12, opacity: 0.7 }}>SKU</div>
          <div style={{ fontSize: 18, fontWeight: 650 }}>{product.sku ?? '—'}</div>
          <div style={{ fontSize: 12, opacity: 0.7, marginTop: 10 }}>Nome</div>
          <div style={{ fontSize: 18, fontWeight: 650 }}>{product.name}</div>
          <div style={{ display: 'flex', gap: 20, marginTop: 10, fontSize: 13, opacity: 0.9 }}>
            <div>Un: {product.unit ?? '—'}</div>
            <div>Local: {product.location ?? '—'}</div>
          </div>
        </section>
      )}

      <section style={{ marginTop: 16 }}>
        <h2>Histórico</h2>
        <div style={{ border: '1px solid #eee', borderRadius: 10, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#fafafa' }}>
                <th style={th}>Semana</th>
                <th style={th}>Qtd</th>
                <th style={th}>Disp</th>
                <th style={th}>Preço</th>
              </tr>
            </thead>
            <tbody>
              {history.map((r) => (
                <tr key={r.week_date}>
                  <td style={td}>{r.week_date}</td>
                  <td style={tdRight}>{r.qty_on_hand}</td>
                  <td style={tdRight}>{r.qty_available}</td>
                  <td style={tdRight}>{r.unit_price ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}

const th: React.CSSProperties = { textAlign: 'left', fontSize: 12, padding: '10px 10px', borderBottom: '1px solid #eee' };
const td: React.CSSProperties = { padding: '10px 10px', borderBottom: '1px solid #f1f1f1', fontSize: 13 };
const tdRight: React.CSSProperties = { ...td, textAlign: 'right', fontVariantNumeric: 'tabular-nums' };
