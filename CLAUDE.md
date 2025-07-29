# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Important Notes

- Always check for existing patterns before implementing new features
- 한글로 답변하세요
- 날짜와 시간은 대한민국 시간을 따르도록 하세요.
- Follow the established code style and conventions
- Update this file as the codebase evolves
- Don't stop reading code until understanding perfect
- Before fixing and making new code, Find existing code first
- Fix a code, step by step

## Repository Status - 2025년 7월 29일 업데이트 (프로덕션 배포 완료)

베이글샵 통합 관리 시스템이 프로덕션에 배포되었습니다.

### 🚀 배포 정보
- **프로덕션 사이트**: Vercel에 배포 완료
- **GitHub**: https://github.com/ParkKyunHo/NYbagles.git
- **자동 배포**: main 브랜치 푸시 시 자동 배포

### 현재 구현된 기능
1. **QR 로그인 시스템**
   - 매장별 고유 QR 코드 (30초마다 자동 갱신)
   - TOTP 기반 보안 토큰
   - 직원 회원가입 승인 프로세스
   - 계층적 권한 관리 (super_admin → admin → manager → employee)
   - QR 스캐너 페이지 구현 완료

2. **인프라 시스템**
   - 중앙집중식 에러 핸들링
   - Rate Limiting 미들웨어
   - CORS 및 보안 헤더
   - 구조화된 로깅 시스템
   - Seed 스크립트 (초기 데이터)

3. **데이터베이스 구조**
   - 지역(regions) → 매장 카테고리(store_categories) → 매장(stores) 계층 구조
   - QR 토큰 관리 및 검증 시스템
   - 직원 회원가입 요청 관리
   - 문서 스토리지 지원 (문서 만료 알림 시스템)

4. **급여 관리 시스템** (7/29 구현)
   - 간소화된 시급 × 시간 계산
   - 직원별 시급 설정
   - 자동 근무시간 집계
   - 월별 급여 조회 (/dashboard/salary)

5. **페이지 구현 완료**
   - 회원가입 선택 페이지 (/signup)
   - 출퇴근 메인 페이지 (/dashboard/attendance)
   - QR 스캔 페이지 (/dashboard/attendance/scan)
   - 직원 대시보드 개선 (출퇴근 상태 표시)
   - 급여 관리 페이지 (/dashboard/salary)
   - 판매 관리 시스템 (/dashboard/sales)
   - 직원 관리 시스템 (/dashboard/employees)

6. **브랜딩 및 디자인**
   - 뉴욕러브 베이글 브랜드 컬러 적용 (노란색 #FDB813)
   - 반응형 디자인 최적화
   - 모바일 우선 UI/UX

7. **초기 데이터 생성 완료**
   - 지역 데이터: 서울, 경기, 부산
   - 매장 카테고리: 강남구, 종로구, 마포구
   - 샘플 매장: NY베이글 강남역점, NY베이글 삼성점
   - 초기화 스크립트: `npx tsx scripts/initializeTestData.ts`

### 프로젝트 현황
- **Phase 1 완료**: 시스템 안정화, 급여 시스템, 배포
- **Phase 2 진행중**: 알림 시스템, 백업/복구, 문서 관리 UI
- **상세 현황**: `/PROJECT_STATUS.md` 참조

### 관련 문서
- 프로젝트 현황: `/PROJECT_STATUS.md`
- 다음 작업 목록: `/NEXT_TASKS.md`
- 코드 수정 가이드: `/UPDATE_GUIDE.md` ✨
- 배포 가이드: `/VERCEL_DEPLOYMENT_GUIDE.md` ✨
- 관리자 설정: `/ADMIN_SETUP_GUIDE.md`
- 테스트 결과: `/TEST_RESULTS.md`


## MCP
- Brave search : Search for 'React useEffect dependency array best practices' using brave search
# important-instruction-reminders
Do what has been asked; nothing more, nothing less.
NEVER create files unless they're absolutely necessary for achieving your goal.
ALWAYS prefer editing an existing file to creating a new one.
NEVER proactively create documentation files (*.md) or README files. Only create documentation files if explicitly requested by the User.