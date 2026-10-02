export const dynamic = "force-dynamic";

/** 배포 확인용. DB를 부르지 않고 빌드한 커밋만 알려 준다. */
export function GET(): Response {
  const sha = process.env.GIT_SHA;
  return Response.json(
    { ok: true, version: sha ? sha.slice(0, 7) : "dev" },
    { headers: { "cache-control": "no-store" } },
  );
}
