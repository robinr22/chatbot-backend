import express from "express";
import cors from "cors";
import { OpenAI } from "openai";
import { createClient } from "@supabase/supabase-js";

const app = express();
app.use(cors());
app.use(express.json({ limit: "1mb" }));

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY;

if (!OPENAI_API_KEY) {
  console.error("Missing OPENAI_API_KEY");
}

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error("Missing Supabase configuration");
  process.exit(1);
}

const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

// Health check
app.get("/api/db/health", async (req, res) => {
  console.log("Health check requested");
  
  let supabaseStatus = false;
  try {
    const { data, error } = await supabase.from("conversations").select("count").limit(1);
    supabaseStatus = !error;
  } catch (e) {
    console.error("Supabase health check failed:", e);
  }
  
  res.json({ 
    ok: true, 
    timestamp: new Date().toISOString(),
    openai: !!OPENAI_API_KEY,
    supabase: supabaseStatus,
    supabaseUrl: !!SUPABASE_URL,
    supabaseKey: !!SUPABASE_SERVICE_KEY
  });
});

// Chat endpoint
app.post("/api/chat", async (req, res) => {
  try {
    console.log("Chat request received");
    const { messages, userId, conversationId } = req.body;
    
    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: "Messages array required" });
    }

    if (!OPENAI_API_KEY) {
      console.error("OpenAI API key not configured");
      return res.status(500).json({ error: "OpenAI API key not configured" });
    }

    const systemPrompt = `Du bist ein digitaler Homöopath. Deine Aufgabe ist es, Menschen bei der Wahl eines passenden homöopathischen Mittels zu helfen.

Gesprächsstruktur:
1. Begrüße die Person freundlich.
2. Frage gezielt nach Symptomen. Versuche, alle relevanten Symptome zu erfassen (körperlich & emotional).
3. Wenn noch Symptome fehlen könnten, frage weiter: "Gibt es noch weitere Symptome, die du erwähnen möchtest?"
4. Sobald alle Symptome bekannt sind, schlage EIN passendes homöopathisches Mittel vor. Gib dazu die passende Potenz an (z. B. C30 oder C200).
5. Erkläre klar, wie und wann das Mittel eingenommen werden soll.
6. Sprich auf Deutsch, sei empathisch, aber klar und strukturiert. Du darfst keine Diagnosen stellen oder schulmedizinische Aussagen machen.
7. Wenn du keine Empfehlung geben kannst, sag freundlich, dass du dafür mehr Infos brauchst.

Achte darauf, die Konversation natürlich zu gestalten – du bist professionell, freundlich und zurückhaltend sicher.`;

    const chatMessages = [
      { role: "system" as const, content: systemPrompt },
      ...messages.map((msg: any) => ({
        role: msg.role as "user" | "assistant" | "system",
        content: msg.content
      }))
    ];

    console.log("Calling OpenAI...");
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: chatMessages
    });

    const content = completion.choices?.[0]?.message?.content ?? "";
    console.log("OpenAI response received:", content.substring(0, 100) + "...");
    
    // Save conversation to Supabase if userId is provided
    if (userId && conversationId) {
      try {
        console.log('Attempting to save messages to Supabase...');
        console.log('userId:', userId);
        console.log('conversationId:', conversationId);
        
        // Get the last user message
        const lastUserMessage = messages[messages.length - 1];
        
        // Save user message
        const { data: userData, error: userError } = await supabase
          .from('messages')
          .insert({
            conversation_id: conversationId,
            role: 'user',
            content: lastUserMessage.content,
            created_at: new Date().toISOString()
          })
          .select();
        
        if (userError) {
          console.error('Error saving user message:', userError);
        } else {
          console.log('User message saved successfully:', userData);
        }
        
        // Save assistant message
        const { data: assistantData, error: assistantError } = await supabase
          .from('messages')
          .insert({
            conversation_id: conversationId,
            role: 'assistant',
            content: content,
            created_at: new Date().toISOString()
          })
          .select();
        
        if (assistantError) {
          console.error('Error saving assistant message:', assistantError);
        } else {
          console.log('Assistant message saved successfully:', assistantData);
        }
        
        console.log('Messages saved to Supabase successfully');
      } catch (error) {
        console.error('Error saving to Supabase:', error);
      }
    }
    
    return res.json({ content });
  } catch (err: any) {
    console.error("Chat error:", err);
    return res.status(500).json({ error: "Chat request failed", details: err.message });
  }
});

// Create new conversation
app.post("/api/conversations", async (req, res) => {
  try {
    const { userId } = req.body;
    
    if (!userId) {
      return res.status(400).json({ error: "userId required" });
    }
    
    const { data, error } = await supabase
      .from('conversations')
      .insert({
        user_id: userId,
        title: 'Neue Unterhaltung',
        created_at: new Date().toISOString()
      })
      .select()
      .single();
    
    if (error) {
      console.error('Error creating conversation:', error);
      return res.status(500).json({ error: "Failed to create conversation" });
    }
    
    res.json({ conversationId: data.id });
  } catch (err: any) {
    console.error("Conversation creation error:", err);
    res.status(500).json({ error: "Failed to create conversation" });
  }
});

// Get user conversations
app.get("/api/conversations/:userId", async (req, res) => {
  try {
    const { userId } = req.params;
    
    const { data, error } = await supabase
      .from('conversations')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    
    if (error) {
      console.error('Error fetching conversations:', error);
      return res.status(500).json({ error: "Failed to fetch conversations" });
    }
    
    res.json({ conversations: data });
  } catch (err: any) {
    console.error("Conversation fetch error:", err);
    res.status(500).json({ error: "Failed to fetch conversations" });
  }
});

// Get conversation messages
app.get("/api/conversations/:conversationId/messages", async (req, res) => {
  try {
    const { conversationId } = req.params;
    
    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true });
    
    if (error) {
      console.error('Error fetching messages:', error);
      return res.status(500).json({ error: "Failed to fetch messages" });
    }
    
    res.json({ messages: data });
  } catch (err: any) {
    console.error("Message fetch error:", err);
    res.status(500).json({ error: "Failed to fetch messages" });
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
  console.log("- OPENAI_API_KEY:", OPENAI_API_KEY ? "SET" : "MISSING");
});

export default app;