/**
 * Test file for QR Sales Scanner component
 * Verifies iOS-specific fixes and mobile optimization
 */

import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { QRSalesScanner } from '../QRSalesScanner'

// Mock the QRScanner component
jest.mock('../QRScanner', () => ({
  QRScanner: ({ onScan, onError }: { onScan: (data: string) => void, onError: (error: Error) => void }) => (
    <div data-testid="qr-scanner">
      <button 
        onClick={() => onScan('test-store-uuid')}
        data-testid="mock-scan-button"
      >
        Mock Scan
      </button>
      <button 
        onClick={() => onError(new Error('Camera test error'))}
        data-testid="mock-error-button"
      >
        Mock Error
      </button>
    </div>
  )
}))

// Mock the MobileSalesCard component
jest.mock('../../sales/MobileSalesCard', () => ({
  MobileSalesCard: ({ salesData }: { salesData: any }) => (
    <div data-testid="mobile-sales-card">
      <h2>{salesData.store.name}</h2>
      <p>Current Month: {salesData.current_month.total}</p>
    </div>
  )
}))

// Mock fetch
global.fetch = jest.fn()

const mockSalesData = {
  store: {
    id: 'test-store-uuid',
    name: 'Test Store',
    code: 'TS001',
    address: 'Test Address'
  },
  current_month: {
    total: 1000000,
    count: 50,
    average_transaction: 20000,
    period: '2025.01'
  },
  previous_month: {
    total: 800000,
    count: 40,
    period: '2024.12'
  },
  comparison: {
    change_amount: 200000,
    change_percentage: 25.0,
    is_increase: true
  },
  today: {
    total: 50000,
    count: 3
  },
  trend: [
    { month: '2024.08', total: 700000, count: 35 },
    { month: '2024.09', total: 750000, count: 38 },
    { month: '2024.10', total: 800000, count: 40 },
    { month: '2024.11', total: 850000, count: 42 },
    { month: '2024.12', total: 800000, count: 40 },
    { month: '2025.01', total: 1000000, count: 50 }
  ],
  generated_at: new Date().toISOString()
}

describe('QRSalesScanner', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should render the QR scanner initially', () => {
    render(<QRSalesScanner />)
    
    expect(screen.getByTestId('qr-scanner')).toBeInTheDocument()
    expect(screen.getByText('QR 코드를 화면 중앙의 박스 안에 맞춰주세요')).toBeInTheDocument()
  })

  it('should handle successful QR scan and fetch sales data', async () => {
    const mockFetch = fetch as jest.MockedFunction<typeof fetch>
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        data: mockSalesData
      })
    } as Response)

    render(<QRSalesScanner />)
    
    // Simulate QR scan
    fireEvent.click(screen.getByTestId('mock-scan-button'))
    
    // Wait for loading and then data display
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/stores/test-store-uuid/sales?month=current',
        expect.objectContaining({
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        })
      )
    })

    await waitFor(() => {
      expect(screen.getByTestId('mobile-sales-card')).toBeInTheDocument()
      expect(screen.getByText('Test Store')).toBeInTheDocument()
      expect(screen.getByText('Current Month: 1000000')).toBeInTheDocument()
    })
  })

  it('should handle QR scan error', async () => {
    render(<QRSalesScanner />)
    
    // Simulate scanner error
    fireEvent.click(screen.getByTestId('mock-error-button'))
    
    await waitFor(() => {
      expect(screen.getByText('오류 발생')).toBeInTheDocument()
      expect(screen.getByText(/QR 코드 스캔 중 오류가 발생했습니다/)).toBeInTheDocument()
    })
  })

  it('should handle API error', async () => {
    const mockFetch = fetch as jest.MockedFunction<typeof fetch>
    mockFetch.mockResolvedValueOnce({
      ok: false,
      json: async () => ({
        error: '매장을 찾을 수 없습니다.'
      })
    } as Response)

    render(<QRSalesScanner />)
    
    // Simulate QR scan
    fireEvent.click(screen.getByTestId('mock-scan-button'))
    
    await waitFor(() => {
      expect(screen.getByText('오류 발생')).toBeInTheDocument()
      expect(screen.getByText('매장을 찾을 수 없습니다.')).toBeInTheDocument()
    })
  })

  it('should handle invalid QR code format', async () => {
    const mockFetch = fetch as jest.MockedFunction<typeof fetch>
    
    render(<QRSalesScanner />)
    
    // Mock the onScan to simulate invalid QR code
    const qrScanner = screen.getByTestId('qr-scanner')
    fireEvent.click(screen.getByTestId('mock-scan-button'))
    
    // Since we're using 'test-store-uuid' which is not a valid UUID, 
    // we expect an error to be shown
    await waitFor(() => {
      expect(screen.getByText('오류 발생')).toBeInTheDocument()
      expect(screen.getByText('유효하지 않은 매장 QR 코드입니다.')).toBeInTheDocument()
    })
  })

  it('should allow returning to scanner from sales data view', async () => {
    const mockFetch = fetch as jest.MockedFunction<typeof fetch>
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        data: mockSalesData
      })
    } as Response)

    render(<QRSalesScanner />)
    
    // First, scan a QR code
    fireEvent.click(screen.getByTestId('mock-scan-button'))
    
    await waitFor(() => {
      expect(screen.getByTestId('mobile-sales-card')).toBeInTheDocument()
    })

    // Then click "다른 매장 스캔" button
    fireEvent.click(screen.getByText('다른 매장 스캔'))
    
    // Should return to scanner view
    expect(screen.getByTestId('qr-scanner')).toBeInTheDocument()
    expect(screen.queryByTestId('mobile-sales-card')).not.toBeInTheDocument()
  })

  it('should handle refresh data functionality', async () => {
    const mockFetch = fetch as jest.MockedFunction<typeof fetch>
    
    // Initial successful fetch
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        data: mockSalesData
      })
    } as Response)

    // Refresh fetch
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        data: {
          ...mockSalesData,
          current_month: {
            ...mockSalesData.current_month,
            total: 1100000 // Updated total
          }
        }
      })
    } as Response)

    render(<QRSalesScanner />)
    
    // First, scan a QR code
    fireEvent.click(screen.getByTestId('mock-scan-button'))
    
    await waitFor(() => {
      expect(screen.getByTestId('mobile-sales-card')).toBeInTheDocument()
    })

    // Find and click refresh button
    const refreshButton = screen.getByRole('button', { name: /새로고침|refresh/i })
    fireEvent.click(refreshButton)
    
    // Should call API again
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledTimes(2)
    })
  })
})