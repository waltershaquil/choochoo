import { db, fail } from "@/lib/db";

export const dynamic = "force-dynamic";

// GET /api/progress?from=YYYY-MM-DD
// Volume (kg × reps) and logged sets per day and muscle; the client groups them into weeks.
export async function GET(req: Request) {
  try {
    const from = new URL(req.url).searchParams.get("from") || "0000-00-00";
    const { q } = await db();
    return Response.json(
      await q(
        `select w.day, e.muscle,
                sum(coalesce(s.weight, 0) * s.reps)::float8 as volume,
                count(*)::int as sets
         from choochoo.workouts w
         join choochoo.workout_exercises we on we.workout_id = w.id
         join choochoo.exercises e on e.id = we.exercise_id
         join choochoo.workout_sets s on s.workout_exercise_id = we.id
         where w.kind = 'workout' and s.reps > 0 and w.day >= $1
         group by w.day, e.muscle`,
        [from]
      )
    );
  } catch (e) {
    return fail(e);
  }
}
