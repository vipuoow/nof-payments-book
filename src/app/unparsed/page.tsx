import { redirect } from "next/navigation";

/** 예전 주소: 확인할 문자는 이제 홈 위에 겹쳐 뜬다 */
export default function UnparsedPage() {
  redirect("/?inbox=1");
}
