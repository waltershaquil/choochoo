import { WORKOUT_SELECT, cleanWorkout, db, fail, writeBody } from "@/lib/db";

export const dynamic = "force-dynamic";

// GET /api/workouts?kind=workout&from=YYYY-MM-DD&to=YYYY-MM-DD
// GET /api/workouts?kind=template
export async function GET(req: Request) {
  try {
    const sp = new URL(req.url).searchParams;
    const { q } = await db();
    if (sp.get("kind") === "template") {
      return Response.json(await q(`${WORKOUT_SELECT} where w.kind = 'template' order by lower(w.name), w.id`));
    }
    const from = sp.get("from") || "0000-00-00";
    const to = sp.get("to") || "9999-99-99";
    return Response.json(
      await q(
        `${WORKOUT_SELECT} where w.kind = 'workout' and w.day >= $1 and w.day <= $2 order by w.day desc, w.id desc limit 400`,
        [from, to]
      )
    );
  } catch (e) {
    return fail(e);
  }
}

export async function POST(req: Request) {
  try {
    const w = cleanWorkout(await req.json());
    if (w.kind === "workout" && !w.day) return Response.json({ error: "A workout needs a date." }, { status: 400 });
    const { tx } = await db();
    const id = await tx(async (q) => {
      const [row] = await q(
        `insert into workouts (kind, name, day, finished) values ($1, $2, $3, $4) returning id`,
        [w.kind, w.name, w.day, w.finished]
      );
      await writeBody(q, Number(row.id), w);
      return Number(row.id);
    });
    return Response.json({ id });
  } catch (e) {
    return fail(e);
  }
}
