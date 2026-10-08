import { redirect } from "next/navigation";
import { isUuid } from "@/ledger/forms";

/** 예전 주소: 새로 추가는 이제 홈 위에 겹쳐 뜬다 */
export default async function NewTxPage({ searchParams }: PageProps<"/new">) {
  const { raw } = await searchParams;
  redirect(isUuid(raw) ? `/?add=1&raw=${raw}` : "/?add=1");
}
