import { createAdminClient } from "@/lib/supabase/admin";
import OpenAI from "openai";
import { NextRequest } from "next/server";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Update model ID here — check platform.openai.com/docs/models for latest
const MODEL = "gpt-4o";

type Match = {
  title: string;
  creator: string;
  platform: string;
  summary: string;
  transcript_preview: string;
  video_url: string;
  venue: string;
  address: string;
  city: string;
  similarity: number;
};

export async function POST(req: NextRequest) {
  const { message, previousResponseId } = await req.json();

  if (!message?.trim()) {
    return new Response("Message is required", { status: 400 });
  }

  console.log("[chat] user message:", message);
  console.log("[chat] previousResponseId:", previousResponseId ?? "none");

  // 1. Embed the user's question
  console.log("[chat] generating embedding for text:", message);
  const embeddingRes = await openai.embeddings.create({
    model: "text-embedding-3-small",
    input: message,
  });
  const embedding = embeddingRes.data[0].embedding;
  console.log("[chat] embedding dimensions:", embedding.length);
  console.log("[chat] embedding first 10 values:", embedding.slice(0, 10));

  // 2. Search Supabase for similar content
  console.log("[chat] querying Supabase RPC match_clipnest_embeddings...");
  const supabase = createAdminClient();
  const { data: matches, error } = await supabase.rpc(
    "match_clipnest_embeddings",
    { query_embedding: embedding, match_count: 4 }
  );

  if (error) {
    console.error("[chat] Supabase RPC error:", JSON.stringify(error, null, 2));
    return new Response("Search failed", { status: 500 });
  }

  const typedMatches = (matches as Match[]) ?? [];
  console.log("[chat] Supabase returned", typedMatches.length, "matches");
  typedMatches.forEach((m, i) => {
    console.log(`[chat] match[${i}]: title="${m.title}" creator="${m.creator}" similarity=${(m.similarity * 100).toFixed(1)}% url=${m.video_url}`);
  });

  if (typedMatches.length === 0) {
    console.log("[chat] no matches found, returning early");
    return new Response("No matching content found in the ClipNest database for your query.", {
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }

  // 3. Build context from matches
  const context = typedMatches
    .map((m, i) => {
      const location = [m.venue, m.address, m.city].filter(Boolean).join(", ");
      return `[Match ${i + 1}]
Title: ${m.title ?? "Untitled"}
Creator: ${m.creator ?? "Unknown"}
Platform: ${m.platform ?? "N/A"}
${location ? `Location: ${location}` : ""}
Summary: ${m.summary ?? "N/A"}
Preview: ${m.transcript_preview ?? "N/A"}
URL: ${m.video_url ?? "N/A"}
Relevance: ${(m.similarity * 100).toFixed(1)}%`;
    })
    .join("\n\n---\n\n");

  // 4. Stream response via Responses API
  const stream = await openai.responses.create({
    model: MODEL,
    instructions: `You are a search assistant for ClipNest, a video content discovery platform.

IMPORTANT: You MUST only use the matched content provided. Do NOT use outside knowledge or make up information. Every title, creator, URL, venue, address, and city must come directly from the matched content. If no strong match exists, say "I couldn't find a strong match for that in the ClipNest database."

Format responses in clean markdown:
- Use **bold** for titles and important info
- Make video URLs clickable: [Watch Video](url)
- Always include: title, creator, summary
- When available, include a 📍 location block with venue, address, city
- Feature the best match (Match 1) prominently at the top
- List remaining matches under "## Also Recommended"
- Keep descriptions concise`,
    input: `New results from ClipNest database for this query:\n${context}\n\nUser: ${message}`,
    ...(previousResponseId ? { previous_response_id: previousResponseId } : {}),
    stream: true,
  });

  const encoder = new TextEncoder();
  let responseId = "";

  const readable = new ReadableStream({
    async start(controller) {
      for await (const event of stream) {
        if (event.type === "response.output_text.delta") {
          controller.enqueue(encoder.encode(event.delta));
        }
        if (event.type === "response.completed") {
          responseId = event.response.id;
          console.log("[chat] response completed, id:", responseId);
        }
      }
      // Append response ID as a marker for the client to extract
      if (responseId) {
        controller.enqueue(encoder.encode(`\n[CLIPNEST_ID:${responseId}]`));
      }
      controller.close();
    },
  });

  return new Response(readable, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
