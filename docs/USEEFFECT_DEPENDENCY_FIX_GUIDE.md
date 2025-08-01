# useEffect 의존성 경고 해결 가이드

## 문제 상황
프로젝트 전체에서 30개 이상의 useEffect 의존성 경고가 발생하고 있습니다.

## 해결 패턴

### 패턴 1: useEffect 내부에서 함수 정의 (권장)
```typescript
// Before
const fetchData = async () => {
  // 로직
}

useEffect(() => {
  fetchData()
}, []) // 경고 발생!

// After
useEffect(() => {
  const fetchData = async () => {
    // 로직
  }
  
  fetchData()
}, [supabase, router]) // 실제 의존성만 포함
```

### 패턴 2: useCallback 사용 (함수를 재사용해야 할 때)
```typescript
const fetchData = useCallback(async () => {
  // 로직
}, [supabase])

useEffect(() => {
  fetchData()
}, [fetchData])
```

### 패턴 3: Custom Hook으로 추출 (재사용성이 높을 때)
```typescript
// hooks/useData.ts
export function useData() {
  const [data, setData] = useState(null)
  const supabase = createClient()
  
  useEffect(() => {
    const fetchData = async () => {
      const { data } = await supabase.from('table').select()
      setData(data)
    }
    
    fetchData()
  }, [supabase])
  
  return data
}

// 컴포넌트에서 사용
const data = useData()
```

## 일괄 수정 스크립트

모든 파일을 일관되게 수정하기 위한 접근 방법:

1. **패턴 식별**: 각 파일에서 사용되는 함수와 의존성 확인
2. **적절한 패턴 선택**: 재사용성과 복잡도에 따라 패턴 선택
3. **점진적 수정**: 한 번에 몇 개씩 수정하고 테스트

## 수정 우선순위

### 높음 (즉시 수정)
- 빌드를 방해하는 경고
- 핵심 기능 페이지

### 중간 (1주 내)
- 자주 사용되는 컴포넌트
- 공통 패턴이 있는 파일들

### 낮음 (2주 내)
- 관리자 전용 페이지
- 덜 사용되는 기능

## ESLint 규칙 임시 비활성화

급한 경우 특정 라인에서만 규칙 비활성화:
```typescript
useEffect(() => {
  fetchData()
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [])
```

또는 파일 전체:
```typescript
/* eslint-disable react-hooks/exhaustive-deps */
```

## 장기적 해결책

1. **React Query 도입**: 데이터 페칭 로직을 완전히 분리
2. **Custom Hooks 라이브러리**: 공통 로직을 재사용 가능한 hooks로 추출
3. **코드 리뷰 프로세스**: 새 코드에서 의존성 문제 방지

## 주의사항

- 의존성 배열에 함수를 추가하면 무한 루프가 발생할 수 있음
- 꼭 필요한 의존성만 포함
- 의존성을 무시하면 stale closure 문제 발생 가능