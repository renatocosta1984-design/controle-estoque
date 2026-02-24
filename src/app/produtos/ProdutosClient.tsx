'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { createBrowserSupabase } from '@/lib/supabase/client';

type Product = { id: string; sku: string | null; name: string; unit: string | null; location: string | null };

export default function ProdutosClient() {
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

  // ... resto do seu código igual
}
