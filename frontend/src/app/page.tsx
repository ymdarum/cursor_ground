"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type Point = { x: number; y: number };

const BOARD_SIZE = 20;
const INITIAL_SPEED = 160;
const INITIAL_SNAKE: Point[] = [
  {
    x: Math.floor(BOARD_SIZE / 2),
    y: Math.floor(BOARD_SIZE / 2),
  },
];
const INITIAL_DIRECTION: Point = { x: 1, y: 0 };
const SCORE_API = process.env.NEXT_PUBLIC_SCORE_API ?? "http://localhost:8000";

const directionByKey: Record<string, Point> = {
  ArrowUp: { x: 0, y: -1 },
  ArrowDown: { x: 0, y: 1 },
  ArrowLeft: { x: -1, y: 0 },
  ArrowRight: { x: 1, y: 0 },
  w: { x: 0, y: -1 },
  s: { x: 0, y: 1 },
  a: { x: -1, y: 0 },
  d: { x: 1, y: 0 },
};

function getRandomFood(blocked: Point[]): Point {
  // We block coordinates that the snake is currently occupying to avoid spawning onto it.
  const blockedSet = new Set(blocked.map((segment) => `${segment.x}-${segment.y}`));
  const totalCells = BOARD_SIZE * BOARD_SIZE;

  if (blockedSet.size >= totalCells) {
    // This is technically a win state (the board is full), so we just reuse the head.
    return blocked[0] ?? { x: 0, y: 0 };
  }

  let candidate: Point;
  do {
    candidate = {
      x: Math.floor(Math.random() * BOARD_SIZE),
      y: Math.floor(Math.random() * BOARD_SIZE),
    };
  } while (blockedSet.has(`${candidate.x}-${candidate.y}`));

  return candidate;
}

export default function Home() {
  const [snake, setSnake] = useState<Point[]>(INITIAL_SNAKE);
  const [direction, setDirection] = useState<Point>(INITIAL_DIRECTION);
  const [food, setFood] = useState<Point>(() => getRandomFood(INITIAL_SNAKE));
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(0);
  const [tickSpeed, setTickSpeed] = useState(INITIAL_SPEED);
  const [isRunning, setIsRunning] = useState(false);
  const [status, setStatus] = useState<"idle" | "running" | "paused" | "crashed">("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Keeping the high score in a ref lets us compare inside tight loops without re-rendering.
  const highScoreRef = useRef(0);

  const updateRemoteHighScore = useCallback(async (candidate: number) => {
    // We only touch the backend if this run actually beats the known score.
    if (candidate <= highScoreRef.current) {
      return;
    }

    try {
      const response = await fetch(`${SCORE_API}/high-score`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ score: candidate }),
      });

      if (!response.ok) {
        throw new Error("High score API returned a bad response.");
      }

      const payload = (await response.json()) as { highScore?: number };
      const serverHighScore = payload.highScore ?? candidate;

      highScoreRef.current = serverHighScore;
      setHighScore(serverHighScore);
      setErrorMessage(null);
    } catch (error) {
      console.error(error);
      // We keep the warning friendly so beginners immediately know what to fix.
      setErrorMessage(
        "Backend is offline, so scores stay local. Start the Python server to sync highs."
      );
    }
  }, []);

  const handleCrash = useCallback(
    (finalScore: number) => {
      // Pausing the loop before we trigger a state reset keeps the last frame visible.
      setIsRunning(false);
      setStatus("crashed");
      void updateRemoteHighScore(finalScore);
    },
    [updateRemoteHighScore]
  );

  const resetGameState = useCallback(() => {
    // Copying the starting snake avoids shared references between renders.
    const startingSnake = INITIAL_SNAKE.map((segment) => ({ ...segment }));
    setSnake(startingSnake);
    setDirection(INITIAL_DIRECTION);
    setFood(getRandomFood(startingSnake));
    setScore(0);
    setTickSpeed(INITIAL_SPEED);
    setStatus("running");
    setIsRunning(true);
  }, []);

  const pauseGame = useCallback(() => {
    setIsRunning(false);
    setStatus("paused");
  }, []);

  const resumeGame = useCallback(() => {
    setIsRunning(true);
    setStatus("running");
  }, []);

  const changeDirection = useCallback(
    (next: Point) => {
      const isOpposite = next.x === -direction.x && next.y === -direction.y;
      if (isOpposite) {
        // Ignoring 180-degree turns keeps the movement consistent with classic snake.
        return;
      }

      setDirection(next);
    },
    [direction]
  );

  useEffect(() => {
    let cancelled = false;

    const fetchHighScore = async () => {
      try {
        const response = await fetch(`${SCORE_API}/high-score`);
        if (!response.ok) {
          throw new Error("Unable to fetch high score.");
        }

        const payload = (await response.json()) as { highScore?: number };
        if (cancelled) {
          return;
        }

        const initialHighScore = payload.highScore ?? 0;
        highScoreRef.current = initialHighScore;
        setHighScore(initialHighScore);
      } catch (error) {
        console.warn(error);
        setErrorMessage(
          "Start the backend to keep a persistent high score. The game still works without it."
        );
      }
    };

    fetchHighScore();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
      const newDirection = directionByKey[key];

      if (newDirection) {
        event.preventDefault();

        // If the user hits an arrow after losing, we treat it as a quick restart.
        if (status === "idle" || status === "crashed") {
          resetGameState();
        }

        changeDirection(newDirection);
        return;
      }

      if (event.code === "Space") {
        event.preventDefault();
        if (status === "running") {
          pauseGame();
        } else if (status === "paused") {
          resumeGame();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [changeDirection, pauseGame, resetGameState, resumeGame, status]);

  const tick = useCallback(() => {
    let crashed = false;
    let consumedFood = false;
    let nextFoodSpot: Point | null = null;

    setSnake((current) => {
      const head = current[0];
      const nextHead = { x: head.x + direction.x, y: head.y + direction.y };

      const hitWall =
        nextHead.x < 0 || nextHead.y < 0 || nextHead.x >= BOARD_SIZE || nextHead.y >= BOARD_SIZE;

      const hitSelf = current.some(
        (segment) => segment.x === nextHead.x && segment.y === nextHead.y
      );

      if (hitWall || hitSelf) {
        crashed = true;
        return current;
      }

      const newSnake = [nextHead, ...current];
      const ateFood = nextHead.x === food.x && nextHead.y === food.y;

      if (ateFood) {
        consumedFood = true;
        nextFoodSpot = getRandomFood(newSnake);
      } else {
        newSnake.pop();
      }

      return newSnake;
    });

    if (crashed) {
      handleCrash(score);
      return;
    }

    if (consumedFood) {
      setFood(nextFoodSpot ?? getRandomFood([]));
      setScore((prev) => {
        const updatedScore = prev + 1;

        if (updatedScore > highScoreRef.current) {
          highScoreRef.current = updatedScore;
          setHighScore(updatedScore);
          void updateRemoteHighScore(updatedScore);
        }

        return updatedScore;
      });
      setTickSpeed((prev) => Math.max(60, prev - 5));
    }
  }, [direction, food, handleCrash, score, updateRemoteHighScore]);

  useEffect(() => {
    if (!isRunning) {
      return;
    }

    const interval = window.setInterval(tick, tickSpeed);
    return () => window.clearInterval(interval);
  }, [isRunning, tick, tickSpeed]);

  const boardCells = useMemo(() => {
    const snakeKeys = new Set(snake.map((segment) => `${segment.x}-${segment.y}`));
    const head = snake[0] ?? INITIAL_SNAKE[0];
    const headKey = `${head.x}-${head.y}`;

    const cells = [];
    for (let y = 0; y < BOARD_SIZE; y += 1) {
      for (let x = 0; x < BOARD_SIZE; x += 1) {
        const key = `${x}-${y}`;
        let cellClass = "bg-emerald-50";

        if (snakeKeys.has(key)) {
          cellClass = key === headKey ? "bg-emerald-500" : "bg-emerald-400";
        } else if (food.x === x && food.y === y) {
          cellClass = "bg-orange-400";
        }

        cells.push(
          <div
            key={key}
            className={`aspect-square w-full border border-emerald-100 transition-colors duration-150 ${cellClass}`}
          />
        );
      }
    }

    return cells;
  }, [food, snake]);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-emerald-50 to-white p-6 text-slate-900">
      <div className="flex w-full max-w-5xl flex-col gap-6 rounded-3xl bg-white/80 p-8 shadow-2xl shadow-emerald-100 ring-1 ring-emerald-100 backdrop-blur">
        <header className="flex flex-col gap-2 text-center">
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-emerald-500">
            Browser Snake
          </p>
          <h1 className="text-3xl font-bold">Stay alive, collect fruit, beat your best score.</h1>
          <p className="text-base text-slate-600">
            Use arrow keys or WASD to move. Press space to pause, and hit enter or any arrow after
            crashing to restart instantly.
          </p>
        </header>

        <section className="grid gap-6 md:grid-cols-[320px_minmax(0,1fr)]">
          <div className="flex flex-col gap-4 rounded-2xl bg-emerald-900/90 p-5 text-white">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm uppercase tracking-widest text-emerald-200">Score</p>
                <p className="text-4xl font-black">{score}</p>
              </div>
              <div className="text-right">
                <p className="text-sm uppercase tracking-widest text-emerald-200">High</p>
                <p className="text-4xl font-black">{highScore}</p>
              </div>
            </div>

            <div className="rounded-xl bg-white/10 p-4 text-sm leading-relaxed text-emerald-50">
              <p className="font-semibold">Status: {status}</p>
              <p>Speed: {Math.round(1000 / tickSpeed)} cells / sec</p>
              {errorMessage ? <p className="mt-2 text-emerald-200">{errorMessage}</p> : null}
            </div>

            <div className="flex gap-3">
              {status === "running" ? (
                <button
                  type="button"
                  onClick={pauseGame}
                  className="flex-1 rounded-xl bg-white/20 py-2 font-semibold text-white transition hover:bg-white/30"
                >
                  Pause
                </button>
              ) : (
                <button
                  type="button"
                  onClick={status === "paused" ? resumeGame : resetGameState}
                  className="flex-1 rounded-xl bg-emerald-400 py-2 font-semibold text-emerald-950 transition hover:bg-emerald-300"
                >
                  {status === "paused" ? "Resume" : "Start"}
                </button>
              )}

              <button
                type="button"
                onClick={resetGameState}
                className="rounded-xl border border-white/40 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/10"
              >
                Restart
              </button>
            </div>

            <ul className="list-disc space-y-1 pl-5 text-sm text-emerald-100">
              <li>Walls end the run, so plan curves early.</li>
              <li>Every fruit speeds the snake up by 5 ms.</li>
              <li>Backend keeps the high score alive between sessions.</li>
            </ul>
          </div>

          <div className="flex flex-col gap-4">
            <div
              className="grid rounded-2xl bg-slate-900 p-4 shadow-inner"
              style={{
                gridTemplateColumns: `repeat(${BOARD_SIZE}, minmax(0, 1fr))`,
                gap: "2px",
              }}
            >
              {boardCells}
            </div>
            <p className="text-sm text-slate-500">
              Tip: Want a tougher challenge? Lower `INITIAL_SPEED` in `page.tsx` so everything moves
              faster right from the start.
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}
