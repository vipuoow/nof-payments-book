const MESSAGES: Record<string, string> = {
  not_authenticated: "로그인이 필요합니다.",
  not_allowed: "권한이 없습니다.",
  name_required: "닉네임을 입력해 주세요.",
  name_too_long: "닉네임은 10자까지 쓸 수 있어요.",
  invite_invalid: "초대 링크가 올바르지 않습니다.",
  invite_used: "이미 사용된 초대 링크입니다.",
  invite_expired: "초대 링크가 만료되었습니다. 새 링크를 요청해 주세요.",
  invite_revoked: "취소된 초대 링크입니다.",
  service_full: "서비스 가입 인원이 가득 찼습니다.",
  group_full: "그룹 인원이 가득 찼습니다.",
  already_in_group: "이미 그룹에 속해 있습니다.",
  not_in_group: "먼저 그룹에 가입해야 합니다.",
  login_failed: "Google 로그인에 실패했습니다. 다시 시도해 주세요.",
  no_profile: "초대받은 링크로 가입을 마쳐 주세요. 초대 링크가 없다면 가족이나 운영자에게 요청하세요.",
};

const DB_ERROR_CODES = new Set([
  "not_authenticated", "not_allowed", "name_required", "name_too_long", "invite_invalid", "invite_used",
  "invite_expired", "invite_revoked", "service_full", "group_full", "already_in_group", "not_in_group",
]);

export function errorMessage(code: string): string {
  return MESSAGES[code] ?? "문제가 발생했습니다. 다시 시도해 주세요.";
}

/** DB 함수가 raise한 예외 메시지가 알려진 오류 코드면 그 코드를, 아니면 null */
export function rpcErrorCode(error: { message: string }): string | null {
  return DB_ERROR_CODES.has(error.message) ? error.message : null;
}
