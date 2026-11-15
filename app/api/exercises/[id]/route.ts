import { db, fail } from "@/lib/db";

export const dynamic = "force-dynamic";

// Recent sessions for one exercise (newest first). `?exclude=<workoutId>` leaves
// out the workout being edited so the editor can show "last time" numbers.
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const id = Number((await ctx.params).id);
    const exclude = Number(new URL(req.url).searchParams.get("exclude")) || 0;
    const { q } = await db();
    const history = await q(
      `select w.id as workout_id, w.day, w.name,
              json_agg(json_build_object('weight', s.weight, 'reps', s.reps) order by s.position) as sets
       from workout_exercises we
       join workouts w on w.id = we.workout_id
       join workout_sets s on s.workout_exercise_id = we.id
       where we.exercise_id = $1 and w.kind = 'workout' and w.id <> $2 and s.reps > 0
       group by w.id, w.day, w.name, we.id
       order by w.day desc, w.id desc
       limit 12`,
      [id, exclude]
    );
    return Response.json({ history });
  } catch (e) {
    return fail(e);
  }
}

// Only custom exercises that were never logged can be removed.
export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const id = Number((await ctx.params).id);
    const { q } = await db();
    const used = await q(`select 1 from workout_exercises where exercise_id = $1 limit 1`, [id]);
    if (used.length) {
      return Response.json({ error: "This exercise is used in a workout or favourite." }, { status: 409 });
    }
    await q(`delete from exercises where id = $1 and is_custom`, [id]);
    return Response.json({ ok: true });
  } catch (e) {
    return fail(e);
  }
}
