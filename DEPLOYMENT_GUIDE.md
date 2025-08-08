# 배포 가이드

## Vercel 자동 배포 설정

### 초기 설정 (이미 완료됨)
1. GitHub 리포지토리: https://github.com/ParkKyunHo/NYbagles.git
2. Vercel 프로젝트 연결 완료
3. 환경 변수 설정 완료

### 배포 방법
```bash
# 코드 수정 후
git add -A
git commit -m "fix: 설명"
git push origin main

# Vercel이 자동으로 배포 시작
```

### 환경 변수
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (선택사항)

### 배포 상태 확인
- Vercel 대시보드에서 실시간 확인
- GitHub PR에 자동 코멘트
- 배포 완료 시 프로덕션 URL로 접속 가능

### 롤백 방법
1. Vercel 대시보드 → Deployments
2. 이전 버전 선택 → "Promote to Production"