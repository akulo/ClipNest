import OpenAI from "openai";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const OPENAI_KEY = process.env.OPENAI_API_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY || !OPENAI_KEY) {
  console.error("Missing env vars — make sure SUPABASE_SERVICE_ROLE_KEY is set in .env.local");
  process.exit(1);
}

const openai = new OpenAI({ apiKey: OPENAI_KEY });
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const query = process.argv[2] ?? "cooking tutorial";

console.log("\n=== ClipNest Embedding Debug ===\n");
console.log("Query:", query);

// 1. Check how many rows have embeddings
console.log("\n--- DB Health Check ---");
const { data: stats, error: statsError } = await supabase
  .from("clipnest_embeddings")
  .select("id, title, embedding")
  .limit(5);

if (statsError) {
  console.error("DB error:", statsError);
  process.exit(1);
}

console.log(`Sample rows (up to 5):`);
stats.forEach((row) => {
  console.log(`  - "${row.title}" | has_embedding: ${row.embedding !== null}`);
});

// 2. Count rows with embeddings
const { count } = await supabase
  .from("clipnest_embeddings")
  .select("*", { count: "exact", head: true })
  .not("embedding", "is", null);
console.log(`\nTotal rows with embedding: ${count}`);

// 3. Generate embedding
console.log("\n--- Generating Embedding ---");
const embeddingRes = await openai.embeddings.create({
  model: "text-embedding-3-small",
  input: query,
});
const embedding = embeddingRes.data[0].embedding;
console.log("Dimensions:", embedding.length);
console.log("First 5 values:", embedding.slice(0, 5));

// 4. Run the RPC
console.log("\n--- Running match_clipnest_embeddings RPC ---");
const { data: matches, error: rpcError } = await supabase.rpc(
  "match_clipnest_embeddings",
  { query_embedding: embedding, match_count: 4 }
);

if (rpcError) {
  console.error("RPC error:", JSON.stringify(rpcError, null, 2));
  process.exit(1);
}

console.log(`Matches returned: ${matches?.length ?? 0}`);
if (matches?.length > 0) {
  matches.forEach((m, i) => {
    console.log(`\n  [${i + 1}] "${m.title}"`);
    console.log(`       Creator:    ${m.creator}`);
    console.log(`       Similarity: ${(m.similarity * 100).toFixed(2)}%`);
    console.log(`       URL:        ${m.video_url}`);
  });
} else {
  console.log("\nNo matches — possible causes:");
  console.log("  1. All embeddings in DB are NULL");
  console.log("  2. Vector dimensions mismatch (DB vs query)");
  console.log("  3. RLS policy blocking rows");
  console.log("  4. match_clipnest_embeddings function not updated yet");
}
