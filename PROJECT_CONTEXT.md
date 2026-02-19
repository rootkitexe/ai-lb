# ConAssess — Full Project Context

> **Last Updated:** 2026-02-18
> Use this document to resume development from any machine or account. It captures the entire architecture, every file's purpose, data models, AI prompts, API structure, and design decisions.

---

## 1. What Is ConAssess?

An AI-powered technical assessment platform where:
1. User registers (name, email, role, experience level)
2. Picks a topic + difficulty (e.g., "Python", "Medium")
3. AI generates a multi-step scenario with an industry context
4. User answers ONE step at a time — single attempt, no retries
5. AI grades each answer: ✅ Correct (1pt), ⚠️ Partially Correct (0.5pt), ❌ Incorrect (0pt)
6. After all steps → summary in chat → submit → full evaluation report + dashboard

---

## 2. Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18 + TypeScript + Vite 5 + Tailwind CSS |
| Backend | Express 5 + TypeScript (via tsx) |
| Database | MongoDB Atlas (Mongoose ODM) |
| AI Model | Google Gemini 2.0 Flash via OpenRouter API |
| Speech | Web Speech API (browser-native, Chrome/Edge) |

---

## 3. Environment Variables (`.env`)

```
VITE_OPENROUTER_API_KEY=sk-or-v1-...    # OpenRouter API key (used in frontend ai.ts)
MONGODB_URI=mongodb+srv://...            # MongoDB Atlas connection string
PORT=5000                                 # Express server port
```

---

## 4. How to Run

```bash
# Terminal 1 — Backend (Express + MongoDB)
npm run server        # runs: tsx server/index.ts → http://localhost:5000

# Terminal 2 — Frontend (Vite dev server)
npm run dev           # runs: vite → http://localhost:5173
```

Vite proxies `/api/*` requests to `localhost:5000` (configured in `vite.config.ts`).

---

## 5. File Structure & Purpose

```
AI-LB/
├── .env                          # API keys + MongoDB URI + port
├── package.json                  # Scripts: dev, server, build
├── vite.config.ts                # Vite config with /api proxy to :5000
├── tailwind.config.js            # Tailwind config
├── index.html                    # Entry HTML
│
├── server/                       # EXPRESS BACKEND
│   ├── index.ts                  # Express app setup, CORS, routes, start()
│   ├── db.ts                     # MongoDB connection (mongoose.connect)
│   ├── models/
│   │   ├── User.ts               # User schema: name, email, jobRole, experience
│   │   └── TestResult.ts         # TestResult schema + embedded StepResult schema
│   └── routes/
│       ├── users.ts              # POST /register (upsert by email), GET /:id
│       └── tests.ts              # POST /submit (calculate score), GET /user/:id, GET /:id
│
└── src/                          # REACT FRONTEND
    ├── main.tsx                  # ReactDOM.createRoot entry
    ├── index.css                 # Global styles + Tailwind imports
    ├── App.tsx                   # Main router: landing → onboarding → assessment → report → dashboard
    │
    ├── components/
    │   ├── AiInterviewer.tsx     # ★ CORE — Chat panel, single-attempt flow, speech input, validation, summary
    │   ├── ProblemStatement.tsx  # Left panel — renders scenario context markdown
    │   └── LogicTerminal.tsx     # (Legacy, mostly unused) terminal simulation panel
    │
    ├── pages/
    │   ├── OnboardingForm.tsx    # User registration + topic/difficulty selection
    │   ├── EvalReport.tsx        # Post-test evaluation: circular score, 3-tier step breakdown
    │   └── Dashboard.tsx         # User dashboard: test history, stats
    │
    ├── services/
    │   ├── ai.ts                 # ★ AI LOGIC — 3 functions: sendMessageToAI, validateAnswer, generateScenario
    │   └── api.ts                # Frontend API client: registerUser, submitTest, getUserTests, getTestReport
    │
    └── data/
        ├── scenario.ts           # LogicScenario/LogicStep interfaces + 2 hardcoded practice scenarios
        └── aiscenario.ts         # AIScenarioConfig interface + 1 preset AI scenario config
```

---

## 6. Data Models

### User (`server/models/User.ts`)
```typescript
{
  name: string;           // "Shubham Dash"
  email: string;          // "shubham@example.com" (unique index)
  jobRole: string;        // "Frontend Developer"
  experience: 'Junior' | 'Mid' | 'Senior';
  createdAt: Date;
}
```

### TestResult (`server/models/TestResult.ts`)
```typescript
{
  userId: ObjectId;       // ref → User
  topic: string;          // "Python", "Docker", etc.
  difficulty: 'Easy' | 'Medium' | 'Hard';
  totalSteps: number;
  correctAnswers: number;
  score: number;          // 0-100 percentage
  steps: StepResult[];    // Embedded array
  aiSummary: string;      // AI-generated evaluation text
  createdAt: Date;
}
```

### StepResult (embedded in TestResult)
```typescript
{
  stepIndex: number;
  instruction: string;        // The question asked
  userAnswer: string;         // What the user typed/spoke
  expectedAnswer: string;     // The correct answer
  correct: boolean;           // true only if status === 'correct'
  status: 'correct' | 'partially_correct' | 'incorrect';
  feedback: string;           // AI's brief explanation
  timeTakenMs: number;        // Time spent on this step
}
```

---

## 7. API Routes

### Users
| Method | Route | Purpose |
|---|---|---|
| POST | `/api/users/register` | Create or update user by email |
| GET | `/api/users/:id` | Get user profile |

### Tests
| Method | Route | Purpose |
|---|---|---|
| POST | `/api/tests/submit` | Submit test results, server calculates score with partial credit |
| GET | `/api/tests/user/:userId` | Get all tests for dashboard |
| GET | `/api/tests/:id` | Get detailed test report (populates user) |

### Score Calculation (server-side)
```
score = ((correctCount + partialCount × 0.5) / totalSteps) × 100
```

---

## 8. AI Prompts (in `src/services/ai.ts`)

### 8a. Chat System Prompt (`sendMessageToAI`)
- Role: "Senior Technical Interviewer" for ConAssess
- Guides user through steps one at a time
- Professional, concise, domain-adaptive language
- Does NOT reveal answers; gives hints if stuck

### 8b. Answer Validation Prompt (`validateAnswer`)
- THREE-TIER grading: `correct`, `partially_correct`, `incorrect`
- Handles voice input (speech-to-text): interprets "dash" → "-", "dot" → ".", etc.
- Accepts equivalent syntax variations
- Returns JSON: `{status, feedback, correctedAnswer}`
- This is a TEST — no hints, no answer reveals, just brief feedback
- Lenient on formatting, strict on concept knowledge

### 8c. Scenario Generation Prompt (`generateScenario`)
- Generates scenarios for ANY technical topic
- Returns JSON: `{context: "markdown", steps: [{id, instruction, expectedAnswer, outputSimulation}]}`
- Topic-adaptive: CLI → commands, Programming → code, SQL → queries, Conceptual → short answers
- Short answers ONLY: max 1 line, <80 chars, single concept per step
- Each step builds incrementally (progressive, not random trivia)
- Uses random industry context and variation seed for uniqueness
- Context includes: title, problem description, numbered task list, technical details

---

## 9. Core Assessment Flow

```
OnboardingForm → handleOnboardingComplete()
  ├── registerUser() → saves to MongoDB
  ├── generateScenario() → AI creates steps
  └── setView('assessment')

AssessmentView
  ├── Left panel: ProblemStatement (scenario.context)
  └── Right panel: AiInterviewer
       ├── Shows question (step.instruction)
       ├── User types/speaks answer
       ├── validateAnswer() → 3-tier grading
       ├── Shows ✅/⚠️/❌ feedback
       ├── onStepSuccess() → advances to next step
       └── After all steps: shows summary in chat

Submit Assessment
  ├── handleTestComplete() → calculates score with partial credit
  ├── submitTest() → saves to MongoDB
  └── setView('report') → EvalReport page

EvalReport
  ├── Circular score gauge
  ├── 4-column stats: Correct / Partial / Incorrect / Total
  ├── AI Analysis summary
  ├── Per-step breakdown with colored badges
  └── "Go to Dashboard" button
```

---

## 10. Key Design Decisions

1. **Single attempt per step** — This is a test. One answer, auto-advance. No retries or hints.
2. **3-tier grading** — Correct (1pt) / Partially Correct (0.5pt) / Incorrect (0pt). More nuanced than binary.
3. **AI-driven everything** — Scenario generation, answer validation, and chat are all AI-powered. No hardcoded answer matching.
4. **Topic-agnostic** — Prompts support any technical topic (Python, SQL, Docker, React, System Design, etc.). No DevOps-specific assumptions.
5. **Short answers** — Each step expects max 1-line answer (~80 chars). Tests single concepts, not multi-line code.
6. **Incremental steps** — Steps build toward a complete solution progressively, not random isolated questions.
7. **Voice input** — Web Speech API with generous interpretation of spoken syntax.

---

## 11. Frontend TypeScript Interfaces

### LogicScenario (`src/data/scenario.ts`)
```typescript
interface LogicStep {
  id: string;
  instruction: string;
  expectedAnswer: string;
  commandPattern?: RegExp;
  outputSimulation: string;
  captureVariable?: { name: string; value: string };
}

interface LogicScenario {
  id: string;
  title: string;
  description: string;
  difficulty: 'Junior' | 'Mid' | 'Senior';
  environment: string;
  context: string;
  steps: LogicStep[];
}
```

### AIScenarioConfig (`src/data/aiscenario.ts`)
```typescript
interface AIScenarioConfig {
  id: string;
  title: string;
  description: string;
  topic: string;
  difficulty: 'Junior' | 'Mid' | 'Senior';
  blanks: number;
  environment: string;
  tags: string[];
}
```

### StepResult (`src/components/AiInterviewer.tsx`)
```typescript
interface StepResult {
  stepIndex: number;
  instruction: string;
  userAnswer: string;
  expectedAnswer: string;
  correct: boolean;
  status: 'correct' | 'partially_correct' | 'incorrect';
  feedback: string;
  timeTakenMs: number;
}
```

### ValidationResult (`src/services/ai.ts`)
```typescript
type AnswerStatus = 'correct' | 'partially_correct' | 'incorrect';

interface ValidationResult {
  correct: boolean;
  status: AnswerStatus;
  feedback: string;
  correctedCommand?: string;
}
```

---

## 12. App Views / Routing (`App.tsx`)

```typescript
type AppView = 'landing' | 'onboarding' | 'assessment' | 'report' | 'dashboard';
```

| View | Component | Description |
|---|---|---|
| `landing` | `LandingPage` | Hero + practice scenario cards + "Take AI Assessment" button |
| `onboarding` | `OnboardingForm` | Name, email, role, experience, topic, difficulty |
| `assessment` | `AssessmentView` | Split: ProblemStatement (60%) + AiInterviewer (40%) |
| `report` | `EvalReport` | Scored evaluation with per-step breakdown |
| `dashboard` | `Dashboard` | Test history, stats, past reports |

---

## 13. Dependencies (`package.json`)

```json
{
  "dependencies": {
    "clsx": "^2.1.0",
    "cors": "^2.8.6",
    "dotenv": "^17.3.1",
    "express": "^5.2.1",
    "lucide-react": "^0.294.0",
    "mongoose": "^9.2.1",
    "react": "^18.2.0",
    "react-dom": "^18.2.0"
  },
  "devDependencies": {
    "@types/cors": "^2.8.19",
    "@types/express": "^5.0.4",
    "@types/react": "^18.2.43",
    "@types/react-dom": "^18.2.17",
    "@vitejs/plugin-react": "^4.2.1",
    "autoprefixer": "^10.4.16",
    "postcss": "^8.4.32",
    "tailwindcss": "^3.4.0",
    "tsx": "^4.21.0",
    "typescript": "^5.2.2",
    "vite": "^5.0.8"
  }
}
```

---

## 14. Known Issues / TODOs

- `LogicTerminal.tsx` has an unused `scenario` variable (TS6133) — component is mostly legacy
- Landing page still shows DevOps-specific practice scenario cards (hardcoded in `scenario.ts`)
- No auth layer — user is identified purely by email during registration
- API key is in frontend `.env` (VITE_OPENROUTER_API_KEY) — exposed in browser. Should move to backend/Edge Function for production
- No rate limiting on AI calls

---

## 15. Future: Lovable Migration

A separate migration plan exists at `lovable_migration_plan.md` covering:
- Postgres schema to replace MongoDB
- Supabase Edge Functions to secure AI API key
- Supabase client to replace Express API calls
- Component transfer checklist (90% as-is)
