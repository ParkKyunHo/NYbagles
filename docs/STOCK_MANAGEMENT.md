# Stock Management System Documentation

## Overview
The Bagel Shop Stock Management System provides real-time inventory tracking with role-based permissions for stock updates and automatic stock reduction during sales.

## Features

### 1. **Permission-Based Stock Updates**
- **Authorized Roles**: Only `manager`, `admin`, and `super_admin` can manually update stock quantities
- **Direct Updates**: No approval process required for authorized users
- **Audit Trail**: All stock changes are logged in the `product_changes` table

### 2. **Real-Time Stock Display**
- Stock quantities are displayed on the sales page for each product
- Color-coded indicators:
  - **Red** (0 items): Out of stock
  - **Orange** (<10 items): Low stock warning
  - **Gray** (≥10 items): Normal stock level
- Stock update buttons visible only to authorized users

### 3. **Automatic Stock Management**
- **Sales**: Stock automatically decreases when a sale is completed
- **Cancellations**: Stock automatically restores when a sale is cancelled
- **Validation**: System prevents sales when insufficient stock

## Implementation Details

### Server Actions (`/lib/actions/stock.actions.ts`)

#### `updateProductStock(data: UpdateStockData)`
- **Purpose**: Direct stock quantity update
- **Permissions**: manager, admin, super_admin
- **Parameters**:
  - `productId`: Product identifier
  - `newQuantity`: New stock amount
  - `reason`: Optional reason for update
- **Returns**: Success status with updated product data

#### `adjustProductStock(productId, adjustment, reason)`
- **Purpose**: Incremental stock adjustment (+/-)
- **Permissions**: manager, admin, super_admin
- **Parameters**:
  - `productId`: Product identifier
  - `adjustment`: Positive or negative quantity change
  - `reason`: Optional reason for adjustment

#### `batchUpdateStock(updates)`
- **Purpose**: Update multiple products at once
- **Permissions**: manager, admin, super_admin
- **Parameters**: Array of UpdateStockData objects

### Database Functions

#### `create_sales_transaction()`
- Automatically decreases stock when a sale is created
- Validates sufficient stock before completing sale
- Creates audit log entries for stock changes

#### `cancel_sales_transaction()`
- Automatically restores stock when a sale is cancelled
- Only allows cancellation by the original seller or managers/admins
- Creates audit log entries for stock restoration

### UI Components

#### Sales Page (`/app/(dashboard)/sales/page.tsx`)
- Displays current stock for each product
- Shows stock update button for authorized users
- Prevents adding out-of-stock items to cart
- Validates stock availability during quantity updates
- Refreshes stock after sales completion

#### QuickStockUpdateModal (`/components/products/QuickStockUpdateModal.tsx`)
- Modal interface for stock updates
- Quick adjustment buttons (-10, -1, +1, +10)
- Direct quantity input field
- Real-time validation

## Usage

### For Managers/Admins

1. **Update Stock from Sales Page**:
   - Click the edit icon on any product
   - Enter new quantity or use adjustment buttons
   - Click "확인" to save changes

2. **View Stock Levels**:
   - Stock quantities displayed on each product card
   - Color indicators show stock status
   - Low stock warnings appear automatically

### For Sales Staff

1. **During Sales**:
   - Out-of-stock items are disabled
   - System prevents overselling
   - Stock updates immediately after sale completion

2. **Stock Warnings**:
   - Visual indicators for low stock
   - Automatic alerts when adding items exceeding available stock

## Security

- Role-based access control via `unified-auth`
- Server-side permission validation
- Audit trail for all stock changes
- Database-level constraints prevent negative stock

## Cache Management

Stock updates trigger cache invalidation for:
- `/products` - Product listing pages
- `/sales` - Sales interface
- `/dashboard` - Dashboard displays
- Cache tags: `products`, `sales`

## Error Handling

- **Insufficient Permissions**: Clear error message with required role information
- **Invalid Quantities**: Validation prevents negative stock values
- **Concurrent Updates**: Database locks prevent race conditions
- **Network Errors**: Graceful error messages with retry options

## Best Practices

1. **Regular Stock Audits**: Periodically verify physical stock matches system records
2. **Reason Documentation**: Always provide clear reasons for manual stock adjustments
3. **Low Stock Monitoring**: Set up alerts for products below threshold quantities
4. **Training**: Ensure all authorized users understand stock update procedures

## Troubleshooting

### Common Issues

1. **Stock Update Button Not Visible**
   - Verify user has manager, admin, or super_admin role
   - Check authentication status

2. **Stock Not Updating After Sale**
   - Ensure `create_sales_transaction` function is deployed
   - Check database connection
   - Verify product has stock tracking enabled

3. **Cannot Complete Sale**
   - Check available stock quantity
   - Verify all items in cart have sufficient stock
   - Review error messages for specific products

## Future Enhancements

- [ ] Stock alert notifications
- [ ] Automatic reorder suggestions
- [ ] Stock movement history reports
- [ ] Batch stock import from CSV
- [ ] Stock forecasting based on sales trends
- [ ] Multi-location stock transfers