import { redirect } from "next/navigation";

/** 예전 주소: 파트너 초대는 /partner에서 한다 */
export default function GroupPage() {
  redirect("/partner");
}
