'use client';


import { useState } from 'react';
import { createBrowserSupabase } from '@/lib/supabase/client';

export default function LoginPage() {
  const supabase = createBrowserSupabase();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [msg, setMsg] = useState<string | null>(null);

  async function onLogin(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) setMsg(error.message);
    else window.location.href = '/dashboard';
  }

  async function onLogout() {
    await supabase.auth.signOut();
    window.location.href = '/login';
  }

  return (
    <main style={{ maxWidth: 420 }}>
      <h1>Login</h1>
      <form onSubmit={onLogin} style={{ display: 'grid', gap: 10 }}>
        <label>
          Email
          <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" required style={{ width: '100%' }} />
        </label>
        <label>
          Senha
          <input value={password} onChange={(e) => setPassword(e.target.value)} type="password" required style={{ width: '100%' }} />
        </label>
        <button type="submit">Entrar</button>
      </form>
      <button onClick={onLogout} style={{ marginTop: 12 }}>
        Sair
      </button>
      {msg && <p style={{ color: 'crimson' }}>{msg}</p>}

      <p style={{ marginTop: 16, fontSize: 13, opacity: 0.8 }}>
        Dica: crie seu usuário no Supabase Auth (Email/Password) e faça login aqui.
      </p>
    </main>
  );
}
