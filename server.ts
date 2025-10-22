import express from "express";
import cors from "cors";
import { OpenAI } from "openai";
import { createClient } from "@supabase/supabase-js";

const app = express();
app.use(cors());
app.use(express.json({ limit: "1mb" }));

// Inline configuration to avoid module resolution issues in Vercel
const config = {
  apiKey: process.env.OPENAI_API_KEY || "",
  model: process.env.OPENAI_MODEL || "gpt-4o-mini",
  systemPrompt: process.env.SYSTEM_PROMPT ||
    `Du bist ein digitaler Homöopath. Deine Aufgabe ist es, Menschen bei der Wahl eines passenden homöopathischen Mittels zu helfen.

Gesprächsstruktur:
1. Begrüße die Person freundlich.
2. Frage gezielt nach Symptomen. Versuche, alle relevanten Symptome zu erfassen (körperlich & emotional).
3. Wenn noch Symptome fehlen könnten, frage weiter: "Gibt es noch weitere Symptome, die du erwähnen möchtest?"
4. Sobald alle Symptome bekannt sind, schlage EIN passendes homöopathisches Mittel vor. Gib dazu die passende Potenz an (z. B. C30 oder C200).
5. Erkläre klar, wie und wann das Mittel eingenommen werden soll.
6. Sprich auf Deutsch, sei empathisch, aber klar und strukturiert. Du darfst keine Diagnosen stellen oder schulmedizinische Aussagen machen.
7. Wenn du keine Empfehlung geben kannst, sag freundlich, dass du dafür mehr Infos brauchst.

- Falls dir Kontextinformationen vorliegen (z. B. aus medizinischen Texten oder einem Homöopathiebuch), nutze diese für deine Empfehlung.

Achte darauf, die Konversation natürlich zu gestalten – du bist professionell, freundlich und zurückhaltend sicher.`,
  supabaseUrl: process.env.SUPABASE_URL || "",
  supabaseAnonKey: process.env.SUPABASE_ANON_KEY || "",
  supabaseServiceKey: process.env.SUPABASE_SERVICE_ROLE_KEY || "",
};

function ensureConfig(): void {
  if (!config.apiKey) {
    throw new Error("Missing OPENAI_API_KEY. Bitte in .env oder direkt in config.ts setzen.");
  }
}

ensureConfig();

const openai = new OpenAI({ apiKey: config.apiKey });
const supabase = createClient(config.supabaseUrl, config.supabaseServiceKey);

// Health check endpoint
app.get("/api/db/health", async (_req, res) => {
  try {
    console.log('Health check started');
    const { data, error } = await supabase.from("conversations").select("count").limit(1);
    if (error) {
      console.error('Supabase health check failed:', error);
      return res.status(500).json({ ok: false, error: error.message });
    }
    console.log('Health check successful');
    res.json({ ok: true });
  } catch (e) {
    console.error('Health check failed:', e);
    res.status(500).json({ ok: false, error: e.message });
  }
});

// Chat endpoint
app.post("/api/chat", async (req, res) => {
  try {
    console.log("Chat request received");
    const { messages } = req.body;
    
    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: "Messages array required" });
    }

    const chatMessages = [
      { role: "system" as const, content: config.systemPrompt },
      ...messages.map((msg: any) => ({
        role: msg.role as "user" | "assistant" | "system",
        content: msg.content
      }))
    ];

    console.log("Calling OpenAI...");
    const completion = await openai.chat.completions.create({
      model: config.model,
      messages: chatMessages
    });

    const content = completion.choices?.[0]?.message?.content ?? "";
    console.log("OpenAI response received");
    
    return res.json({ content });
  } catch (err) {
    console.error("Chat error:", err);
    return res.status(500).json({ error: "Chat request failed", details: err.message });
  }
});

// Error handling
app.use((err: any, req: any, res: any, next: any) => {
  console.error("Server error:", err);
  res.status(500).json({ error: "Internal server error", details: err.message });
});

const PORT = Number(process.env.PORT || 3001);
app.listen(PORT, () => {
  console.log(`Backend listening on port ${PORT}`);
  console.log("Environment check:");
  console.log("- OPENAI_API_KEY:", config.apiKey ? "SET" : "MISSING");
  console.log("- SUPABASE_URL:", config.supabaseUrl ? "SET" : "MISSING");
  console.log("- SUPABASE_SERVICE_KEY:", config.supabaseServiceKey ? "SET" : "MISSING");
});

export default app;