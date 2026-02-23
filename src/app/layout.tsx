import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Estoque Semanal',
  description: 'Controle de estoque semanal por importação de inventário.'
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body style={{ fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, sans-serif', margin: 0 }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', padding: 16 }}>{children}</div>
      </body>
    </html>
  );
}
