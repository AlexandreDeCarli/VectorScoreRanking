# VectorScoreRanking

<div align="center">

**Busca Semântica por Vetores com Ranking de Similaridade Cosseno**

[![Bun](https://img.shields.io/badge/runtime-Bun_1.1-f9f1e1?logo=bun)](https://bun.sh)
[![Elysia](https://img.shields.io/badge/backend-Elysia.js-7c5cff)](https://elysiajs.com)
[![React](https://img.shields.io/badge/frontend-React_18-61dafb?logo=react)](https://react.dev)
[![MariaDB](https://img.shields.io/badge/dev_db-MariaDB_11.8-003545?logo=mariadb)](https://mariadb.org)
[![MySQL](https://img.shields.io/badge/prod_db-MySQL_HeatWave-4479A1?logo=mysql)](https://www.oracle.com/mysql/heatwave/)
[![License](https://img.shields.io/badge/license-MIT-green)](LICENSE)

</div>

---

## O que é?

VectorScoreRanking é uma aplicação full-stack que demonstra como construir um sistema de **busca semântica** (Retrieval-Augmented Generation ready) usando embeddings vetoriais. Ao invés de buscar por palavras-chave exatas, o sistema entende o **significado** do texto e retorna documentos ranqueados por proximidade conceitual.

### Exemplo prático

Você cadastra 3 documentos:
- 📄 *"Receita de Bolo de Chocolate"*
- 📄 *"Guia de Veículos Elétricos"*
- 📄 *"Tutorial de Machine Learning"*

Ao pesquisar por **"como programar inteligência artificial"**, o sistema retorna:
1. 🥇 Tutorial de Machine Learning — **87.3%** de similaridade
2. 🥈 Guia de Veículos Elétricos — **42.1%** de similaridade
3. 🥉 Receita de Bolo de Chocolate — **15.8%** de similaridade

Sem nenhuma das palavras "programar" ou "inteligência artificial" existirem nos documentos.

---

## Arquitetura

```
┌─────────────────────────────────────────────────────────┐
│                  Docker Container (Bun)                 │
│                                                         │
│   ┌──────────────────┐     ┌────────────────────────┐   │
│   │  React Frontend  │     │   Elysia.js Backend    │   │
│   │  (SPA estática)  │ ──▶ │   REST API + JWT Auth  │   │
│   └──────────────────┘     └───────────┬────────────┘   │
│                                        │                │
│   ┌────────────────────────────────────┘                │
│   │  src/sql-dialect.ts                                 │
│   │  (Abstração MariaDB ↔ HeatWave)                    │
│   │                                                     │
│   │  src/migrate.ts                                     │
│   │  (Migrations automáticas no startup)                │
└───┼─────────────────────────────────────────────────────┘
    │
    ├──────────────────────────┐
    ▼                          ▼
┌────────────────────┐  ┌─────────────────────────────┐
│ Google Gemini API  │  │     Banco de Dados          │
│ gemini-embedding-2 │  │                             │
│ 768 dimensões      │  │  DEV:  MariaDB 11.8 (HNSW) │
└────────────────────┘  │  PROD: MySQL HeatWave (OCI) │
                        └─────────────────────────────┘
```

### Stack Tecnológico

| Camada | Tecnologia | Função |
|--------|-----------|--------|
| **Runtime** | [Bun 1.1](https://bun.sh) | Runtime JavaScript ultra-rápido, substitui Node.js |
| **Backend** | [Elysia.js](https://elysiajs.com) | Framework HTTP com tipagem end-to-end e JWT nativo |
| **Frontend** | [React 18](https://react.dev) + [Vite](https://vite.dev) | SPA com tema escuro glassmórfico |
| **Embeddings** | [Google Gemini API](https://ai.google.dev) | Modelo `gemini-embedding-2` com 768 dimensões |
| **DB Local** | [MariaDB 11.8](https://mariadb.org) | Vetores nativos + HNSW (Cosseno, Produto Escalar, Euclidiana) |
| **DB Produção** | [MySQL HeatWave](https://www.oracle.com/mysql/heatwave/) | Vetores nativos na Oracle Cloud (COSINE, DOT, EUCLIDEAN) |
| **Autenticação** | JWT (HS256) | Sessão stateless via `@elysiajs/jwt` |
| **Testes** | Bun Test + Vitest + React Testing Library | 32 testes automatizados |

---

## Funcionalidades

### 🔐 Autenticação
- Login com credenciais configuráveis via variáveis de ambiente
- JWT com assinatura HS256, armazenado no `sessionStorage`
- Todas as rotas `/api/*` protegidas por Bearer Token

### 📄 CRUD de Documentos
- Criar, editar, visualizar e excluir documentos de texto
- Upload de arquivos `.txt` e `.md` com parsing client-side
- Embedding gerado automaticamente via Gemini a cada criação/edição
- Re-geração inteligente: só recalcula o embedding se o conteúdo mudar

### 🔍 Busca Semântica Vetorial
- Converte a query de busca em vetor de 768 dimensões
- Suporta 3 métricas de distância: **Cosseno (`COSINE`)**, **Produto Escalar (`DOT`)** e **Euclidiana (`EUCLIDEAN`)**
- Tradução dinâmica das funções vetoriais de acordo com o dialeto de banco de dados ativo (MariaDB vs MySQL HeatWave)
- Retorna o ranking ordenado de forma correta (`DESC` para Cosseno/Dot, e `ASC` para Euclidiana - menor distância é melhor)
- Score visual dinâmico com badge de pontuação customizado por métrica e destaque de relevância inteligente

### 🗄️ Compatibilidade Multi-Banco
- **Desenvolvimento**: MariaDB 11.8 com `VEC_FromText()`, `VEC_DISTANCE_COSINE()`, índice HNSW
- **Produção**: MySQL HeatWave com `STRING_TO_VECTOR()`, `DISTANCE(..., 'COSINE')`
- Controlado por uma única variável: `DB_DIALECT=mariadb` ou `DB_DIALECT=heatwave`

### 🔄 Migrations Automáticas
- Executam automaticamente a cada startup do container
- Tabela `_migrations` rastreia quais já foram aplicadas
- Suporte a migrations universais (`.sql`) e específicas por dialeto (`.mariadb.sql`, `.heatwave.sql`)
- Idempotentes: nunca re-aplicam uma migration já executada

### ✅ Suite de Testes
- **16 testes backend** (Bun Test): DB, Gemini, Auth JWT, API REST completa (incluindo as três métricas vetoriais)
- **16 testes frontend** (Vitest + Happy DOM + React Testing Library): Login, DocumentForm, Dashboard (incluindo sidebar colapsável, visualizações compacta/detalhada e seletor de métricas)
- Comando único: `bun run test:all`

---

## Estrutura do Projeto

```
VectorScoreRanking/
├── .gitignore
├── .dockerignore
├── .env.example              # Template de variáveis de ambiente
├── Dockerfile                # Build multi-stage (Bun)
├── docker-compose.yml        # Orquestração local (App + MariaDB 11.8)
├── database.sql              # Schema inicial com VECTOR INDEX HNSW
├── package.json              # Dependências backend + scripts
├── tsconfig.json             # Config TypeScript backend
├── LICENSE                   # MIT
│
├── src/
│   ├── index.ts              # Entry point: Elysia API + static serving
│   ├── db.ts                 # Pool de conexão mysql2/promise
│   ├── gemini.ts             # Client Google Gemini Embedding (768 dims)
│   ├── auth.ts               # Plugin JWT com derive global
│   ├── sql-dialect.ts        # Abstração MariaDB ↔ HeatWave
│   ├── migrate.ts            # Runner de migrations automáticas
│   ├── test_search.ts        # Script de teste integrado de busca
│   │
│   ├── migrations/
│   │   └── 001_conteudo_mediumtext.sql   # TEXT → MEDIUMTEXT
│   │
│   ├── tests/
│   │   ├── db.test.ts        # Conexão + validação de dialeto
│   │   ├── gemini.test.ts    # Embedding 768 dims + error handling
│   │   ├── auth.test.ts      # JWT sign/verify/missing header
│   │   └── api.test.ts       # CRUD + search + auth gates
│   │
│   └── client/               # React SPA
│       ├── index.html
│       ├── vite.config.ts    # Vite + Vitest config
│       ├── tsconfig.json     # TS config (exclui tests do build)
│       ├── package.json
│       └── src/
│           ├── main.tsx
│           ├── App.tsx       # Router: Login ↔ Dashboard
│           ├── styles.css    # Tema escuro glassmórfico
│           ├── components/
│           │   ├── Login.tsx
│           │   ├── Dashboard.tsx
│           │   └── DocumentForm.tsx
│           ├── utils/
│           │   └── api.ts    # Fetch client com token headers
│           └── tests/
│               ├── setup.ts
│               ├── Login.test.tsx
│               ├── DocumentForm.test.tsx
│               └── Dashboard.test.tsx
```

---

## Schema do Banco de Dados

```sql
CREATE TABLE IF NOT EXISTS vector_documentos (
    id INT AUTO_INCREMENT PRIMARY KEY,
    titulo VARCHAR(255) NOT NULL,
    conteudo MEDIUMTEXT NOT NULL,
    embedding VECTOR(768) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    VECTOR INDEX idx_embedding (embedding) M=8 DISTANCE=cosine
);
```

### Queries de Busca Vetorial

As queries de busca por semelhança são adaptadas dinamicamente de acordo com o dialeto de banco de dados ativo e a métrica selecionada através do helper `getVectorSearchSQL(metric)`:

#### MariaDB (dev)
- **Cosseno (`COSINE`)**:
  ```sql
  SELECT id, titulo, conteudo, (1 - VEC_DISTANCE_COSINE(embedding, VEC_FromText(?))) AS similarity
  FROM vector_documentos ORDER BY similarity DESC LIMIT 10;
  ```
- **Produto Escalar (`DOT`)**:
  ```sql
  SELECT id, titulo, conteudo, VEC_DISTANCE(embedding, VEC_FromText(?)) AS similarity
  FROM vector_documentos ORDER BY similarity DESC LIMIT 10;
  ```
- **Euclidiana (`EUCLIDEAN`)**:
  ```sql
  SELECT id, titulo, conteudo, VEC_DISTANCE_EUCLIDEAN(embedding, VEC_FromText(?)) AS similarity
  FROM vector_documentos ORDER BY similarity ASC LIMIT 10; -- Ordenamento ASC (menor distância é melhor)
  ```

#### MySQL HeatWave (prod)
- **Cosseno (`COSINE`)**:
  ```sql
  SELECT id, titulo, conteudo, (1 - DISTANCE(embedding, STRING_TO_VECTOR(?), 'COSINE')) AS similarity
  FROM vector_documentos ORDER BY similarity DESC LIMIT 10;
  ```
- **Produto Escalar (`DOT`)**:
  ```sql
  SELECT id, titulo, conteudo, DISTANCE(embedding, STRING_TO_VECTOR(?), 'DOT') AS similarity
  FROM vector_documentos ORDER BY similarity DESC LIMIT 10;
  ```
- **Euclidiana (`EUCLIDEAN`)**:
  ```sql
  SELECT id, titulo, conteudo, DISTANCE(embedding, STRING_TO_VECTOR(?), 'EUCLIDEAN') AS similarity
  FROM vector_documentos ORDER BY similarity ASC LIMIT 10; -- Ordenamento ASC (menor distância é melhor)
  ```

---

## Variáveis de Ambiente

Copie `.env.example` para `.env` e preencha:

```env
PORT=3000
DB_HOST=127.0.0.1
DB_USER=app_user
DB_PASS=app_password
DB_NAME=meu_vector_db
DB_DIALECT=mariadb              # 'mariadb' (dev) ou 'heatwave' (prod)
GEMINI_API_KEY=sua_chave_api
GEMINI_MODEL=gemini-embedding-2
APP_USERNAME=admin
APP_PASSWORD=sua_senha_app
JWT_SECRET=gere_um_segredo_seguro
ADMIN_EMAIL=admin@example.com
MAX_UPLOAD_SIZE_MB=10
```

### Referência Rápida de Dialetos

| Variável | Valor | Banco | Uso |
|----------|-------|-------|-----|
| `DB_DIALECT` | `mariadb` | MariaDB 11.7+ | Desenvolvimento local |
| `DB_DIALECT` | `heatwave` | MySQL HeatWave | Produção (OCI) |

---

## Setup & Execução Local

### Opção 1: Docker Compose (Recomendado)

Sobe a aplicação + MariaDB 11.8 com schema e índice vetorial HNSW pré-configurados:

```bash
# 1. Clone o repositório
git clone git@github.com:AlexandreDeCarli/VectorScoreRanking.git
cd VectorScoreRanking

# 2. Configure o .env com sua GEMINI_API_KEY
cp .env.example .env
# edite o .env

# 3. Suba os containers
docker compose up --build

# 4. Acesse
open http://localhost:3000
```

Na inicialização, o sistema automaticamente:
1. Cria o banco `meu_vector_db` com tabela e índice vetorial
2. Executa todas as migrations pendentes
3. Inicia o servidor Elysia na porta 3000

### Opção 2: Execução no Host (requer Bun)

```bash
# Backend
bun install
bun run dev

# Frontend (outro terminal)
cd src/client
bun install
bun run dev    # Dev server na porta 5173, proxy para 3000
```

---

## Testes

```bash
# Todos os testes (backend + frontend)
bun run test:all

# Apenas backend (16 testes)
bun run test

# Apenas frontend (16 testes)
cd src/client && bun run test

# Teste integrado de busca vetorial (requer GEMINI_API_KEY e DB rodando)
bun run test:search
```

---

## Migrations

As migrations vivem em `src/migrations/` e executam automaticamente no startup.

### Criar uma nova migration

```bash
# Migration universal (roda em ambos os bancos)
touch src/migrations/002_add_column_example.sql

# Migration específica para MariaDB
touch src/migrations/003_vector_index.mariadb.sql

# Migration específica para HeatWave
touch src/migrations/003_vector_index.heatwave.sql
```

### Convenções

- Prefixo numérico para ordenação: `001_`, `002_`, `003_`...
- Sufixo `.mariadb.sql` → roda **apenas** quando `DB_DIALECT=mariadb`
- Sufixo `.heatwave.sql` → roda **apenas** quando `DB_DIALECT=heatwave`
- Sem sufixo (`.sql`) → roda em **ambos** os dialetos
- Variantes de dialeto compartilham o mesmo nome canônico na tabela `_migrations`

---

## Deploy em Produção (Coolify / OCI)

A aplicação é totalmente preparada para rodar em produção no **Coolify**, aproveitando o `Dockerfile` multi-stage (que gera a SPA estática e serve o backend na mesma porta `3000`) e o executor de migrations automáticas.

Você pode implantar este projeto usando um dos três cenários abaixo:

### Cenário A: Apenas o App (Apontando para MySQL HeatWave de produção externo)
*Ideal se o seu banco HeatWave já está hospedado e você só quer subir o app.*

1. No Coolify, vá em **+ New Resource** > **Application** > **GitHub Repository**.
2. Escolha o repositório `VectorScoreRanking` e a branch `main`.
3. Defina o **Build Pack** como **Dockerfile** (o Coolify detectará automaticamente o arquivo na raiz).
4. Configure as variáveis de ambiente na aba **Environment Variables** (veja tabela abaixo).
5. Defina o domínio público com SSL automático (ex: `https://busca.potencial.tec.br`).
6. Clique em **Deploy**. O script `migrate.ts` rodará automaticamente no startup contra o HeatWave remoto.

### Cenário B: App + Banco local via Docker Compose (Staging / Homologação)
*Ideal para rodar um MariaDB 11.8 integrado na mesma pilha no Coolify.*

1. No Coolify, vá em **+ New Resource** > **Docker Compose**.
2. Selecione o repositório ou cole o conteúdo do `docker-compose.yml`.
3. Configure os domínios para mapear a porta `3000` do serviço `app` e as variáveis do banco.
4. Clique em **Deploy**.

### Cenário C: MariaDB do Coolify + App separado (Melhor organização)
*Crie um recurso de banco de dados gerenciado nativo do Coolify e conecte seu App nele.*

1. Vá em **+ New Resource** > **Database** > **MariaDB** (versão 11.8+). Anote as credenciais geradas.
2. Crie a aplicação conforme o **Cenário A** e passe as credenciais do banco gerenciado nas variáveis de ambiente, definindo `DB_DIALECT=mariadb`.

---

### Tabela de Variáveis de Ambiente

| Variável | Exemplo / Valor | Descrição |
|----------|-----------------|-----------|
| `PORT` | `3000` | Porta em que o servidor Elysia vai rodar. |
| `DB_DIALECT` | `heatwave` ou `mariadb` | Controla o dialeto SQL e as funções de vetor utilizadas. |
| `DB_HOST` | `10.0.0.159` | IP ou Host do banco de dados (pode ser o host do Heatwave na OCI). |
| `DB_USER` | `meu_usuario` | Usuário do banco de dados. |
| `DB_PASS` | `minha_senha` | Senha de acesso ao banco. |
| `DB_NAME` | `meu_vector_db` | Nome do banco de dados. |
| `GEMINI_API_KEY` | `AIzaSy...` | Sua API Key do Google Gemini para embeddings. |
| `APP_USERNAME` | `admin` | Usuário de autenticação do painel. |
| `APP_PASSWORD` | `senha_segura` | Senha de autenticação do painel. |
| `JWT_SECRET` | `chave_aleatoria` | Hash aleatório para assinar os tokens JWT de sessão. |
| `MAX_UPLOAD_SIZE_MB` | `10` | (Opcional) Limite máximo do tamanho de arquivo importado. |

---

## API Endpoints

Todas as rotas (exceto login) requerem header `Authorization: Bearer <token>`.

| Método | Rota | Descrição |
|--------|------|-----------|
| `POST` | `/api/auth/login` | Autenticação (retorna JWT) |
| `GET` | `/api/documents` | Listar documentos (metadados) |
| `GET` | `/api/documents/:id` | Detalhe de um documento |
| `POST` | `/api/documents` | Criar documento (gera embedding) |
| `PUT` | `/api/documents/:id` | Atualizar documento (re-gera embedding se conteúdo mudar) |
| `DELETE` | `/api/documents/:id` | Excluir documento |
| `POST` | `/api/search` | Busca semântica vetorial (top 10 por similaridade) |

### Exemplos com cURL

```bash
# Login
TOKEN=$(curl -s http://localhost:3000/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"username":"admin","password":"sua_senha"}' | jq -r '.token')

# Criar documento
curl -s http://localhost:3000/api/documents \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"titulo":"Meu Documento","conteudo":"Texto do documento aqui..."}'

# Busca semântica (Cosseno - padrão)
curl -s http://localhost:3000/api/search \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"query":"inteligência artificial", "metric":"COSINE"}'

# Busca semântica (Euclidiana)
curl -s http://localhost:3000/api/search \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"query":"veículos elétricos", "metric":"EUCLIDEAN"}'
```

---

## Referências

- [MariaDB Vector Documentation](https://mariadb.com/docs/server/reference/sql-structure/vectors/)
- [MariaDB VEC_DISTANCE_COSINE](https://mariadb.com/docs/server/reference/sql-functions/vector-functions/vec_distance_cosine)
- [Google Gemini Embedding API](https://ai.google.dev/gemini-api/docs/embeddings)
- [Elysia.js Documentation](https://elysiajs.com)
- [Bun Runtime](https://bun.sh/docs)

---

## Licença

[MIT](LICENSE) © Alexandre De Carli
