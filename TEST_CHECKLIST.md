# 베이글샵 시스템 테스트 체크리스트

## 1. 관리자 계정 테스트 ✅
- [ ] Supabase에서 관리자 계정 생성
- [ ] SQL로 role을 'super_admin'으로 업데이트
- [ ] 로그인 테스트 (http://localhost:3000)

## 2. 대시보드 기능 테스트
- [ ] 대시보드 페이지 접근 (/dashboard)
- [ ] 사이드바 메뉴 표시 확인
- [ ] 권한별 메뉴 표시 검증

## 3. QR 코드 시스템 테스트
### 3.1 매장 QR 코드
- [ ] 매장 목록 페이지 접근 (/admin/stores)
- [ ] 매장별 QR 코드 표시 확인
- [ ] 30초마다 자동 갱신 확인

### 3.2 QR 스캔 기능
- [ ] QR 스캔 페이지 접근 (/dashboard/attendance/scan)
- [ ] 카메라 권한 요청 확인
- [ ] 테스트 QR 코드 스캔

## 4. 직원 관리 테스트
### 4.1 직원 회원가입
- [ ] 회원가입 페이지 접근 (/signup/employee)
- [ ] 매장 코드 입력 (GANGNAM001)
- [ ] 이메일 인증 프로세스

### 4.2 가입 승인
- [ ] 관리자로 로그인
- [ ] 가입 요청 목록 확인 (/admin/signup-requests)
- [ ] 승인/거절 기능 테스트

## 5. 출퇴근 기록 테스트
- [ ] 직원 QR 코드 생성
- [ ] QR 스캔으로 출근 기록
- [ ] QR 스캔으로 퇴근 기록
- [ ] 근무 시간 자동 계산 확인

## 테스트 계정 정보

### Super Admin
- Email: admin@nylovebagel.com
- Password: Admin123!@#

### 테스트 매장
- 강남역점: GANGNAM001
- 삼성점: SAMSUNG001

### 테스트 직원 (생성 예정)
- Manager: manager@nybalges.com
- Employee: employee1@nybalges.com
- Part-time: parttime1@nybalges.com