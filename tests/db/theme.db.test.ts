import { describe, expect, it } from "vitest";
import { adminClient, createGroupFixture } from "../helpers/db";

const db = adminClient();
const themeOf = async (userId: string) => (await db.from("profiles").select("theme").eq("user_id", userId).single()).data?.theme;

describe("화면 모드(사람마다)", () => {
  it("처음은 기본, 자기 모드만 바꿀 수 있고 정해진 값만 받는다", async () => {
    const g = await createGroupFixture("theme");
    expect(await themeOf(g.owner.userId)).toBe("basic");
    expect((await g.owner.client.from("profiles").update({ theme: "dark" }).eq("user_id", g.owner.userId)).error).toBeNull();
    expect(await themeOf(g.owner.userId)).toBe("dark");
    expect(await themeOf(g.member.userId)).toBe("basic"); // 배우자는 따로
    expect((await g.owner.client.from("profiles").update({ theme: "neon" }).eq("user_id", g.owner.userId)).error).not.toBeNull();
    const other = await g.owner.client.from("profiles").update({ theme: "light" }).eq("user_id", g.member.userId).select("user_id");
    expect(other.data ?? []).toEqual([]);
    expect(await themeOf(g.member.userId)).toBe("basic");
  });
});
