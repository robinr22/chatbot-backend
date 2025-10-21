import express from "express";
import cors from "cors";
import { OpenAI } from "openai";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { config, ensureConfig } from "./config";

const app = express();
app.use(cors());
app.use(express.json({ limit: "1mb" }));

const prisma = new PrismaClient();

ensureConfig();
const openai = new OpenAI({ apiKey: config.apiKey });

app.post("/api/auth/register", async (req, res) => {
  try {
    const { name, email, password } = req.body as { name: string; email: string; password: string };
    if (!name || !email || !password) {
      return res.status(400).json({ error: "Missing name, email or password" });
    }
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return res.status(409).json({ error: "Email already registered" });
    }
    const hashed = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({ data: { name, email, password: hashed } });
    return res.status(201).json({ userId: user.userId, name: user.name, email: user.email });
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
    // Autosave: if userId present, persist last user message as question
    if (userId) {
      const lastUser = [...(messages || [])].reverse().find(m => m.role === "user");
      if (lastUser) {
        await prisma.conversation.create({
          data: {
            userId: Number(userId),
            question: lastUser.content,
            answer: content,
          },
        });
      }
    }
    return res.json({ content });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Chat request failed" });
  }
});

app.get("/api/db/health", async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ ok: false });
  }
});

const PORT = Number(process.env.PORT || 3001);
app.listen(PORT, () => {
  console.log(`Backend listening on http://localhost:${PORT}`);
});

