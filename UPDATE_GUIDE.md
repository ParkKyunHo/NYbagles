# 코드 수정 및 업데이트 가이드

이 문서는 베이글샵 관리 시스템의 코드 수정 및 자동 배포 프로세스를 안내합니다.

## 📋 목차
- [로컬 개발 환경 설정](#로컬-개발-환경-설정)
- [코드 수정 워크플로우](#코드-수정-워크플로우)
- [Git 브랜치 전략](#git-브랜치-전략)
- [자동 배포 프로세스](#자동-배포-프로세스)
- [환경별 관리](#환경별-관리)
- [롤백 및 핫픽스](#롤백-및-핫픽스)
- [모니터링 및 로그](#모니터링-및-로그)

## 로컬 개발 환경 설정

### 1. 프로젝트 클론
```bash
git clone https://github.com/ParkKyunHo/NYbagles.git
cd NYbagles
```

### 2. 의존성 설치
```bash
npm install
```

### 3. 환경 변수 설정
`.env.local` 파일 생성:
```env
NEXT_PUBLIC_SUPABASE_URL=https://zkvvgohssysenjiitevc.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

### 4. 개발 서버 실행
```bash
npm run dev
# http://localhost:3000에서 확인
```

## 코드 수정 워크플로우

### 1. 단순 수정 (버그 수정, 작은 개선)
```bash
# 1. 최신 코드 가져오기
git pull origin main

# 2. 코드 수정
# 예: components/ui/button.tsx 수정

# 3. 변경사항 확인
git status
git diff

# 4. 스테이징 및 커밋
git add .
git commit -m "fix: 버튼 클릭 이벤트 버그 수정"

# 5. 푸시 (자동 배포 시작)
git push origin main
```

### 2. 새 기능 개발
```bash
# 1. 기능 브랜치 생성
git checkout -b feature/employee-export

# 2. 개발 진행
# 여러 커밋으로 나누어 작업

# 3. 푸시
git push origin feature/employee-export

# 4. Pull Request 생성 (GitHub에서)
# 프리뷰 URL로 테스트

# 5. main 브랜치에 병합
git checkout main
git pull origin main
git merge feature/employee-export
git push origin main
```

### 커밋 메시지 규칙
```
feat: 새로운 기능 추가
fix: 버그 수정
docs: 문서 수정
style: 코드 포맷팅, 세미콜론 누락 등
refactor: 코드 리팩토링
test: 테스트 코드 추가
chore: 빌드 작업, 패키지 매니저 설정 등
```

## Git 브랜치 전략

### 브랜치 구조
- `main`: 프로덕션 브랜치 (자동 배포)
- `feature/*`: 새 기능 개발
- `fix/*`: 버그 수정
- `hotfix/*`: 긴급 수정

### 브랜치별 배포
| 브랜치 | 배포 환경 | URL 패턴 |
|--------|-----------|----------|
| main | Production | nybagles.vercel.app |
| feature/* | Preview | nybagles-feature-xxx.vercel.app |
| fix/* | Preview | nybagles-fix-xxx.vercel.app |

## 자동 배포 프로세스

### GitHub → Vercel 자동화
1. **코드 푸시**: GitHub에 코드 푸시
2. **Vercel 감지**: 변경사항 자동 감지
3. **빌드 시작**: 자동 빌드 프로세스
4. **테스트**: 빌드 성공 여부 확인
5. **배포**: 성공 시 자동 배포
6. **알림**: 이메일/Slack 알림

### 배포 시간
- 일반적으로 2-5분
- 대규모 변경 시 최대 10분

### 배포 상태 확인
1. **GitHub**: 커밋 옆 체크/X 표시
2. **Vercel 대시보드**: 실시간 빌드 로그
3. **이메일**: 배포 성공/실패 알림

## 환경별 관리

### 개발 환경
```bash
# 로컬 개발
npm run dev

# 로컬 빌드 테스트
npm run build
npm run start
```

### 스테이징 환경 (Preview)
- 모든 feature 브랜치는 자동으로 Preview URL 생성
- 환경변수는 Vercel에서 자동 상속

### 프로덕션 환경
- main 브랜치만 프로덕션 배포
- 환경변수 변경 시 재배포 필요

## 롤백 및 핫픽스

### 롤백 방법

#### 방법 1: Vercel 대시보드 사용 (권장)
1. Vercel 대시보드 → Deployments
2. 이전 성공한 배포 찾기
3. "..." 메뉴 → "Promote to Production"
4. 즉시 롤백 완료

#### 방법 2: Git Revert 사용
```bash
# 문제가 있는 커밋 찾기
git log --oneline

# Revert 커밋 생성
git revert <commit-hash>
git push origin main
```

### 핫픽스 프로세스
```bash
# 1. 핫픽스 브랜치 생성
git checkout -b hotfix/critical-bug

# 2. 긴급 수정
# 최소한의 변경만 수행

# 3. 테스트
npm run build
npm run test

# 4. 바로 main에 병합
git checkout main
git merge hotfix/critical-bug
git push origin main

# 5. 태그 생성 (선택사항)
git tag -a v1.0.1 -m "Hotfix: Critical bug fix"
git push origin v1.0.1
```

## 모니터링 및 로그

### Vercel 대시보드
1. **Functions 탭**: API 로그 확인
2. **Analytics 탭**: 성능 메트릭
3. **Logs 탭**: 실시간 로그 스트리밍

### 로그 확인 명령어
```bash
# Vercel CLI 설치 (선택사항)
npm i -g vercel

# 로그 확인
vercel logs
```

### 주요 모니터링 지표
- **빌드 시간**: 5분 이내 유지
- **함수 실행 시간**: 10초 이내
- **에러율**: 1% 미만 유지
- **페이지 로드 시간**: 3초 이내

## 문제 해결

### 빌드 실패
1. 로컬에서 `npm run build` 테스트
2. TypeScript 에러 확인
3. 환경변수 설정 확인

### 배포 후 500 에러
1. Vercel Functions 로그 확인
2. Supabase 연결 상태 확인
3. 환경변수 값 검증

### 성능 문제
1. Vercel Analytics 확인
2. 이미지 최적화 (Next.js Image 사용)
3. API 호출 최적화

## 팀 협업

### Pull Request 규칙
1. 기능별로 작은 PR 생성
2. 코드 리뷰 필수
3. 테스트 통과 확인
4. Preview URL에서 동작 확인

### 코드 리뷰 체크리스트
- [ ] 코드 스타일 일관성
- [ ] TypeScript 타입 정의
- [ ] 에러 처리
- [ ] 성능 고려사항
- [ ] 보안 이슈

## 유용한 스크립트

### package.json 스크립트
```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint",
    "type-check": "tsc --noEmit",
    "format": "prettier --write ."
  }
}
```

### 자주 사용하는 명령어
```bash
# 타입 체크
npm run type-check

# 린트 실행
npm run lint

# 코드 포맷팅
npm run format

# 의존성 업데이트 확인
npm outdated

# 의존성 업데이트
npm update
```

## 보안 주의사항

1. **환경변수**: 절대 커밋하지 않기
2. **API 키**: 서버 사이드에서만 사용
3. **민감한 정보**: .gitignore에 추가
4. **의존성**: 정기적으로 보안 업데이트

---

이 가이드는 지속적으로 업데이트됩니다. 
문의사항은 프로젝트 관리자에게 연락하세요.