import express from "express";
import cors from "cors";
import { OpenAI } from "openai";
const app = express();
app.use(cors());
app.use(express.json({ limit: "1mb" }));
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
if (!OPENAI_API_KEY) {
    console.error("Missing OPENAI_API_KEY");
}
const openai = new OpenAI({ apiKey: OPENAI_API_KEY });
// Health check
app.get("/api/db/health", (req, res) => {
    console.log("Health check requested");
    res.json({
        ok: true,
        timestamp: new Date().toISOString(),
        openai: !!OPENAI_API_KEY
    });
});
// Chat endpoint
app.post("/api/chat", async (req, res) => {
    try {
        console.log("Chat request received");
        const { messages } = req.body;
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
            { role: "system", content: systemPrompt },
            ...messages.map((msg) => ({
                role: msg.role,
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
        return res.json({ content });
    }
    catch (err) {
        console.error("Chat error:", err);
        return res.status(500).json({ error: "Chat request failed", details: err.message });
    }
});
// Error handling
app.use((err, req, res, next) => {
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
