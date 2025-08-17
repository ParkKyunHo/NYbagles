'use client';

import { useState } from 'react';
import { X, Package } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { updateProductStock } from '@/lib/actions/stock.actions';

interface QuickStockUpdateModalProps {
  product: {
    id: string;
    name: string;
    stock_quantity: number;
    category: string;
  };
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function QuickStockUpdateModal({
  product,
  isOpen,
  onClose,
  onSuccess
}: QuickStockUpdateModalProps) {
  const [stockQuantity, setStockQuantity] = useState(product.stock_quantity.toString());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const newQuantity = parseInt(stockQuantity);
      
      if (isNaN(newQuantity) || newQuantity < 0) {
        throw new Error('올바른 재고 수량을 입력해주세요.');
      }

      // Server Action을 통한 재고 업데이트 (승인 불필요)
      const result = await updateProductStock({
        productId: product.id,
        newQuantity,
        reason: '재고 수정'
      });

      if (!result.success) {
        throw new Error(result.error || '재고 업데이트에 실패했습니다.');
      }

      // 성공 처리
      alert(result.message || `${product.name}의 재고가 ${newQuantity}개로 업데이트되었습니다.`);
      onSuccess();
      onClose();
    } catch (error: any) {
      console.error('Stock update error:', error);
      setError(error.message || '재고 업데이트 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handleStockAdjustment = (adjustment: number) => {
    const current = parseInt(stockQuantity) || 0;
    const newValue = Math.max(0, current + adjustment);
    setStockQuantity(newValue.toString());
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <Package className="h-5 w-5" />
            재고 수정
          </h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <p className="text-sm text-gray-600 mb-2">
              상품명: <span className="font-medium text-gray-900">{product.name}</span>
            </p>
            <p className="text-sm text-gray-600 mb-2">
              카테고리: <span className="font-medium text-gray-900">{product.category}</span>
            </p>
            <p className="text-sm text-gray-600 mb-4">
              현재 재고: <span className="font-medium text-gray-900">{product.stock_quantity}개</span>
            </p>
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              새 재고 수량
            </label>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => handleStockAdjustment(-10)}
                className="px-3 py-1 bg-gray-100 hover:bg-gray-200 rounded text-gray-700"
              >
                -10
              </button>
              <button
                type="button"
                onClick={() => handleStockAdjustment(-1)}
                className="px-3 py-1 bg-gray-100 hover:bg-gray-200 rounded text-gray-700"
              >
                -1
              </button>
              <input
                type="number"
                value={stockQuantity}
                onChange={(e) => setStockQuantity(e.target.value)}
                min="0"
                required
                className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-bagel-yellow text-center"
              />
              <button
                type="button"
                onClick={() => handleStockAdjustment(1)}
                className="px-3 py-1 bg-gray-100 hover:bg-gray-200 rounded text-gray-700"
              >
                +1
              </button>
              <button
                type="button"
                onClick={() => handleStockAdjustment(10)}
                className="px-3 py-1 bg-gray-100 hover:bg-gray-200 rounded text-gray-700"
              >
                +10
              </button>
            </div>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md text-red-700 text-sm">
              {error}
            </div>
          )}

          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={loading}
            >
              취소
            </Button>
            <Button
              type="submit"
              disabled={loading}
              className="bg-bagel-yellow hover:bg-yellow-600 text-black"
            >
              {loading ? '저장 중...' : '확인'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}