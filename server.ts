import express from "express";
import cors from "cors";
import { OpenAI } from "openai";
import { createClient } from "@supabase/supabase-js";

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

const app = express();
app.use(cors());
app.use(express.json({ limit: "1mb" }));

// Initialize Supabase client
const supabase = createClient(config.supabaseUrl, config.supabaseServiceKey);

ensureConfig();
const openai = new OpenAI({ apiKey: config.apiKey });

app.post("/api/auth/register", async (req, res) => {
  try {
    const { email, password, name } = req.body as { email: string; password: string; name: string };
    if (!email || !password || !name) {
      return res.status(400).json({ error: "Missing email, password or name" });
    }

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          name: name,
        },
      },
    });

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    return res.status(201).json({ 
      user: data.user,
      message: "Registration successful. Please check your email to confirm your account." 
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Registration failed" });
  }
});

app.post("/api/chat", async (req, res) => {
  try {
    const { messages, userId } = req.body as {
      messages: Array<{ role: "user" | "assistant" | "system"; content: string }>;
      userId?: number | string;
    };

    // Type-safe message conversion
    const typedMessages = messages?.map(msg => ({
      role: msg.role as "user" | "assistant" | "system",
      content: msg.content
    })) || [];

    if (!openai.apiKey) {
      return res.status(500).json({ error: "Missing OPENAI_API_KEY" });
    }

    const chatMessages = [
      { role: "system" as const, content: config.systemPrompt },
      ...typedMessages
    ];

    const completion = await openai.chat.completions.create({
      model: config.model,
      messages: chatMessages
    });

    const content = completion.choices?.[0]?.message?.content ?? "";
    // Note: Chat saving will be handled by frontend with Supabase
    return res.json({ content });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Chat request failed" });
  }
});

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

// Add error handling middleware
app.use((err: any, req: any, res: any, next: any) => {
  console.error('Server error:', err);
  res.status(500).json({ error: 'Internal server error', details: err.message });
});

const PORT = Number(process.env.PORT || 3001);
app.listen(PORT, () => {
  console.log(`Backend listening on http://localhost:${PORT}`);
  console.log('Environment check:');
  console.log('OPENAI_API_KEY:', process.env.OPENAI_API_KEY ? 'SET' : 'MISSING');
  console.log('SUPABASE_URL:', process.env.SUPABASE_URL ? 'SET' : 'MISSING');
  console.log('SUPABASE_SERVICE_ROLE_KEY:', process.env.SUPABASE_SERVICE_ROLE_KEY ? 'SET' : 'MISSING');
});

