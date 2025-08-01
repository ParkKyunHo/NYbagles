# 베이글샵 시스템 테스트 결과

## 테스트 일시: 2025년 7월 27일

### 1. 관리자 계정 생성 ✅
- [x] Supabase에서 관리자 계정 생성 완료
- [x] SQL로 role을 'super_admin'으로 업데이트 완료
- [x] 프로필 데이터 정상 생성 확인

### 2. 로그인 테스트
- [ ] http://localhost:3000 접속
- [ ] 관리자 계정으로 로그인
- [ ] 로그인 성공 여부
- [ ] 대시보드 리다이렉션 확인

### 3. 대시보드 기능 테스트
- [ ] /dashboard 페이지 접근
- [ ] 사이드바 메뉴 표시
- [ ] super_admin 권한 메뉴 표시
  - [ ] Admin 메뉴
  - [ ] 매장 관리
  - [ ] 직원 관리

### 4. QR 코드 시스템 테스트
#### 4.1 매장 QR 코드
- [ ] /admin/stores 페이지 접근
- [ ] 강남역점 QR 코드 표시
- [ ] 삼성점 QR 코드 표시
- [ ] QR 코드 30초 자동 갱신

#### 4.2 QR 스캔 기능
- [ ] /dashboard/attendance/scan 접근
- [ ] 카메라 권한 요청
- [ ] 스캔 UI 표시
- [ ] 스캔 기능 작동

### 5. 직원 관리 테스트
#### 5.1 직원 회원가입
- [ ] 시크릿 모드에서 /signup/employee 접근
- [ ] 매장 코드 입력 (GANGNAM001)
- [ ] 회원가입 폼 작성
- [ ] 이메일 인증

#### 5.2 가입 승인
- [ ] 관리자 계정으로 /admin/signup-requests 접근
- [ ] 가입 요청 목록 표시
- [ ] 승인/거절 버튼 작동

### 6. 출퇴근 기록 테스트
- [ ] 직원 QR 코드 생성
- [ ] QR 스캔으로 출근 기록
- [ ] QR 스캔으로 퇴근 기록
- [ ] 근무 시간 계산

## 발견된 이슈

### 이슈 1: [제목]
- **설명**: 
- **재현 방법**: 
- **예상 원인**: 
- **해결 방법**: 

## 다음 개발 우선순위

1. [ ] 발견된 이슈 수정
2. [ ] 스케줄 관리 시스템 구현
3. [ ] 급여 계산 자동화
4. [ ] 매출 입력 기능

## 테스트 환경
- **브라우저**: 
- **OS**: 
- **개발 서버**: localhost:3000
- **Supabase**: Production