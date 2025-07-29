/**
 * 위치 기반 유틸리티 함수들
 * GPS 좌표를 사용한 거리 계산 및 위치 검증
 */

/**
 * Haversine 공식을 사용하여 두 GPS 좌표 간의 거리를 계산합니다.
 * @param lat1 첫 번째 지점의 위도
 * @param lng1 첫 번째 지점의 경도
 * @param lat2 두 번째 지점의 위도
 * @param lng2 두 번째 지점의 경도
 * @returns 두 지점 간의 거리 (미터 단위)
 */
export function calculateDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371e3; // 지구 반경 (미터)
  const φ1 = (lat1 * Math.PI) / 180; // 라디안으로 변환
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lng2 - lng1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  const distance = R * c; // 미터 단위

  return Math.round(distance); // 정수로 반올림
}

/**
 * 사용자의 현재 위치가 매장의 허용 반경 내에 있는지 확인합니다.
 * @param userLat 사용자의 현재 위도
 * @param userLng 사용자의 현재 경도
 * @param storeLat 매장의 위도
 * @param storeLng 매장의 경도
 * @param radiusInMeters 허용 반경 (미터 단위)
 * @returns 반경 내에 있으면 true, 없으면 false
 */
export function isWithinRadius(
  userLat: number,
  userLng: number,
  storeLat: number,
  storeLng: number,
  radiusInMeters: number
): boolean {
  const distance = calculateDistance(userLat, userLng, storeLat, storeLng);
  return distance <= radiusInMeters;
}

/**
 * 위치 정보의 유효성을 검증합니다.
 * @param latitude 위도
 * @param longitude 경도
 * @returns 유효한 좌표이면 true, 아니면 false
 */
export function isValidCoordinate(
  latitude: number,
  longitude: number
): boolean {
  // 위도: -90 ~ 90
  // 경도: -180 ~ 180
  return (
    typeof latitude === 'number' &&
    typeof longitude === 'number' &&
    latitude >= -90 &&
    latitude <= 90 &&
    longitude >= -180 &&
    longitude <= 180
  );
}

/**
 * 브라우저에서 현재 위치를 가져옵니다.
 * @returns Promise<{latitude: number, longitude: number, accuracy: number}>
 */
export function getCurrentLocation(): Promise<{
  latitude: number;
  longitude: number;
  accuracy: number;
}> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('이 브라우저는 위치 정보를 지원하지 않습니다.'));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
        });
      },
      (error) => {
        let errorMessage = '위치 정보를 가져올 수 없습니다.';
        
        switch (error.code) {
          case error.PERMISSION_DENIED:
            errorMessage = '위치 정보 사용 권한이 거부되었습니다.';
            break;
          case error.POSITION_UNAVAILABLE:
            errorMessage = '위치 정보를 사용할 수 없습니다.';
            break;
          case error.TIMEOUT:
            errorMessage = '위치 정보 요청 시간이 초과되었습니다.';
            break;
        }
        
        reject(new Error(errorMessage));
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      }
    );
  });
}

/**
 * 대한민국 내의 좌표인지 확인합니다.
 * @param latitude 위도
 * @param longitude 경도
 * @returns 대한민국 내의 좌표이면 true
 */
export function isInKorea(latitude: number, longitude: number): boolean {
  // 대한민국의 대략적인 경계
  // 북위 33° ~ 39°, 동경 124° ~ 132°
  return (
    latitude >= 33 &&
    latitude <= 39 &&
    longitude >= 124 &&
    longitude <= 132
  );
}

/**
 * 두 위치 간의 거리를 사람이 읽기 쉬운 형태로 포맷합니다.
 * @param distanceInMeters 미터 단위의 거리
 * @returns 포맷된 거리 문자열
 */
export function formatDistance(distanceInMeters: number): string {
  if (distanceInMeters < 1000) {
    return `${distanceInMeters}m`;
  }
  
  const km = (distanceInMeters / 1000).toFixed(1);
  return `${km}km`;
}

/**
 * 위치 정보와 함께 체크인 가능 여부를 확인합니다.
 * @param userLocation 사용자 위치 정보
 * @param storeLocation 매장 위치 정보
 * @param allowedRadius 허용 반경 (미터)
 * @returns 체크인 가능 여부와 상세 정보
 */
export function validateCheckIn(
  userLocation: { latitude: number; longitude: number; accuracy?: number },
  storeLocation: { latitude: number; longitude: number },
  allowedRadius: number
): {
  canCheckIn: boolean;
  distance: number;
  message: string;
} {
  // 좌표 유효성 검사
  if (!isValidCoordinate(userLocation.latitude, userLocation.longitude)) {
    return {
      canCheckIn: false,
      distance: -1,
      message: '유효하지 않은 위치 정보입니다.',
    };
  }

  if (!isValidCoordinate(storeLocation.latitude, storeLocation.longitude)) {
    return {
      canCheckIn: false,
      distance: -1,
      message: '매장 위치 정보가 올바르지 않습니다.',
    };
  }

  // 거리 계산
  const distance = calculateDistance(
    userLocation.latitude,
    userLocation.longitude,
    storeLocation.latitude,
    storeLocation.longitude
  );

  // 반경 내 확인
  const isWithin = distance <= allowedRadius;

  let message = '';
  if (isWithin) {
    message = `매장에서 ${formatDistance(distance)} 거리에 있습니다. 체크인 가능합니다.`;
  } else {
    message = `매장에서 ${formatDistance(distance)} 떨어져 있습니다. ${formatDistance(allowedRadius)} 이내에서만 체크인 가능합니다.`;
  }

  // GPS 정확도가 낮은 경우 경고
  if (userLocation.accuracy && userLocation.accuracy > 50) {
    message += ` (GPS 정확도: ${Math.round(userLocation.accuracy)}m)`;
  }

  return {
    canCheckIn: isWithin,
    distance,
    message,
  };
}