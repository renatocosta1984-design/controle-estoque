# Estoque Semanal (MVP)

App web para importar o **Inventário** semanal (Excel) e acompanhar posição, ranking e comparação entre semanas.

## 1) Pré-requisitos
- Node.js 18+
- Conta no Supabase

## 2) Banco de dados (Supabase)
1. No Supabase, abra **SQL Editor** e rode o SQL que definimos (tabelas + RLS).
2. Crie um bucket **privado** no Storage chamado `imports`.

## 3) Variáveis de ambiente
Copie `.env.example` para `.env.local` e preencha:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (server-only)

## 4) Rodar local
```bash
npm i
npm run dev
```
Acesse: http://localhost:3000

## 5) Criar seu usuário
No Supabase: **Authentication → Users → Add user** (Email/Password).
Depois faça login em `/login`.

## 6) Importação
1. Vá em `/importar`
2. Escolha a data de referência da semana (ex.: segunda-feira)
3. Faça upload do Excel (Inventário)

## Observações
- Se já existir snapshot para a mesma `week_date`, a importação retorna 409.
- O valor total do estoque é **parcial** quando a planilha tem muitos preços 0.

## Deploy
Recomendado: Vercel.
- Configure as mesmas variáveis do `.env.local` no projeto Vercel.
- Garanta que `SUPABASE_SERVICE_ROLE_KEY` esteja apenas no ambiente server.
