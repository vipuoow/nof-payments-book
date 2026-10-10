// 실제 국민카드 문자 형식을 따르되 카드번호·이름·금액·가맹점·누적액은 가상 값이다.

export const APPROVAL = `[Web발신]
KB국민카드1234승인
홍*동님
12,300원 일시불
09/23 08:26
테스트커피 강남역점(메가
누적1,234,567원`;

export const CANCEL = `[Web발신]
KB국민카드1234취소
홍*동님
12,300원 일시불
09/23 08:30
테스트커피 강남역점(메가
누적1,222,267원`;

export const APPROVAL_SMALL = `[Web발신]
KB국민카드1234승인
홍*동님
900원 일시불
09/29 19:58
지에스(GS)25 테스트점
누적1,223,167원`;

export const APPROVAL_INSTALLMENT = `[Web발신]
KB국민카드1234승인
홍*동님
360,000원 3개월
09/27 11:55
테스트가구 부천점
누적1,583,167원`;

export const TRANSIT_NOTICE = `[Web발신]
KB국민카드
후불교통(신용)
10건 45,600원
10/06 결제예정`;

export const UNKNOWN_KB = `[Web발신]
KB국민카드 10월 결제금액 안내
1,234,567원`;

export const NOT_KB = `[Web발신]
[테스트은행] 입금 50,000원`;

export const FOREIGN_APPROVAL = `[Web발신]
KB국민카드1234 해외승인
8.00(USD) 10/02 09:08
미국 typesafe a`;

export const FOREIGN_CANCEL = `[Web발신]
KB국민카드1234 해외취소
8.00(USD) 10/03 10:00
미국 typesafe a`;

export const FOREIGN_WITH_WON = `[Web발신]
KB국민카드1234 해외승인
10,739원 10/02 09:08
미국 typesafe a`;
