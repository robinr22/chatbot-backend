## Projektüberblick

Kurze Übersicht über die wichtigsten Dateien/Ordner und wie sie zusammenarbeiten.

### Backend (eigener Chatbot-Server)
- `server.ts`
  - Express-Server mit Endpoint `POST /api/chat`.
  - Nutzt zentrale Konfiguration aus `config.ts` (Model, System-Prompt, API-Key).
  - Sendet die Chat-Historie (User/Assistant) + System-Prompt an OpenAI und gibt die Antwort an das Frontend zurück.
- `config.ts`
  - Zentrale Konfiguration für `OPENAI_API_KEY`, `OPENAI_MODEL`, `SYSTEM_PROMPT`.
  - Lädt `.env` automatisch (via `dotenv`) und stellt geprüfte Werte bereit.
- `package.json`
  - Scripts: `dev` (lokale Entwicklung mit ts-node-dev), `build`, `start`.
  - Dependencies für Express, OpenAI, dotenv, cors.
- `tsconfig.json`
  - TypeScript-Einstellungen fürs Backend (Ausgabe nach `dist/`, strikte Typen etc.).
- `.env` (lokal; nicht eingecheckt)
  - Beispielwerte:
    - `OPENAI_API_KEY=sk-...`
    - `OPENAI_MODEL=gpt-4o-mini`
    - `SYSTEM_PROMPT=...` (Rollenanweisung für den Assistenten)
    - `PORT=3001`

Zusammenspiel: `server.ts` lädt `.env` via `dotenv`, erstellt den Express-Server, verarbeitet `/api/chat` und spricht die OpenAI API an.

### Frontend (Wise Remedy Bot – Vite/React)
- Ordner: `wise-remedy-bot/`
- `src/components/ChatInterface.tsx`
  - Chat-UI-Komponente. Baut lokale Nachrichtenliste auf.
  - Sendet bei Absenden eine Anfrage an `/api/chat` und zeigt die Antwort.
- `vite.config.ts`
  - Dev-Server-Konfiguration (Port 8080).
  - Proxy-Routing: Alle Requests auf `/api` werden an `http://localhost:3001` (Backend) weitergeleitet → vermeidet CORS im DEV.
- `src/main.tsx` / `src/App.tsx`
  - Einstiegspunkt der React-App und App-Komposition.

Zusammenspiel: Die React-App läuft unter `http://localhost:8080` (Vite). API-Calls an `/api/...` werden während der Entwicklung an das Backend geleitet, das standardmäßig auf `http://localhost:3001` hört.

## Lokal starten
1) Backend starten
```bash
cd /Users/robinreinhart/Desktop/Projekt/Chatbot
# (optional) .env verwenden – du hast Key & Prompt bereits in config.ts gesetzt
# cp .env.example .env
npm i
npm run dev
```

2) Frontend starten (in neuem Terminal)
```bash
cd /Users/robinreinhart/Desktop/Projekt/Chatbot/wise-remedy-bot
npm i
npm run dev
```

3) Aufrufen
- Frontend: `http://localhost:8080`
- Backend (nur API): `http://localhost:3001/api/chat`

Hinweis:
- Während der Entwicklung leitet Vite Requests auf `/api/...` automatisch an das Backend (Port 3001) weiter (siehe `vite.config.ts`).
- Der zentrale Prompt, das Modell und der API-Key werden in `config.ts` verwaltet. Werte aus `.env` überschreiben diese bei Bedarf.

## Wichtige Hinweise
- Der API-Key liegt nur im Backend (.env) – niemals im Frontend einchecken.
- Modell und System-Prompt steuerst du zentral in `config.ts` (bzw. `.env`).
- Für Produktionsumgebungen Backend und Frontend getrennt bauen/deployen oder einen Reverse-Proxy nutzen.

## Frontend-Updates aus GitHub holen (ohne Backend zu berühren)
Du nutzt das Frontend `wise-remedy-bot/` als eigenes Repo (Option A). So ziehst du Änderungen von Lovable/GitHub:

1) Im Frontend-Ordner den Remote setzen (einmalig)
```bash
cd /Users/robinreinhart/Desktop/Projekt/Chatbot/wise-remedy-bot
git init
git branch -M main
git remote remove origin 2>/dev/null || true
git remote add origin "https://github.com/robinr22/wise-remedy-bot.git"
```

2) Änderungen holen (lokale Änderungen dabei überschreiben)
```bash
git fetch origin
git ls-remote --heads origin
# Wenn main existiert:
git checkout -B main origin/main || true
git reset --hard origin/main || true
git branch --set-upstream-to=origin/main || true
# Wenn stattdessen master existiert (nur falls main nicht vorhanden):
# git checkout -B master origin/master
# git reset --hard origin/master
# git branch --set-upstream-to=origin/master
```

3) Backend-Repo isolieren (nur falls `Chatbot/` selbst ein Git-Repo ist und `wise-remedy-bot/` versehentlich getrackt war)
```bash
cd /Users/robinreinhart/Desktop/Projekt/Chatbot
echo wise-remedy-bot/ >> .gitignore
git rm -r --cached wise-remedy-bot  # nur nötig, wenn schon getrackt
git commit -m "Ignore frontend standalone repo"
git push
```

Damit bleibt das Backend unberührt; Frontend-Änderungen ziehst du nur im Unterordner.

## Datenbank-Vorschlag (unabhängig vom Lovable-Frontend)
Ziel: Nutzerverwaltung, Anmeldung/Sitzungen, und Speicherung von Konversationen/Chats.

Gewählt: Supabase Postgres via Prisma.

Beispiel-Schema (vereinfachtes Modell):
```prisma
model User {
  id        String   @id @default(cuid())
  email     String   @unique
  name      String?
  password  String   // gehasht (z. B. bcrypt)
  createdAt DateTime @default(now())
  sessions  Session[]
  convos    Conversation[]
}

model Session {
  id        String   @id @default(cuid())
  userId    String
  user      User     @relation(fields: [userId], references: [id])
  token     String   @unique
  expiresAt DateTime
  createdAt DateTime @default(now())
}

model Conversation {
  id        String   @id @default(cuid())
  userId    String
  user      User     @relation(fields: [userId], references: [id])
  title     String?
  createdAt DateTime @default(now())
  messages  Message[]
}

enum Role {
  user
  assistant
  system
}

model Message {
  id             String       @id @default(cuid())
  conversationId String
  conversation   Conversation @relation(fields: [conversationId], references: [id])
  role           Role
  content        String
  tokenCount     Int?
  createdAt      DateTime     @default(now())
}
```

Supabase-ENV im Backend (`.env`):
```bash
DATABASE_URL=postgresql://postgres:<PASSWORT>@db.gjiyqdfrihbhhdtlobzo.supabase.co:5432/postgres
SUPABASE_URL=https://gjiyqdfrihbhhdtlobzo.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdqaXlxZGZyaWhiaGhkdGxvYnpvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTkzNzc2ODAsImV4cCI6MjA3NDk1MzY4MH0.KY5Az5-5tS-K989SWV3Z0BJ_gT4VsO8SFIz6ZNb8PEA
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdqaXlxZGZyaWhiaGhkdGxvYnpvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1OTM3NzY4MCwiZXhwIjoyMDc0OTUzNjgwfQ.Hp8fYlXZI_5oQ7dDV0qJRDu2BW8LH0xHkms0iUeOWeI
```

Migrations:
```bash
npm i
npx prisma generate
npx prisma migrate dev --name init
```

Backend-API (Skizze):
- `POST /api/auth/register` (email, password) → User anlegen
- `POST /api/auth/login` → Session erstellen, Token ausgeben
- `POST /api/conversations` → neue Konversation
- `GET /api/conversations/:id/messages` → Nachrichten laden
- `POST /api/chat` → Chatnachricht speichern, OpenAI callen, Antwort speichern

Env-Erweiterung (Backend):
```bash
DATABASE_URL="file:./dev.db"         # lokal (SQLite)
# Produktion z. B.:
# DATABASE_URL="postgresql://user:pass@host:5432/db?schema=public"
```

Hinweis: Diese DB-Lösung ist unabhängig vom von Lovable generierten Frontend/Code. Wir behalten `server.ts` als zentrale Schnittstelle und erweitern sie um die oben beschriebenen Endpunkte.


