# 개선된 컴포넌트 예시

## Before: 기존 패턴
```typescript
export default function SystemSettingsPage() {
  const [settings, setSettings] = useState<SystemSetting[]>([])
  const [loading, setLoading] = useState(true)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    checkAuthAndLoadSettings()
  }, [])  // 경고 발생!

  const checkAuthAndLoadSettings = async () => {
    // 인증 확인 로직
    // 권한 확인 로직
    // 데이터 로딩 로직
  }
  
  // ... 나머지 코드
}
```

## After: 개선된 패턴

### 방법 1: Custom Hooks 활용
```typescript
import { useAuth, useSupabaseQuery } from '@/hooks'
import { LoadingSpinner, ErrorMessage } from '@/components/common'

export default function SystemSettingsPage() {
  // 인증 및 권한 확인을 한 줄로 처리
  const { user, profile, loading: authLoading } = useAuth({
    redirectTo: '/login',
    requiredRole: 'super_admin'
  })

  // 데이터 페칭을 선언적으로 처리
  const { 
    data: settings, 
    loading: dataLoading, 
    error,
    refetch 
  } = useSupabaseQuery(
    async (supabase) => {
      const { data, error } = await supabase
        .from('system_settings')
        .select('*')
        .order('key')
      
      if (error) throw error
      return data
    },
    [user?.id],  // 의존성 명확히 표시
    { enabled: !!user }  // user가 있을 때만 실행
  )

  if (authLoading || dataLoading) {
    return <LoadingSpinner fullScreen message="설정을 불러오는 중..." />
  }

  if (error) {
    return <ErrorMessage title="오류 발생" message={error.message} />
  }

  // ... 나머지 UI 로직
}
```

### 방법 2: Higher Order Component (HOC) 패턴
```typescript
import { withAuth } from '@/components/hoc/withAuth'

function SystemSettingsPage({ user, profile }) {
  // user와 profile이 props로 자동 전달됨
  // 인증 및 권한 확인이 이미 완료된 상태
  
  const { data: settings, loading, error } = useSupabaseQuery(
    // ... 쿼리 로직
  )

  // ... UI 로직
}

// HOC로 감싸서 export
export default withAuth(SystemSettingsPage, {
  requiredRole: 'super_admin',
  redirectTo: '/login'
})
```

### 방법 3: Compound Component 패턴
```typescript
import { AuthGuard } from '@/components/guards/AuthGuard'
import { DataProvider } from '@/components/providers/DataProvider'

export default function SystemSettingsPage() {
  return (
    <AuthGuard requiredRole="super_admin" redirectTo="/login">
      <DataProvider 
        queryKey="system-settings"
        queryFn={fetchSystemSettings}
      >
        <SystemSettingsContent />
      </DataProvider>
    </AuthGuard>
  )
}

function SystemSettingsContent() {
  const { data: settings, refetch } = useData('system-settings')
  
  // 순수한 UI 로직만 포함
  return (
    <div>
      {/* UI 구현 */}
    </div>
  )
}
```

## 장점

1. **관심사의 분리**: 인증, 데이터 페칭, UI 로직이 명확히 분리됨
2. **재사용성**: Custom hooks와 컴포넌트를 다른 페이지에서도 활용 가능
3. **타입 안정성**: TypeScript와 잘 통합되어 타입 추론이 개선됨
4. **테스트 용이성**: 각 부분을 독립적으로 테스트 가능
5. **성능 최적화**: 불필요한 리렌더링 방지, 캐싱 전략 적용 가능

## 적용 가이드

1. **점진적 적용**: 새로운 컴포넌트부터 개선된 패턴 적용
2. **공통 패턴 추출**: 반복되는 로직을 Custom Hook으로 추출
3. **컴포넌트 분리**: UI 로직과 비즈니스 로직 분리
4. **문서화**: 팀원들이 새 패턴을 이해하고 사용할 수 있도록 문서화

## 마이그레이션 전략

### Phase 1 (1주차)
- Custom hooks 생성 (useAuth, useStore, useSupabaseQuery)
- 공통 컴포넌트 생성 (LoadingSpinner, ErrorMessage)
- 새 페이지에 개선된 패턴 적용

### Phase 2 (2-3주차)
- 기존 페이지 점진적 리팩토링
- HOC 패턴 도입
- 성능 모니터링 도구 설정

### Phase 3 (4주차)
- 전체 코드베이스 일관성 확보
- 문서화 완료
- 팀 교육 진행