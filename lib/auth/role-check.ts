// Role-based access control utilities

export type UserRole = 'super_admin' | 'admin' | 'manager' | 'employee' | 'part_time'

export const ROLE_HIERARCHY: Record<UserRole, number> = {
  super_admin: 100,
  admin: 80,
  manager: 60,
  employee: 40,
  part_time: 20,
}

export function hasAccess(userRole: UserRole | undefined, requiredRoles: readonly UserRole[]): boolean {
  if (!userRole) return false
  return requiredRoles.includes(userRole)
}

export function hasMinimumRole(userRole: UserRole | undefined, minimumRole: UserRole): boolean {
  if (!userRole) return false
  return ROLE_HIERARCHY[userRole] >= ROLE_HIERARCHY[minimumRole]
}

// Page access requirements
export const PAGE_ACCESS = {
  // Everyone can access
  '/dashboard': ['super_admin', 'admin', 'manager', 'employee', 'part_time'],
  '/dashboard/documents': ['super_admin', 'admin', 'manager', 'employee', 'part_time'],
  '/attendance': ['super_admin', 'admin', 'manager', 'employee', 'part_time'],
  '/attendance/scan': ['super_admin', 'admin', 'manager', 'employee', 'part_time'],
  '/schedule': ['super_admin', 'admin', 'manager', 'employee', 'part_time'],
  '/dashboard/work-hours': ['super_admin', 'admin', 'manager', 'employee', 'part_time'],
  '/dashboard/settings': ['super_admin', 'admin', 'manager', 'employee', 'part_time'],
  
  // Manager and above
  '/dashboard/quick-sale': ['super_admin', 'admin', 'manager'],
  '/sales': ['super_admin', 'admin', 'manager'],
  '/sales/simple': ['super_admin', 'admin', 'manager'],
  '/sales/closing': ['super_admin', 'admin', 'manager'],
  '/sales/history': ['super_admin', 'admin', 'manager'],
  '/sales/summary': ['super_admin', 'admin', 'manager'],
  '/products': ['super_admin', 'admin', 'manager'],
  '/products/v2': ['super_admin', 'admin', 'manager'],
  '/products/store': ['super_admin', 'admin', 'manager'],
  '/dashboard/analytics': ['super_admin', 'admin', 'manager'],
  
  // Employee and above (no part_time for salary)
  '/dashboard/salary': ['super_admin', 'admin', 'manager', 'employee'],
  
  // Admin and above
  '/dashboard/employees': ['super_admin', 'admin', 'manager'],
  '/products/approvals': ['super_admin', 'admin'],
  '/admin/signup-requests': ['super_admin', 'admin'],
  '/admin/stores': ['super_admin', 'admin'],
  '/admin': ['super_admin', 'admin'],
  
  // System admin only
  '/admin/system-settings': ['super_admin'],
  '/admin/permissions': ['super_admin'],
  '/admin/backup': ['super_admin'],
} as const