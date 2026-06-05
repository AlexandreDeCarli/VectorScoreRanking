# VectorScoreRanking

VectorScoreRanking is a full-stack proof-of-concept application built with **React**, **Elysia.js (Bun)**, and **MySQL 9.0**. It demonstrates how to ingest text documents, generate vector embeddings using the Google Gemini API (`gemini-embedding-2`), store them in a native MySQL `VECTOR` column, and perform ranked semantic searches based on cosine similarity.

---

## Technical Architecture

The project runs in a **Single Docker Container** where Bun/Elysia serves both the backend JSON API and the statically compiled React assets, ensuring minimal RAM consumption and high request throughput.

```
+-------------------------------------------------------------+
|                     Docker Container (Bun)                  |
|                                                              |
|   +-----------------------+     +------------------------+   |
|   |    React Frontend     |     |   Elysia.js Backend    |   |
|   |  (Statically Served)  | --> |     (REST API & JWT)   |   |
|   +-----------------------+     +-----------+------------+   |
+---------------------------------------------|---------------+
                                              |
                     +------------------------+------------------------+
                     |                                                 |
                     v                                                 v
       +-------------+-------------+                     +-------------+-------------+
       |   Google Gemini API       |                     |     MySQL 9.0 Database    |
       |  (gemini-embedding-2)     |                     | (Local or Oracle HeatWave)|
       +---------------------------+                     +---------------------------+
```

1. **Frontend**: A sleek, dark-themed Single Page Application built using React, Vite, and TypeScript. It includes a secure login screen, document CRUD panels, a file dropzone (which parses client-side `.txt` and `.md` files), and a semantic ranked search bar.
2. **Backend**: An HTTP API server built with Elysia.js running natively on Bun. It handles JWT-based session security, generates embeddings using the Google Generative AI SDK, and queries MySQL.
3. **Database**: Stores documents and 768-dimension vectors in MySQL. Searches are computed using MySQL 9.0's native `VECTOR_DISTANCE` function with the `COSINE` metric.

---

## Project Structure

```
VectorScoreRanking/
├── .gitignore
├── .dockerignore
├── Dockerfile
├── docker-compose.yml       # Local orchestration (App + MySQL 9.0 db)
├── package.json             # Backend dependencies
├── tsconfig.json            # Backend TS configuration
├── database.sql             # SQL Schema migration file
├── README.md                # Documentation
├── src/
│   ├── index.ts             # Elysia API Entry Point
│   ├── db.ts                # MySQL Connection Pool (mysql2/promise)
│   ├── gemini.ts            # Gemini Embedding API integration
│   ├── auth.ts              # JWT Verification middleware
│   └── client/              # React SPA (Vite + TS)
│       ├── index.html
│       ├── vite.config.ts
│       ├── tsconfig.json
│       ├── package.json
│       └── src/
│           ├── main.tsx
│           ├── App.tsx
│           ├── styles.css   # Clean dark/glassmorphic CSS layout
│           ├── components/
│           │   ├── Login.tsx
│           │   ├── Dashboard.tsx
│           │   └── DocumentForm.tsx
│           └── utils/
│               └── api.ts   # Fetch client with token headers
```

---

## Database Schema

The system uses the following table structure inside the `meu_vector_db` schema:

```sql
CREATE TABLE IF NOT EXISTS vector_documentos (
    id INT AUTO_INCREMENT PRIMARY KEY,
    titulo VARCHAR(255) NOT NULL,
    conteudo TEXT NOT NULL,
    embedding VECTOR(768) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
```

Vector searches are calculated on the fly as follows:

```sql
SELECT id, titulo, conteudo, 
       (1 - VECTOR_DISTANCE(embedding, string_to_vector(?), 'COSINE')) AS similarity
FROM vector_documentos
ORDER BY similarity DESC
LIMIT 10;
```

---

## Environment Variables

Copy the template file `.env.example` to `.env` and fill in the values:

```env
PORT=3000
DB_HOST=127.0.0.1
DB_USER=app_user
DB_PASS=app_password
DB_NAME=meu_vector_db
GEMINI_API_KEY=your_gemini_api_key
GEMINI_MODEL=gemini-embedding-2
APP_USERNAME=admin
APP_PASSWORD=select_your_password
JWT_SECRET=generate_a_secure_jwt_secret
ADMIN_EMAIL=admin@example.com
MAX_UPLOAD_SIZE_MB=10
```

---

## Setup & Running Locally

### Option 1: Docker Compose (Recommended)
This runs the application alongside a local MySQL 9.0 database pre-loaded with the database schema.

1. Ensure Docker is installed and running.
2. In the project root, create a `.env` file containing your `GEMINI_API_KEY`.
3. Start the services:
   ```bash
   docker compose up --build
   ```
4. Access the web interface at: `http://localhost:3000`

### Option 2: Running on the Host
If you want to run the components directly on your system (requires Bun):

1. **Start the Backend:**
   Install dependencies and run the API:
   ```bash
   bun install
   bun run dev
   ```
2. **Start the Frontend:**
   In another terminal, build or start the React dev server:
   ```bash
   cd src/client
   bun install
   bun run dev
   ```
   The dev server will run on `http://localhost:5173` and proxy API calls to port 3000.

---

## Deployment (Production)

To deploy to production (e.g., Coolify):
1. Build the Docker image using the provided `Dockerfile`.
2. Map the environment variables (`DB_HOST`, `DB_USER`, `DB_PASS`, etc.) to point directly to your production MySQL instance (e.g. Oracle Cloud HeatWave MySQL).
3. Exposed port `3000` from the container will serve both the backend and frontend statically.
