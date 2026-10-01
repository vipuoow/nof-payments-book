/** 문자를 줄 단위로 정리한다: CRLF·앞뒤 공백·빈 줄·`[Web발신]` 머리말을 없앤다. */
export function smsLines(body: string): string[] {
  return body
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l !== "" && l !== "[Web발신]");
}
