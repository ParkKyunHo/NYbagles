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

## Repository Status - 2025년 8월 7일 최신 업데이트

베이글샵 통합 관리 시스템이 프로덕션에 배포되었습니다.

### 🚀 배포 정보
- **프로덕션 사이트**: Vercel에 배포 완료
- **GitHub**: https://github.com/ParkKyunHo/NYbagles.git
- **자동 배포**: main 브랜치 푸시 시 자동 배포

### 📊 시스템 아키텍처

#### 메인 시스템 테이블
- **products_v3**: 메인 상품 관리 시스템 (핵심!)
- **sales_transactions / sales_items**: 판매 트랜잭션 관리
- **product_changes**: 상품 변경 승인 워크플로우
- **inventory_movements**: 재고 이동 추적

#### 권한 시스템
- super_admin: 전체 시스템 관리
- admin: 전체 매장 관리
- manager: 단일 매장 관리
- employee: 판매 및 기본 업무
- part_time: 파트타임 직원

### 🔧 최근 해결된 이슈 (2025년 8월 7일)

1. **직원 관리 페이지 문제 해결**
   - profiles RLS 정책 수정 (infinite recursion 오류 해결)
   - 관리자/매니저가 소속 직원 프로필 조회 가능하도록 수정
   - 중앙집중식 인증 훅 (useAuthCheck) 구현

2. **대시보드 접근 문제 해결**
   - 88개 파일의 분산된 인증 로직을 통합
   - 일관된 권한 체크 시스템 구현
   - 각 페이지별 역할 기반 접근 제어

3. **배포 이슈 해결**
   - useEffect 의존성 배열 경고 수정
   - TypeScript 타입 오류 해결
   - 빌드 성공 및 Vercel 배포 완료

### 📁 핵심 파일 위치

#### 인증 및 권한
- `/hooks/useAuthCheck.ts` - 중앙집중식 인증 훅
- `/lib/supabase/client.ts` - Supabase 클라이언트

#### 주요 페이지
- `/app/(dashboard)/dashboard/employees/page.tsx` - 직원 관리
- `/app/(dashboard)/sales/simple/page.tsx` - 간편 판매
- `/app/(dashboard)/products/v2/page.tsx` - 상품 관리
- `/app/(dashboard)/products/approvals/page.tsx` - 상품 승인

#### 데이터베이스
- `/supabase/migrations/` - 모든 마이그레이션 파일
- 최신 RLS 정책: 20250807_fix_profiles_rls.sql

### 🛠️ 개발 가이드

#### 로컬 개발
```bash
npm install
npm run dev
```

#### 빌드 테스트
```bash
npm run build
npm run lint
```

#### 배포
```bash
git add -A
git commit -m "fix: 설명"
git push origin main
# Vercel 자동 배포
```

### ⚠️ 주의사항

1. **상품 시스템**: products_v3가 메인 시스템입니다
2. **RLS 정책**: profiles 테이블 정책 수정 시 순환 참조 주의
3. **인증**: useAuthCheck 훅 사용 권장
4. **타입 안전성**: TypeScript strict mode 활성화됨

### 📝 TODO

- [ ] useEffect 의존성 경고 완전 제거
- [ ] 알림 시스템 구현
- [ ] 백업/복구 시스템 구현
- [ ] 성능 최적화

### 🔗 관련 문서
- README.md - 프로젝트 개요 및 설치 가이드
- PROJECT_STATUS.md - 상세 프로젝트 현황