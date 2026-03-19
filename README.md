# U'rWay

U'rWay is an AI-driven growth and productivity platform that acts like a personalized mentor, not just a passive task tracker. It combines user behavior signals, structured onboarding, and GenAI orchestration to generate adaptive roadmaps that help users move from planning to execution.

## 1. Project Overview

Most productivity systems wait for users to manually define every step. U'rWay is designed to do more:

- understand the learner profile from rich onboarding inputs
- classify users into a meaningful virtual cluster
- generate personalized, actionable roadmap steps
- continuously adapt guidance using user activity signals

This creates a single ecosystem for long-term self-improvement, career acceleration, and better time management.

## 2. Objectives

### Why this project exists

Modern users face productivity debt: many tools, no cohesive growth path.

### What U'rWay solves

- passive planning is replaced with active AI guidance
- disconnected tools are unified into one workflow
- generic advice is replaced with context-aware personalization

### Core goal

Enable data-driven personal growth where insights become measurable action.

## 3. Scope

U'rWay currently spans these core modules:

1. AI Growth Engine
- virtual cluster classification
- personalized roadmap generation from user signals
- fallback-safe generation pipeline

2. Productivity Suite
- onboarding with academic, habit, profile, wellness, and account steps
- target creation and roadmap tracking
- account-based sign-in and session continuity

3. Analytics and Progress Surface
- roadmap status visibility (complete, in-progress, remaining, overdue)
- user-specific dashboard retrieval

4. Extension and Behavior Signals
- browser extension sync for URL and time spent
- AI-site detection and exam policy hooks

## 4. Technical Architecture

### Repository layout

- `frontend/`: React + Vite + TypeScript + Tailwind UI
- `backend/`: Express + Mongoose API and orchestration layer
- `genai-service/`: Python Flask service for Gemini-based generation
- `ml/`: machine learning notebooks and datasets for offline experimentation

### Stack

- Frontend: React, Vite, TypeScript, Framer Motion, React Router
- Backend: Node.js, Express, Mongoose, bcrypt-based credential hashing
- GenAI Service: Flask, google-genai SDK, prompt-based JSON generation
- Database: MongoDB

### Backend layering

- `controller/`: business orchestration and API handlers
- `db/`: database bootstrap
- `middleware/`: CORS, async wrapping, error handling
- `model/`: MongoDB schemas and entities
- `router/`: route mapping

### GenAI layering

- `router/`: API endpoints (`/api/cluster`, `/api/roadmap`, `/api/exam-questions`)
- `service/`: prompt design, model calls, normalization logic
- `model/`: fallback response structures

## 5. Key Product Flows

### A. Onboarding and Account Creation

User completes multi-step onboarding, provides account credentials, and submits a unified profile. Backend stores profile data and credentials securely (hashed).

### B. Personalized Roadmap Generation

1. Backend sends structured profile/target payload to genai-service.
2. GenAI service extracts user signals (goal, timeline, skills, habits, weak areas, extension summary).
3. Gemini produces strict JSON roadmap steps.
4. Service normalizes output and returns stable, render-ready roadmap data.

### C. Sign In and Dashboard Retrieval

User signs in using email/password. Backend verifies hash and returns user identity. Frontend loads dashboard roadmaps for that user.

## 6. API Highlights

### Backend

- `GET /api/health`
- `POST /api/auth/signin`
- `POST /api/onboarding`
- `GET /api/dashboard/:userId`
- `POST /api/targets/:userId`
- `POST /api/exam/start`
- `POST /api/exam/flag/:sessionId`
- `POST /api/extension/sync/:userId`

### GenAI Service

- `GET /api/health`
- `POST /api/cluster`
- `POST /api/roadmap`
- `POST /api/exam-questions`

## 7. Environment Configuration

Create `backend/.env`:

```env
PORT=5000
MONGO_URI=mongodb://localhost:27017/urway
FRONTEND_ORIGIN=http://127.0.0.1:5173
GENAI_SERVICE_URL=http://127.0.0.1:5001
```

Create `genai-service/.env`:

```env
PORT=5001
GEMINI_API_KEY=your_gemini_api_key_here
GEMINI_MODEL=gemini-2.0-flash
BACKEND_ORIGIN=http://127.0.0.1:5000
```

Create `frontend/.env`:

```env
VITE_BACKEND_URL=http://127.0.0.1:5000
```

## 8. Local Development

### Prerequisites

- Node.js 18+
- Python 3.11+
- MongoDB running locally

### Start backend

```powershell
cd backend
npm install
npm run dev
```

### Start genai-service

```powershell
cd genai-service
python -m pip install -r requirements.txt
python app.py
```

### Start frontend

```powershell
cd frontend
npm install
npm run dev
```

## 9. Security Notes

- Never commit `.env` files with real secrets.
- Rotate API keys immediately if exposed.
- Store only hashed passwords (already implemented via bcrypt).
- Keep AI/GenAI secrets on server-side services only.

## 10. Future Roadmap

### Phase 1 (MVP)
- core onboarding, auth, roadmap generation, dashboard

### Phase 2
- advanced behavioral analytics and stronger path adaptation
- richer productivity suite (tasks, habits, focus sessions)

### Phase 3
- optional peer/community benchmarking
- integrations with external learning platforms and calendars

---

U'rWay is built to be an active growth partner: observe, personalize, guide, and adapt.

