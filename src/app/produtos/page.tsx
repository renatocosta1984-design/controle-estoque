export const dynamic = "force-dynamic";
'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { createBrowserSupabase } from '@/lib/supabase/client';

type Product = { id: string; sku: string | null; name: string; unit: string | null; location: string | null };

export default function ProdutosPage() {
  const supabase = useMemo(() => createBrowserSupabase(), []);
  const [search, setSearch] = useState('');
  const [items, setItems] = useState<Product[]>([]);
  const [error, setError] = useState<string | null>(null);

  async function authHeader() {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) throw new Error('Você precisa estar logado.');
    return { Authorization: `Bearer ${token}` };
  }

  async function runSearch() {
    try {
      setError(null);
      const headers = await authHeader();
      const res = await fetch(`/api/products?search=${encodeURIComponent(search)}`, { headers });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setItems(data.products);
    } catch (e: any) {
      setError(e.message ?? String(e));
    }
  }

  return (
    <main>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
        <h1>Produtos</h1>
        <nav style={{ display: 'flex', gap: 12 }}>
          <Link href="/dashboard">Dashboard</Link>
          <Link href="/importar">Importar</Link>
          <Link href="/comparar">Comparar</Link>
        </nav>
      </header>

      {error && <p style={{ color: 'crimson' }}>{error}</p>}

      <section style={{ display: 'flex', gap: 10, marginTop: 12 }}>
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por nome ou SKU" style={{ flex: 1 }} />
        <button onClick={runSearch}>Buscar</button>
      </section>

      <section style={{ marginTop: 12 }}>
        <div style={{ border: '1px solid #eee', borderRadius: 10, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#fafafa' }}>
                <th style={th}>SKU</th>
                <th style={th}>Produto</th>
                <th style={th}>Un</th>
                <th style={th}>Local</th>
              </tr>
            </thead>
            <tbody>
              {items.map((p) => (
                <tr key={p.id}>
                  <td style={td}>{p.sku ?? '—'}</td>
                  <td style={td}>
                    <Link href={`/produtos/${p.id}`}>{p.name}</Link>
                  </td>
                  <td style={td}>{p.unit ?? '—'}</td>
                  <td style={td}>{p.location ?? '—'}</td>
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
