import { db, fail } from "@/lib/db";

export const dynamic = "force-dynamic";

// Hit once a day by Vercel Cron (see vercel.json) so the Supabase project
// always has recent activity and is never paused for being idle.
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get("authorization") !== `Bearer ${secret}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const { q } = await db();
    const [row] = await q(
      `select (select count(*)::int from exercises) as exercises,
              (select count(*)::int from workouts where kind = 'workout') as workouts,
              now() as checked_at`
    );
    return Response.json({ ok: true, ...row });
  } catch (e) {
    return fail(e);
  }
}
