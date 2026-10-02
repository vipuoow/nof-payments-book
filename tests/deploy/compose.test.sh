#!/bin/sh
set -eu
# :? 필수 값 검사를 통과시키려고 가짜 값을 준다
export SUPABASE_URL=x SUPABASE_SERVICE_ROLE_KEY=x APP_URL=x TUNNEL_TOKEN=x BACKUP_DATABASE_URL=x
docker compose -f deploy/compose.yaml config -q
docker compose -f deploy/compose.yaml config --format json | node -e '
  const c = JSON.parse(require("fs").readFileSync(0, "utf8"));
  const on = Object.entries(c.services)
    .filter(([, s]) => s.labels?.["com.centurylinklabs.watchtower.enable"] === "true").map(([n]) => n);
  if (JSON.stringify(on) !== JSON.stringify(["app"])) { console.error("FAIL watchtower 대상", on); process.exit(1); }
  console.log("PASS watchtower 대상: app");
  if (c.services.backup.init !== true) { console.error("FAIL backup에 init 없음"); process.exit(1); }
  console.log("PASS backup init");'
