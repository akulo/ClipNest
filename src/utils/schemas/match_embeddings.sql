-- Run this in your Supabase SQL editor (replaces previous version)
create or replace function match_clipnest_embeddings(
  query_embedding vector(1536),
  match_count int default 5
)
returns table (
  id uuid,
  title text,
  summary text,
  transcript_preview text,
  creator text,
  platform text,
  video_url text,
  venue text,
  address text,
  city text,
  similarity float
)
language sql stable
as $$
  select
    id,
    title,
    summary,
    transcript_preview,
    creator,
    platform,
    video_url,
    venue,
    address,
    city,
    1 - (embedding <=> query_embedding) as similarity
  from clipnest_embeddings
  where embedding is not null
  order by embedding <=> query_embedding
  limit match_count;
$$;
