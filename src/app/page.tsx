import Link from 'next/link';

export default function HomePage() {
  return (
    <main>
      <h1>Estoque Semanal</h1>
      <p>Importe sua planilha de inventário semanal e acompanhe evolução, ranking e alertas.</p>
      <div style={{ display: 'flex', gap: 12 }}>
        <Link href="/login">Login</Link>
        <Link href="/dashboard">Dashboard</Link>
      </div>
    </main>
  );
}
