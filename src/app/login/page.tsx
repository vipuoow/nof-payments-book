import { errorMessage } from "@/auth/messages";
import { GoogleButton } from "@/components/landing/google-button";
import { Landing } from "@/components/landing/landing";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return (
    <Landing error={error ? errorMessage(error) : undefined}>
      <GoogleButton next="/" label="Google로 시작하기" />
      <p className="text-center text-xs text-white/75">처음이라면 가족에게 받은 초대 링크로 들어와 주세요.</p>
    </Landing>
  );
}
