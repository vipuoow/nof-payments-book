import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { join } from "node:path";
import { Readable } from "node:stream";
import type { NextRequest } from "next/server";
import { MEDIA_FILES, mediaDir, parseRange } from "@/lib/media";

/**
 * 처음 화면 배경 영상(landing.mp4)과 멈춘 그림(landing.jpg). 휴대폰이 필요한 부분만 받도록 Range를 지원한다.
 * 주소에 ?v=<수정 시각>을 붙여 부르므로 오래 캐시해도 파일을 바꾸면 새로 받는다.
 */
export async function GET(request: NextRequest, ctx: RouteContext<"/media/[file]">) {
  const { file } = await ctx.params;
  const type = MEDIA_FILES[file];
  if (!type) return new Response("없는 파일이에요.", { status: 404 });

  const path = join(mediaDir(), file);
  let size: number;
  try {
    size = (await stat(path)).size;
  } catch {
    return new Response("없는 파일이에요.", { status: 404 });
  }

  const headers = new Headers({
    "Content-Type": type,
    "Accept-Ranges": "bytes",
    "Cache-Control": request.nextUrl.searchParams.has("v") ? "public, max-age=31536000, immutable" : "public, max-age=300",
  });
  const range = parseRange(request.headers.get("range"), size);
  if (range === "invalid") {
    headers.set("Content-Range", `bytes */${size}`);
    return new Response(null, { status: 416, headers });
  }
  const { start, end } = range ?? { start: 0, end: size - 1 };
  headers.set("Content-Length", String(end - start + 1));
  if (range) headers.set("Content-Range", `bytes ${start}-${end}/${size}`);
  const body = Readable.toWeb(createReadStream(path, { start, end })) as ReadableStream;
  return new Response(body, { status: range ? 206 : 200, headers });
}
