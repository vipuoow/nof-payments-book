import { redirect } from "next/navigation";

/** 예전 주소: 가계부 만들기는 홈(가계부가 없을 때)에서 한다 */
export default function NewGroupPage() {
  redirect("/");
}
