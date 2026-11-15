import { WORKOUT_SELECT, cleanWorkout, db, fail, writeBody } from "@/lib/db";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  try {
    const id = Number((await ctx.params).id);
    const { q } = await db();
    const rows = await q(`${WORKOUT_SELECT} where w.id = $1`, [id]);
    if (!rows.length) return Response.json({ error: "Not found" }, { status: 404 });
    return Response.json(rows[0]);
  } catch (e) {
    return fail(e);
  }
}

// Saves the whole workout (name, date, exercises, sets). Works the same for
// in-progress and finished workouts, so past sessions stay editable.
export async function PUT(req: Request, ctx: Ctx) {
  try {
    const id = Number((await ctx.params).id);
    const w = cleanWorkout(await req.json());
    const { tx } = await db();
    const found = await tx(async (q) => {
      const rows = await q(
        `update choochoo.workouts set name = $2, day = case when kind = 'workout' and $3 = '' then day else $3 end, finished = $4
         where id = $1 returning id`,
        [id, w.name, w.day, w.finished]
      );
      if (!rows.length) return false;
      await writeBody(q, id, w);
      return true;
    });
    if (!found) return Response.json({ error: "Not found" }, { status: 404 });
    return Response.json({ ok: true });
  } catch (e) {
    return fail(e);
  }
}

export async function DELETE(_req: Request, ctx: Ctx) {
  try {
    const id = Number((await ctx.params).id);
    const { q } = await db();
    await q(`delete from choochoo.workouts where id = $1`, [id]);
    return Response.json({ ok: true });
  } catch (e) {
    return fail(e);
  }
}
