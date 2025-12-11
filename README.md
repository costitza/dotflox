# Dotflux – AI Engineering Context Dashboard

**Dotflux** is an AI-first engineering intelligence dashboard. It syncs your GitHub repositories and engineering conversations into a single workspace, then lets you explore them with an AI agent that understands your codebase, PRs, contributors, and technical meetings.

---

## 💡 High-Level Idea

### The Problem
Engineering context is scattered across repositories, Pull Requests, call notes, and chat logs. AI agents typically act blindly without access to this historical data.

### The Solution
Dotflux ingests your repository metadata, PRs, contributors, and meeting events into **Convex**, then exposes that context to:
1.  A **SaaS-style web dashboard** (Landing, User Dashboard, Per-Repo View).
2.  A **Repo-Aware AI Assistant** that you interact with using voice (speech-in, speech-out), powered by **ElevenLabs** and **AI SDK** agents over Convex.

---

## 🚀 Core Features

### 1. Landing Page (`/`)
A minimalist, light-mode SaaS marketing page built with Tailwind v4 and Shadcn.
* **Hero Section:** “Capture the pulse of your code and conversation.”
* **Visuals:** Dashboard mocks showing PR velocity vs. meeting frequency.
* **Bento Grid:** Highlights GitHub Sync, Deep Code Analysis, and Meeting Listener features.
* **Workflow:** Plan → Listen → Analyze.
* **Auth:** Seamless authentication via **Clerk** (Sign In / Get Started).

### 2. User Dashboard (`/dashboard`)
Accessible only to authenticated users.
* **Stats Row:** Displays connected repos, PR summaries, and health scores.
* **Repo Management:**
    * Users add repositories via `AddRepoForm` (Owner + Repo Name).
    * Server-side Convex actions (`addFromGithub`) use **Octokit** to pull metadata (Description, URL, Default Branch, etc.).

### 3. Repository Dashboard (`/dashboard/[repoId]`)
Each repository gets a dedicated, deep-dive dashboard backed by real-time Convex queries.
* **General Info:** Repo owner, name, description, and history checkpoints.
* **Contributors:** Aggregated stats including PR counts, lines changed, and inferred roles/seniority.
* **PRs & Analyses:**
    * Lists PRs with status chips.
    * Displays AI-driven risk levels and impact analysis derived from the `prAnalyses` table.
* **Calls & Action Items:** Logs recorded engineering calls with summaries, tags, and generated follow-up action items linked to PRs.

---

## 🎙️ Voice AI Assistant
**Speech-In, Speech-Out Interaction**

Dotflux features a voice chatbot located at the bottom of every repo dashboard. It allows engineers to "talk" to their codebase.

### Workflow
1.  **Record:** User speaks into the microphone (handled by `MediaRecorder`).
2.  **Transcribe (STT):** Audio is sent to `/api/listen`, which proxies to **ElevenLabs Scribe v1** to return a text transcript.
3.  **Process (AI Agent):** The transcript is sent to the **Convex RepoAssistant Agent**.
    * The agent uses the `getRepoContext` tool to pull metadata, tech stack, contributor counts, and analysis stats.
    * It formulates a natural language response grounded in the repo's specific context.
4.  **Speak (TTS):** The text response is sent to `/api/speak`.
    * Uses `experimental_generateSpeech` from the AI SDK with **ElevenLabs Multilingual v2**.
    * Returns an MP3 stream played immediately to the user.

### Code Snippet: TTS Endpoint
```typescript
const { audio } = await generateSpeech({
  model: elevenlabs.speech(modelId),
  text,
});

const arrayBuffer = audio.uint8Array.buffer as ArrayBuffer;
const blob = new Blob([arrayBuffer], { type: "audio/mpeg" });

return new Response(blob, {
  status: 200,
  headers: { "Content-Type": "audio/mpeg", "Cache-Control": "no-store" },
});
```

# Convex Data Model

The backend logic and data storage are handled entirely by Convex.

## Core Tables (convex/schema.ts)

-   **users**: Mirrored from Clerk.
-   **repos**: GitHub IDs, owner/name, description, GitHub access
    tokens.
-   **contributors / repoContributors**: Profiles and repo-scoped
    metrics.
-   **pullRequests / prAnalyses**: PR data synced from GitHub and
    subsequent AI risk analysis.
-   **analysisSessions**: Workflows connecting PRs and Repos to AI
    agents.
-   **calls / callActionItems**: Meeting logs and extracted TODOs.
-   **techStackItems**: Detected languages and frameworks.

## Agents

-   **PRAnalyzer**: Keeps PR data in sync using `syncGithubPullRequest`.
-   **RepoAssistant**: The brain behind the voice chat. It utilizes
    `getRepoContext` to answer questions like:
    -   "Who is the top contributor for the frontend?"
    -   "What is the risk level of the last 3 PRs?"

## 🛠️ Tech Stack

### Frontend

-   **Framework**: Next.js 16 (App Directory, Turbopack)\
-   **Language**: TypeScript, React 19\
-   **Styling**: Tailwind CSS v4, Shadcn UI (Royal Blue & Slate theme)\
-   **Animation**: Framer Motion

### Backend & Auth

-   **Database & API**: Convex (Typed schema, real-time subscriptions)\
-   **Authentication**: Clerk\
-   **GitHub Integration**: Octokit (@octokit/rest)

### AI & Agents

-   **Orchestration**: Vercel AI SDK\
-   **LLMs**: OpenAI (for logic/reasoning)\
-   **Voice**: ElevenLabs (TTS & STT)

## ⚡ Getting Started

### Prerequisites

-   Node.js 18+
-   Convex CLI installed globally (`npm install -g convex`)
-   Accounts for: ElevenLabs, OpenAI, GitHub, and Clerk.

### Installation

#### Install Dependencies

``` bash
npm install
```

### Environment Variables

Create a `.env.local` file with the following keys:

``` bash
# Convex
NEXT_PUBLIC_CONVEX_URL="your-convex-url"

# Clerk
CLERK_PUBLISHABLE_KEY="your-clerk-key"
CLERK_SECRET_KEY="your-clerk-secret"
CLERK_JWT_ISSUER_DOMAIN="your-issuer-domain"

# AI
OPENAI_API_KEY="your-openai-key"
ELEVENLABS_API_KEY="your-elevenlabs-key"

# GitHub OAuth
GITHUB_CLIENT_ID="your-github-id"
GITHUB_CLIENT_SECRET="your-github-secret"
```

### Run Development Servers

Start the Convex backend:

``` bash
npx convex dev
```

Start the Next.js frontend:

``` bash
npm run dev
```

The app will be available at http://localhost:3000.

## 📖 Usage Flow

1.  **Authenticate**: Visit `/` and sign in via Clerk.
2.  **Connect Repo**: Go to `/dashboard` and click "Add Repository" to
    authorize GitHub access.
3.  **Analyze**: Click into a repository row (`/dashboard/[repoId]`) to
    view analyzed PRs, contributors, and calls.
4.  **Talk to your Code**: Scroll to the Repo Voice Assistant, click
    "Hold a conversation," and ask a question out loud. The AI will
    answer verbally using the context stored in Dotflux.
