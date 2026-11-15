import { EXERCISES, MUSCLES } from "./seed";

export type Q = (text: string, params?: unknown[]) => Promise<any[]>;

type Driver = { q: Q; tx: <T>(fn: (q: Q) => Promise<T>) => Promise<T> };

const SUPABASE_REF = "pinryxqaeltjwiipkrdb";

type Conn = { host: string; port: number; user: string; password: string; database: string };

/**
 * Lenient connection-string parser: the password may contain unencoded special
 * characters (@ : / # ...), and stray quotes, a pasted "DATABASE_URL=" prefix or
 * the [brackets] from Supabase's template are ignored.
 */
export function parseConnectionString(raw: string): Conn {
  const s = raw
    .trim()
    .replace(/^DATABASE_URL\s*=\s*/i, "")
    .replace(/^["']|["']$/g, "")
    .trim();
  const m = s.match(/^postgres(?:ql)?:\/\/([^:@/]+)(?::(.*))?@([^@/:?#\s]+)(?::(\d+))?(?:\/([^?#]*))?(?:[?#].*)?$/);
  if (!m) {
    throw new Error(
      "DATABASE_URL is not a valid Postgres connection string. Expected: postgresql://user:password@host:6543/postgres"
    );
  }
  let password = (m[2] ?? "").replace(/^\[(.*)\]$/, "$1");
  try {
    password = decodeURIComponent(password);
  } catch {
    // not URL-encoded: use it as typed
  }
  return { user: decodeURIComponent(m[1]), password, host: m[3], port: Number(m[4] ?? 5432), database: m[5] || "postgres" };
}

function connection(): Conn | null {
  if (process.env.DATABASE_URL?.trim()) return parseConnectionString(process.env.DATABASE_URL);
  const password = process.env.SUPABASE_DB_PASSWORD;
  if (!password) return null;
  const pooler = process.env.SUPABASE_POOLER_HOST?.trim().replace(/^.*@/, "").replace(/[:/].*$/, "");
  return pooler
    ? { host: pooler, port: 6543, user: `postgres.${SUPABASE_REF}`, password, database: "postgres" }
    : { host: `db.${SUPABASE_REF}.supabase.co`, port: 5432, user: "postgres", password, database: "postgres" };
}

async function pgDriver(conn: Conn): Promise<Driver> {
  const { Pool } = await import("pg");
  const pool = new Pool({
    ...conn,
    ssl: { rejectUnauthorized: false },
    max: 3,
    idleTimeoutMillis: 10_000,
    connectionTimeoutMillis: 10_000,
  });
  return {
    q: async (text, params) => (await pool.query(text, params as any[])).rows,
    tx: async (fn) => {
      const client = await pool.connect();
      try {
        await client.query("begin");
        const out = await fn(async (text, params) => (await client.query(text, params as any[])).rows);
        await client.query("commit");
        return out;
      } catch (e) {
        await client.query("rollback").catch(() => {});
        throw e;
      } finally {
        client.release();
      }
    },
  };
}

// Local development fallback: embedded Postgres, no setup needed.
async function pgliteDriver(): Promise<Driver> {
  const { PGlite } = await import("@electric-sql/pglite");
  const db = new PGlite("./.pglite");
  return {
    q: async (text, params) => (await db.query(text, params as any[])).rows,
    tx: (fn) => db.transaction((t) => fn(async (text, params) => (await t.query(text, params as any[])).rows)) as any,
  };
}

const SCHEMA = [
  // Own schema, so the app never collides with tables already in the database.
  `create schema if not exists choochoo`,
  `create table if not exists choochoo.exercises (
    id serial primary key,
    name text not null unique,
    muscle text not null,
    equipment text not null default '',
    is_custom boolean not null default false
  )`,
  // kind = 'workout' (a logged session) or 'template' (a favourite)
  `create table if not exists choochoo.workouts (
    id serial primary key,
    kind text not null default 'workout',
    name text not null default '',
    day text not null default '',
    finished boolean not null default false,
    created_at timestamptz not null default now()
  )`,
  `create table if not exists choochoo.workout_exercises (
    id serial primary key,
    workout_id integer not null references choochoo.workouts(id) on delete cascade,
    exercise_id integer not null references choochoo.exercises(id),
    position integer not null
  )`,
  `create table if not exists choochoo.workout_sets (
    id serial primary key,
    workout_exercise_id integer not null references choochoo.workout_exercises(id) on delete cascade,
    position integer not null,
    weight double precision,
    reps integer
  )`,
  `create index if not exists workouts_kind_day on choochoo.workouts(kind, day)`,
  `create index if not exists workout_exercises_workout on choochoo.workout_exercises(workout_id)`,
  `create index if not exists workout_exercises_exercise on choochoo.workout_exercises(exercise_id)`,
  `create index if not exists workout_sets_we on choochoo.workout_sets(workout_exercise_id)`,
];

async function init(): Promise<Driver> {
  const conn = connection();
  if (!conn && process.env.VERCEL) {
    throw new Error("No database configured: set DATABASE_URL (or SUPABASE_DB_PASSWORD) in the Vercel project settings.");
  }
  const driver = conn ? await pgDriver(conn) : await pgliteDriver();
  for (const stmt of SCHEMA) await driver.q(stmt);

  // Seed the exercise library (idempotent, new entries appear on redeploy).
  const rows: unknown[] = [];
  const values: string[] = [];
  for (const muscle of MUSCLES) {
    for (const [name, equipment] of EXERCISES[muscle]) {
      const i = rows.length;
      values.push(`($${i + 1}, $${i + 2}, $${i + 3})`);
      rows.push(name, muscle, equipment);
    }
  }
  await driver.q(
    `insert into choochoo.exercises (name, muscle, equipment) values ${values.join(",")} on conflict (name) do nothing`,
    rows
  );
  return driver;
}

const g = globalThis as unknown as { __db?: Promise<Driver> };

export function db(): Promise<Driver> {
  if (!g.__db) {
    g.__db = init().catch((e) => {
      g.__db = undefined;
      throw e;
    });
  }
  return g.__db;
}

// ---------- workouts ----------

export type SetInput = { weight: number | null; reps: number | null };
export type WorkoutInput = {
  kind: "workout" | "template";
  name: string;
  day: string;
  finished: boolean;
  exercises: { exercise_id: number; sets: SetInput[] }[];
};

export const WORKOUT_SELECT = `
  select w.id, w.kind, w.name, w.day, w.finished,
    coalesce((
      select json_agg(json_build_object(
        'exercise_id', we.exercise_id, 'name', e.name, 'muscle', e.muscle,
        'sets', coalesce((
          select json_agg(json_build_object('weight', s.weight, 'reps', s.reps) order by s.position)
          from choochoo.workout_sets s where s.workout_exercise_id = we.id
        ), '[]'::json)
      ) order by we.position)
      from choochoo.workout_exercises we join choochoo.exercises e on e.id = we.exercise_id
      where we.workout_id = w.id
    ), '[]'::json) as exercises
  from choochoo.workouts w`;

const num = (v: unknown) => (v === null || v === undefined || v === "" || !isFinite(Number(v)) ? null : Number(v));

export function cleanWorkout(body: any): WorkoutInput {
  const day = typeof body?.day === "string" && /^\d{4}-\d{2}-\d{2}$/.test(body.day) ? body.day : "";
  return {
    kind: body?.kind === "template" ? "template" : "workout",
    name: String(body?.name ?? "").slice(0, 80),
    day,
    finished: !!body?.finished,
    exercises: (Array.isArray(body?.exercises) ? body.exercises : [])
      .filter((x: any) => Number.isInteger(Number(x?.exercise_id)))
      .map((x: any) => ({
        exercise_id: Number(x.exercise_id),
        sets: (Array.isArray(x.sets) ? x.sets : []).map((s: any) => {
          const reps = num(s?.reps);
          return { weight: num(s?.weight), reps: reps === null ? null : Math.round(reps) };
        }),
      })),
  };
}

/** Replaces the exercises and sets of a workout inside a transaction. */
export async function writeBody(q: Q, workoutId: number, w: WorkoutInput) {
  await q(`delete from choochoo.workout_exercises where workout_id = $1`, [workoutId]);
  if (!w.exercises.length) return;

  const exParams: unknown[] = [workoutId];
  const exValues = w.exercises.map((x, i) => {
    exParams.push(x.exercise_id, i);
    return `($1, $${exParams.length - 1}, $${exParams.length})`;
  });
  const inserted = await q(
    `insert into choochoo.workout_exercises (workout_id, exercise_id, position) values ${exValues.join(",")} returning id, position`,
    exParams
  );
  const idByPos = new Map<number, number>(inserted.map((r) => [Number(r.position), Number(r.id)]));

  const setParams: unknown[] = [];
  const setValues: string[] = [];
  w.exercises.forEach((x, i) =>
    x.sets.forEach((s, j) => {
      const n = setParams.length;
      setValues.push(`($${n + 1}, $${n + 2}, $${n + 3}, $${n + 4})`);
      setParams.push(idByPos.get(i), j, s.weight, s.reps);
    })
  );
  if (setValues.length) {
    await q(
      `insert into choochoo.workout_sets (workout_exercise_id, position, weight, reps) values ${setValues.join(",")}`,
      setParams
    );
  }
}

export function fail(e: unknown) {
  console.error(e);
  return Response.json({ error: e instanceof Error ? e.message : "Server error" }, { status: 500 });
}
