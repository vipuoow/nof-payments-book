import { describe, expect, it } from "vitest";
import { grantOperator } from "@/auth/operator";
import { adminClient } from "../helpers/db";

const admin = adminClient();

describe("grantOperator", () => {
  it("없는 이메일이면 계정·프로필을 만들고 운영자로 지정한다", async () => {
    const email = `Op-${Date.now()}@Test.Local`;
    const userId = await grantOperator(admin, email, "운영자");
    const { data } = await admin.from("profiles").select("display_name, is_operator, can_create_group").eq("user_id", userId).single();
    expect(data).toEqual({ display_name: "운영자", is_operator: true, can_create_group: true });
    const { data: user } = await admin.auth.admin.getUserById(userId);
    expect(user.user?.email).toBe(email.toLowerCase());
  });

  it("이미 있는 계정이면 같은 사용자를 운영자로 바꾼다", async () => {
    const email = `op2-${Date.now()}@test.local`;
    const first = await grantOperator(admin, email, "처음");
    const second = await grantOperator(admin, email, "다시");
    expect(second).toBe(first);
  });
});
