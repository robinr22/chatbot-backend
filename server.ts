import express from "express";
import cors from "cors";

const app = express();
app.use(cors());
app.use(express.json());

// Simple health check
app.get("/api/db/health", (req, res) => {
  console.log("Health check - OK");
  res.json({ 
    ok: true, 
    message: "Backend is working",
    timestamp: new Date().toISOString()
  });
});

// Simple chat endpoint
app.post("/api/chat", async (req, res) => {
  try {
    console.log("Chat request received");
    const { messages } = req.body;
    
    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: "Messages array required" });
    }

    // Simple response for testing
    const content = "Hallo! Ich bin dein digitaler Homöopath. Wie kann ich dir heute helfen? Erzähle mir von deinen Symptomen.";
    
    return res.json({ content });
  } catch (err) {
    console.error("Chat error:", err);
    return res.status(500).json({ error: "Chat request failed" });
  }
});

const PORT = Number(process.env.PORT || 3001);
app.listen(PORT, () => {
  console.log(`Backend listening on port ${PORT}`);
});

export default app;