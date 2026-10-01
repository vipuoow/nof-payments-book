import { errorMessage } from "@/auth/messages";
import { signInWithGoogle } from "./actions";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return (
    <main className="mx-auto max-w-sm p-6">
      <h1 className="mb-4 text-xl font-bold">로그인</h1>
      {error && <p className="mb-3 text-red-600">{errorMessage(error)}</p>}
      <form action={signInWithGoogle.bind(null, "/")}>
        <button className="w-full rounded border p-2">Google로 로그인</button>
      </form>
      <p className="mt-4 text-sm text-gray-500">처음이라면 받은 초대 링크에서 가입하세요.</p>
    </main>
  );
}
