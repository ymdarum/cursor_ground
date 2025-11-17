# Browser Snake Game

This repository hosts a tiny full-stack playground: a modern Next.js front end that renders a classic Snake game and a FastAPI backend that keeps the best score alive between browser sessions. Follow the steps below to get both halves running locally in a few minutes.

## Tech Stack
- Frontend: Next.js (App Router, TypeScript, Tailwind CSS) inside `frontend`
- Backend: FastAPI + Uvicorn inside `backend`

## Prerequisites
- Node.js 18+ and npm
- Python 3.11+ with `pip`

## 1. Backend Setup (Python + FastAPI)
1. `cd backend`
2. (optional but recommended) `python -m venv .venv && source .venv/bin/activate`
3. `pip install -r requirements.txt`
4. Start the API: `uvicorn main:app --reload --port 8000`

The server exposes:
- `GET /health` – quick status check
- `GET /high-score` – returns `{ "highScore": <number> }`
- `POST /high-score` with `{"score": <number>}` – stores the new best score when higher than the current record

> Tip: The frontend expects the API at `http://localhost:8000`. If you change the port/host, set `NEXT_PUBLIC_SCORE_API` before running the Next.js dev server.

## 2. Frontend Setup (Next.js)
1. `cd frontend`
2. Install deps (first run only): `npm install`
3. Run the dev server: `npm run dev`
4. Open `http://localhost:3000`

Controls:
- Arrow keys or WASD to move
- Space to pause/resume
- Hit an arrow (or click Start) after crashing to restart instantly

Every fruit awards one point and speeds the snake up by 5 ms, so the challenge ramps gradually. The score panel shows the live score, the high score returned by the backend, current speed, and any sync warnings (for example, when the backend is offline).

## 3. Verifying Everything Works
1. With both servers running, open the game and hit Start.
2. Eat a fruit to confirm the score increases and the snake speeds up.
3. Let the snake crash; the high score card should keep the best value even after refreshing the page (the backend persists it in memory while running).
4. Stop the backend and crash again—an inline warning will explain that scores now stay local until the service comes back online.

## 4. Linting & Tests
- Frontend lint: `cd frontend && npm run lint`
- Backend uses type-friendly FastAPI models, so no formatter step is required, but feel free to run `ruff`/`black` if you add them later.

## Project Structure
```
frontend/  # Next.js app (snake board, controls, API calls)
backend/   # FastAPI service that stores the best score in memory
README.md  # You're here
```

Feel free to extend either side: add sound effects, persistent storage, or alternative control schemes. The code is deliberately small (<200 LOC per file where possible) and heavily commented so you can learn and tweak confidently. Have fun mastering the snake! 🐍