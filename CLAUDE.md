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

## Repository Status - 2025년 7월 30일 8차 업데이트 (상품 관리 RLS 및 UI 개선)

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
   - 지역 데이터: 전국 17개 시/도
   - 매장 카테고리: 전국 229개 구/군/시
   - 샘플 매장: NY베이글 강남역점, NY베이글 삼성점
   - 초기화 스크립트: 
     - `npx tsx scripts/initializeTestData.ts` - 기본 데이터
     - `npx tsx scripts/addSeoulDistricts.ts` - 서울 25개 구
     - `npx tsx scripts/addNationwideLocations.ts` - 전국 지역 데이터

8. **최근 업데이트 (7/30 8차)**
   - QR 출퇴근 대시보드 404 에러 수정
   - 상품 관리 카테고리 모달 추가
   - WCAG 접근성 개선 (폰트 대비)
   - 매장 관리 UI 개선 (시/도, 구/군 레이블)
   - 전국 지역 데이터 추가 (17개 시/도, 229개 구/군/시)
   - 직원 회원가입 매장 선택 UI 개선
   - **데이터베이스 수정**: store_id NULL 문제 해결, 프로필 동기화
   - **코드 품질 개선**: ESLint 설정 추가, TypeScript 엄격 모드
   - **수정 스크립트 추가**: `npm run fix:all` 명령어로 일괄 수정

9. **상품 관리 시스템 개선 (7/30 8차 업데이트)**
   - **RLS 정책 정리**: products, product_categories 테이블의 중복된 정책 제거
   - **데이터 무결성**: NULL category_id 문제 해결, 기본 카테고리 할당
   - **UI 개선**: 카테고리 관리 모달 폰트 색상 개선 (가독성 향상)
   - **빌드 안정성**: ESLint 설정 간소화, QRScanner TypeScript 오류 수정
   - **배포 완료**: GitHub 푸시 후 Vercel 자동 배포

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
- **수정 사항 요약**: `/FIX_SUMMARY.md` ✨ NEW!


## MCP
- Brave search : Search for 'React useEffect dependency array best practices' using brave search
# important-instruction-reminders
Do what has been asked; nothing more, nothing less.
NEVER create files unless they're absolutely necessary for achieving your goal.
ALWAYS prefer editing an existing file to creating a new one.
NEVER proactively create documentation files (*.md) or README files. Only create documentation files if explicitly requested by the User.