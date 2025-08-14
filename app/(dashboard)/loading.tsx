export default function DashboardLoading() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="flex items-center justify-center pt-20">
        <div className="text-center">
          <div className="relative">
            <div className="w-24 h-24 border-8 border-gray-200 rounded-full animate-pulse"></div>
            <div className="absolute top-0 left-0 w-24 h-24 border-8 border-bagel-yellow rounded-full animate-spin border-t-transparent"></div>
          </div>
          <p className="mt-6 text-lg font-medium text-gray-700">
            로딩 중...
          </p>
          <p className="mt-2 text-sm text-gray-700">
            잠시만 기다려주세요
          </p>
        </div>
      </div>
    </div>
  )
}