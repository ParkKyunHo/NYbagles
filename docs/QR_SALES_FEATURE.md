# QR Sales Feature Documentation

## Overview

The QR Sales feature allows administrators to scan store QR codes and instantly view comprehensive sales data on mobile devices. This feature is specifically optimized for mobile use with iOS-specific camera fixes.

## Features

### 1. QR Code Scanner
- **Mobile-first design** with touch-friendly interface
- **iOS camera fix** for black screen issues on iPhone/iPad
- **Android optimization** for better performance
- **Real-time QR code recognition** with visual feedback
- **Error handling** for camera permissions and hardware issues

### 2. Sales Data Display
- **Current month sales** with transaction count and averages
- **Previous month comparison** with percentage change indicators
- **Today's sales** for immediate insights
- **6-month trend visualization** with mobile-optimized charts
- **Store information** including name, code, and address

### 3. Mobile Optimization
- **Responsive design** that works on all screen sizes
- **Touch-friendly buttons** with minimum 44px height
- **Swipe gestures** and intuitive navigation
- **Fast loading** with optimized data fetching
- **Offline-ready** error states and fallbacks

## Technical Implementation

### Architecture

```
/app/(dashboard)/qr-sales/           # Main page (admin-only)
/app/api/stores/[id]/sales/         # Sales data API endpoint
/components/qr/QRSalesScanner.tsx   # Main scanner component
/components/sales/MobileSalesCard.tsx  # Sales display component
```

### Key Components

#### 1. QRSalesScanner Component
```typescript
interface QRScannerProps {
  // Automatically handles QR scanning and data fetching
  // Includes error handling and loading states
}
```

**Features:**
- Integrates with existing QRScanner component
- Handles UUID validation for store IDs
- Manages loading states and error recovery
- Provides refresh functionality

#### 2. MobileSalesCard Component
```typescript
interface SalesData {
  store: StoreInfo
  current_month: MonthlyData
  previous_month: MonthlyData
  comparison: ComparisonData
  today: DailyData
  trend: TrendData[]
}
```

**Features:**
- Tabbed interface (Overview / Trend)
- Mobile-optimized charts and visualizations
- Currency formatting with Korean locale
- Responsive layout for all screen sizes

#### 3. Sales API Endpoint
```typescript
GET /api/stores/[id]/sales?month=current
```

**Security:**
- Admin-only access control
- UUID validation for store IDs
- Rate limiting and input sanitization
- Comprehensive error handling

## iOS-Specific Fixes

### Camera Black Screen Issue

The iOS camera black screen issue has been resolved with these specific optimizations:

1. **Video Element Configuration:**
```typescript
video.setAttribute('playsinline', 'true')
video.setAttribute('webkit-playsinline', 'true')
video.setAttribute('controls', 'false')
video.muted = true
video.autoplay = true
```

2. **iOS-Specific Delays:**
```typescript
// Pre-initialization delay
await new Promise(resolve => setTimeout(resolve, 300))

// Camera setup delay
if (isIOS) {
  await new Promise(resolve => setTimeout(resolve, 200))
}
```

3. **Enhanced Camera Constraints:**
```typescript
const iosConstraints = {
  facingMode: 'environment',
  width: { ideal: 1280, max: 1280 },
  height: { ideal: 720, max: 720 },
  frameRate: { ideal: 15, max: 24 }, // Lower for iOS stability
  focusMode: 'continuous',
  exposureMode: 'continuous'
}
```

4. **Video Post-Start Configuration:**
```typescript
if (isIOS && videoRef.current) {
  const video = videoRef.current
  video.setAttribute('playsinline', 'true')
  video.setAttribute('webkit-playsinline', 'true')
  video.muted = true
  
  if (video.paused) {
    await video.play()
  }
}
```

## Usage Instructions

### For Administrators

1. **Access the Feature:**
   - Navigate to "QR 매출 조회" in the sidebar
   - Or use the mobile navigation menu
   - Feature is only available to admin and super_admin roles

2. **Scan Store QR Code:**
   - Tap "QR 코드 스캔 시작" button
   - Allow camera permissions when prompted
   - Point camera at store QR code
   - Wait for automatic recognition

3. **View Sales Data:**
   - Review current month sales and trends
   - Switch between Overview and Trend tabs
   - Use refresh button to update data
   - Tap "다른 매장 스캔" to scan another store

### QR Code Requirements

Store QR codes must contain:
- **UUID format:** `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`
- **JSON format:** `{"store_id": "uuid", ...}` (optional)
- **Direct UUID:** Raw UUID string

## API Documentation

### Sales Data Endpoint

**Endpoint:** `GET /api/stores/[id]/sales`

**Parameters:**
- `id` (path): Store UUID
- `month` (query): 'current' (default) or specific month

**Authentication:** Admin role required

**Response:**
```json
{
  "success": true,
  "data": {
    "store": {
      "id": "store-uuid",
      "name": "Store Name",
      "code": "STORE001",
      "address": "Store Address"
    },
    "current_month": {
      "total": 1000000,
      "count": 50,
      "average_transaction": 20000,
      "period": "2025.01"
    },
    "previous_month": {
      "total": 800000,
      "count": 40,
      "period": "2024.12"
    },
    "comparison": {
      "change_amount": 200000,
      "change_percentage": 25.0,
      "is_increase": true
    },
    "today": {
      "total": 50000,
      "count": 3
    },
    "trend": [
      {
        "month": "2025.01",
        "total": 1000000,
        "count": 50
      }
    ],
    "generated_at": "2025-01-17T10:30:00Z"
  }
}
```

**Error Responses:**
- `401`: Authentication required
- `403`: Admin access required
- `404`: Store not found
- `400`: Invalid store ID format
- `500`: Server error

## Security Considerations

### Access Control
- Only admin and super_admin roles can access the feature
- Server-side role validation on all API calls
- Client-side route protection with redirects

### Data Protection
- No sensitive financial data exposed in QR codes
- Store UUIDs are non-guessable identifiers
- Rate limiting on API endpoints
- Input validation and sanitization

### Camera Permissions
- Graceful handling of denied camera permissions
- Clear instructions for enabling camera access
- Fallback states for camera unavailability

## Performance Optimizations

### Mobile Performance
- **Optimized QR scanning:** 15fps on iOS, 20fps on Android
- **Efficient data fetching:** Single API call with comprehensive data
- **Smart caching:** Component-level state management
- **Touch optimization:** 44px minimum touch targets

### Loading States
- **Progressive loading:** Scanner → Data fetching → Display
- **Skeleton states:** Visual feedback during loading
- **Error recovery:** Retry mechanisms and clear error messages

## Testing

### Manual Testing Checklist

**iOS Testing:**
- [ ] Camera initializes without black screen
- [ ] QR codes scan quickly and accurately
- [ ] Touch interactions work smoothly
- [ ] Orientation changes handled properly
- [ ] Safari and Chrome compatibility

**Android Testing:**
- [ ] Camera permissions work correctly
- [ ] QR scanning performance is optimal
- [ ] Touch targets are accessible
- [ ] Various Android browsers work

**Admin Access:**
- [ ] Non-admin users redirected appropriately
- [ ] Admin navigation shows QR Sales link
- [ ] Mobile navigation includes feature

**Data Display:**
- [ ] Sales data loads correctly
- [ ] Charts render properly on mobile
- [ ] Refresh functionality works
- [ ] Error states display clearly

### Automated Testing

Run the test suite:
```bash
npm test components/qr/__tests__/QRSalesScanner.test.tsx
```

## Troubleshooting

### Common Issues

**iOS Camera Black Screen:**
- Ensure latest iOS version
- Check camera permissions in Safari settings
- Try refreshing the page
- Clear browser cache

**QR Code Not Scanning:**
- Ensure adequate lighting
- Hold device steady
- Clean camera lens
- Check QR code format (must be valid UUID)

**API Errors:**
- Verify user has admin role
- Check network connectivity
- Ensure store exists in database
- Check server logs for detailed errors

**Performance Issues:**
- Close other camera apps
- Restart browser
- Check available memory
- Update browser to latest version

### Debug Mode

Enable debug logging by adding to localStorage:
```javascript
localStorage.setItem('qr-debug', 'true')
```

## Future Enhancements

### Planned Features
- **Offline support** with local data caching
- **Export functionality** for sales reports
- **Multi-store scanning** with batch operations
- **Push notifications** for sales alerts
- **Advanced analytics** with custom date ranges

### Performance Improvements
- **WebAssembly QR scanning** for faster recognition
- **Background sync** for real-time data updates
- **Progressive Web App** features
- **Enhanced caching** strategies

## Dependencies

### Core Libraries
- `qr-scanner`: QR code recognition
- `html5-qrcode`: Alternative QR library
- `recharts`: Chart visualization
- `lucide-react`: Icons

### Browser Support
- **iOS Safari:** 14.0+
- **Chrome Mobile:** 90+
- **Firefox Mobile:** 90+
- **Samsung Internet:** 15.0+

## Changelog

### Version 1.0.0 (2025-01-17)
- Initial release
- iOS camera black screen fixes
- Mobile-optimized interface
- Admin-only access control
- Comprehensive sales data display
- 6-month trend visualization
- Real-time data refresh functionality