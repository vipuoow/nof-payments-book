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
  console.log("PASS backup init");
  const cmd = c.services.cloudflared.command || [];
  const i = cmd.indexOf("--url");
  if (i < 0 || cmd[i + 1] !== "http://app:3000") { console.error("FAIL cloudflared 연결 대상", cmd); process.exit(1); }
  console.log("PASS cloudflared → app:3000");
  // 회사 NAS: 가계부 묶음은 4번째 코어(3)만 쓰고, 서비스마다 메모리 상한(스왑 추가 없음)을 둔다
  const mem = { app: 512, cloudflared: 256, watchtower: 128, backup: 256 };
  for (const [name, mb] of Object.entries(mem)) {
    const svc = c.services[name];
    const limit = Number(svc.mem_limit), swap = Number(svc.memswap_limit);
    if (svc.cpuset !== "3") { console.error("FAIL 코어 지정", name, svc.cpuset); process.exit(1); }
    if (limit !== mb * 1024 * 1024 || swap !== limit) { console.error("FAIL 메모리 상한", name, svc.mem_limit, svc.memswap_limit); process.exit(1); }
  }
  console.log("PASS 코어 지정·메모리 상한");'
