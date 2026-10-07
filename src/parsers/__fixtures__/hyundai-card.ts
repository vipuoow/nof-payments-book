// 실제 현대카드 문자 형식을 따르되 이름·금액·가맹점·누적액은 가상 값이다.

export const APPROVAL = `[Web발신]
현대 ZERO 승인
홍*동
2,600원 일시불
10/07 16:45
테스트편의점 여의도점
누적2,600원`;

export const CANCEL = `[Web발신]
현대 ZERO 취소
홍*동
2,600원 일시불
10/07 16:50
테스트편의점 여의도점
누적0원`;

export const APPROVAL_OTHER_CARD = `[Web발신]
현대카드 M 승인
홍*동
45,000원 일시불
10/05 12:10
테스트식당
누적47,600원`;

export const APPROVAL_INSTALLMENT = `[Web발신]
현대 ZERO 승인
홍*동
360,000원 3개월
10/03 11:55
테스트가구 부천점
누적407,600원`;

export const UNKNOWN_HYUNDAI = `[Web발신]
현대카드 10월 결제금액 안내
1,234,567원`;

export const NOT_HYUNDAI = `[Web발신]
현대테스트해상 보험료 50,000원 출금 예정`;
