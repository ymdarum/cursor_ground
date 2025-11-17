"""FastAPI service that stores a simple in-memory snake high score."""
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel


app = FastAPI(
    title="Snake Score Service",
    description="Stores the best score that the browser game reports.",
    version="1.0.0",
)

# We keep only one number in memory because the project focuses on the frontend game.
high_score: int = 0


class ScorePayload(BaseModel):
    """Payload used when the client tries to record a score."""

    score: int


# Allow the Next.js dev server to call this API during local development.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In-memory data only, so wide-open CORS keeps the setup simple.
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health() -> dict[str, str]:
    """Simple readiness probe to make debugging easier."""

    return {"status": "ok"}


@app.get("/high-score")
def read_high_score() -> dict[str, int]:
    """Return the best score we have recorded so far."""

    return {"highScore": high_score}


@app.post("/high-score")
def update_high_score(payload: ScorePayload) -> dict[str, int]:
    """Update the stored high score only when the new score is better."""

    if payload.score < 0:
        raise HTTPException(status_code=400, detail="Score must be 0 or higher.")

    global high_score
    if payload.score > high_score:
        high_score = payload.score

    return {"highScore": high_score}
