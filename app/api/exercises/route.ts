import { db, fail } from "@/lib/db";
import { MUSCLES } from "@/lib/seed";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const { q } = await db();
    return Response.json(await q(`select id, name, muscle, equipment, is_custom from choochoo.exercises order by name`));
  } catch (e) {
    return fail(e);
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const name = String(body?.name ?? "").trim().slice(0, 80);
    const muscle = String(body?.muscle ?? "");
    const equipment = String(body?.equipment ?? "").trim().slice(0, 40);
    if (!name) return Response.json({ error: "Give the exercise a name." }, { status: 400 });
    if (!(MUSCLES as readonly string[]).includes(muscle)) {
      return Response.json({ error: "Pick a muscle group." }, { status: 400 });
    }
    const { q } = await db();
    const rows = await q(
      `insert into choochoo.exercises (name, muscle, equipment, is_custom) values ($1, $2, $3, true)
       on conflict (name) do nothing returning id, name, muscle, equipment, is_custom`,
      [name, muscle, equipment]
    );
    if (!rows.length) return Response.json({ error: "An exercise with that name already exists." }, { status: 409 });
    return Response.json(rows[0]);
  } catch (e) {
    return fail(e);
  }
}
