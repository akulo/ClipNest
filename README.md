# ClipNest

An AI-powered video discovery platform. Search for video content using natural language — ClipNest finds semantically relevant matches and presents them in a conversational chat interface.

## How It Works

```
┌─────────────────────────────────────────────────────────────────┐
│                        User (Browser)                           │
│                   /chat — Next.js Client                        │
└────────────────────────────┬────────────────────────────────────┘
                             │ POST /api/chat
                             │ { message, previousResponseId }
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Next.js API Route                            │
│                   /api/chat/route.ts                            │
│                                                                 │
│  1. Generate query embedding                                    │
│     OpenAI text-embedding-3-small → 1536-dim vector             │
│                        │                                        │
│  2. Semantic search                                             │
│     Supabase RPC: match_clipnest_embeddings                     │
│     Cosine similarity → top 4 matching videos                   │
│                        │                                        │
│  3. Build context                                               │
│     Format video metadata (title, creator, URL, etc.)           │
│                        │                                        │
│  4. Stream AI response                                          │
│     OpenAI gpt-4o — grounded to matched content only            │
│     previous_response_id for multi-turn continuity              │
└────────────────────────────┬────────────────────────────────────┘
                             │ Streamed text chunks
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                        Chat UI                                  │
│   Renders markdown response with clickable video links          │
│   Stores response ID for follow-up context                      │
└─────────────────────────────────────────────────────────────────┘
```

### Vector Search Detail

```
User query
    → OpenAI embedding (text-embedding-3-small)
    → 1536-dim vector
    → Supabase pgvector cosine similarity search
    → Top 4 videos ranked by semantic relevance
```

### Key Data Stored Per Video

| Field | Description |
|---|---|
| `title`, `creator`, `platform` | Video identity |
| `video_url` | Direct link |
| `summary`, `transcript_text` | Content for embedding |
| `venue`, `city`, `neighborhood` | Location metadata |
| `tags`, `categories`, `sentiment` | Content classification |
| `embedding` | 1536-dim vector (text-embedding-3-small) |

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 15, React 19, TailwindCSS 4 |
| Backend | Next.js API Routes (serverless) |
| AI | OpenAI gpt-4o (chat) + text-embedding-3-small (embeddings) |
| Database | Supabase (PostgreSQL + pgvector) |
| Language | TypeScript |

## Development

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) — redirects to `/chat`.
