export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          email: string
          full_name: string
          role: 'super_admin' | 'admin' | 'manager' | 'employee' | 'part_time'
          employee_code: string | null
          phone: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          email: string
          full_name: string
          role: 'super_admin' | 'admin' | 'manager' | 'employee' | 'part_time'
          employee_code?: string | null
          phone?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          email?: string
          full_name?: string
          role?: 'super_admin' | 'admin' | 'manager' | 'employee' | 'part_time'
          employee_code?: string | null
          phone?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      regions: {
        Row: {
          id: string
          name: string
          code: string
          created_by: string | null
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          code: string
          created_by?: string | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          code?: string
          created_by?: string | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      store_categories: {
        Row: {
          id: string
          region_id: string
          name: string
          description: string | null
          created_by: string | null
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          region_id: string
          name: string
          description?: string | null
          created_by?: string | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          region_id?: string
          name?: string
          description?: string | null
          created_by?: string | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      stores: {
        Row: {
          id: string
          category_id: string
          name: string
          code: string
          address: string | null
          phone: string | null
          email: string | null
          qr_code_id: string
          qr_secret: string
          location_lat: number | null
          location_lng: number | null
          location_radius: number
          operating_hours: Json | null
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          category_id: string
          name: string
          code: string
          address?: string | null
          phone?: string | null
          email?: string | null
          qr_code_id: string
          qr_secret: string
          location_lat?: number | null
          location_lng?: number | null
          location_radius?: number
          operating_hours?: Json | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          category_id?: string
          name?: string
          code?: string
          address?: string | null
          phone?: string | null
          email?: string | null
          qr_code_id?: string
          qr_secret?: string
          location_lat?: number | null
          location_lng?: number | null
          location_radius?: number
          operating_hours?: Json | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      qr_tokens: {
        Row: {
          id: string
          store_id: string
          token_hash: string
          token_type: 'TOTP' | 'STATIC'
          valid_from: string
          valid_until: string
          is_used: boolean
          used_by: string | null
          used_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
          store_id: string
          token_hash: string
          token_type?: 'TOTP' | 'STATIC'
          valid_from?: string
          valid_until?: string
          is_used?: boolean
          used_by?: string | null
          used_at?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          store_id?: string
          token_hash?: string
          token_type?: 'TOTP' | 'STATIC'
          valid_from?: string
          valid_until?: string
          is_used?: boolean
          used_by?: string | null
          used_at?: string | null
          created_at?: string
        }
      }
      employee_signup_requests: {
        Row: {
          id: string
          email: string
          full_name: string
          phone: string | null
          store_id: string | null
          store_code: string | null
          verification_code: string | null
          verified: boolean
          verified_at: string | null
          approved: boolean
          approved_by: string | null
          approved_at: string | null
          rejection_reason: string | null
          status: 'pending' | 'verified' | 'approved' | 'rejected' | 'expired'
          expires_at: string
          created_at: string
        }
        Insert: {
          id?: string
          email: string
          full_name: string
          phone?: string | null
          store_id?: string | null
          store_code?: string | null
          verification_code?: string | null
          verified?: boolean
          verified_at?: string | null
          approved?: boolean
          approved_by?: string | null
          approved_at?: string | null
          rejection_reason?: string | null
          status?: 'pending' | 'verified' | 'approved' | 'rejected' | 'expired'
          expires_at?: string
          created_at?: string
        }
        Update: {
          id?: string
          email?: string
          full_name?: string
          phone?: string | null
          store_id?: string | null
          store_code?: string | null
          verification_code?: string | null
          verified?: boolean
          verified_at?: string | null
          approved?: boolean
          approved_by?: string | null
          approved_at?: string | null
          rejection_reason?: string | null
          status?: 'pending' | 'verified' | 'approved' | 'rejected' | 'expired'
          expires_at?: string
          created_at?: string
        }
      }
      employees: {
        Row: {
          id: string
          user_id: string | null
          store_id: string | null
          qr_code: string
          hourly_wage: number | null
          employment_type: 'full_time' | 'part_time' | null
          department: string | null
          hire_date: string
          bank_account: Json | null
          emergency_contact: Json | null
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id?: string | null
          store_id?: string | null
          qr_code: string
          hourly_wage?: number | null
          employment_type?: 'full_time' | 'part_time' | null
          department?: string | null
          hire_date: string
          bank_account?: Json | null
          emergency_contact?: Json | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string | null
          store_id?: string | null
          qr_code?: string
          hourly_wage?: number | null
          employment_type?: 'full_time' | 'part_time' | null
          department?: string | null
          hire_date?: string
          bank_account?: Json | null
          emergency_contact?: Json | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      attendance_records: {
        Row: {
          id: string
          employee_id: string | null
          store_id: string | null
          check_in_time: string | null
          check_out_time: string | null
          work_date: string
          total_hours: number | null
          overtime_hours: number | null
          status: 'present' | 'late' | 'absent' | 'holiday' | null
          notes: string | null
          qr_validation_token: string | null
          check_in_method: 'qr' | 'manual' | 'admin' | null
          location_lat: number | null
          location_lng: number | null
          location_accuracy: number | null
          created_at: string
        }
        Insert: {
          id?: string
          employee_id?: string | null
          store_id?: string | null
          check_in_time?: string | null
          check_out_time?: string | null
          work_date: string
          total_hours?: number | null
          overtime_hours?: number | null
          status?: 'present' | 'late' | 'absent' | 'holiday' | null
          notes?: string | null
          qr_validation_token?: string | null
          check_in_method?: 'qr' | 'manual' | 'admin' | null
          location_lat?: number | null
          location_lng?: number | null
          location_accuracy?: number | null
          created_at?: string
        }
        Update: {
          id?: string
          employee_id?: string | null
          store_id?: string | null
          check_in_time?: string | null
          check_out_time?: string | null
          work_date?: string
          total_hours?: number | null
          overtime_hours?: number | null
          status?: 'present' | 'late' | 'absent' | 'holiday' | null
          notes?: string | null
          qr_validation_token?: string | null
          check_in_method?: 'qr' | 'manual' | 'admin' | null
          location_lat?: number | null
          location_lng?: number | null
          location_accuracy?: number | null
          created_at?: string
        }
      }
      products: {
        Row: {
          id: string
          name: string
          category: string | null
          price: number
          cost: number | null
          is_active: boolean
          display_order: number | null
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          category?: string | null
          price: number
          cost?: number | null
          is_active?: boolean
          display_order?: number | null
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          category?: string | null
          price?: number
          cost?: number | null
          is_active?: boolean
          display_order?: number | null
          created_at?: string
        }
      }
      sales_records: {
        Row: {
          id: string
          product_id: string | null
          quantity: number
          unit_price: number
          total_amount: number
          recorded_by: string | null
          sale_date: string
          sale_time: string
          created_at: string
        }
        Insert: {
          id?: string
          product_id?: string | null
          quantity: number
          unit_price: number
          total_amount: number
          recorded_by?: string | null
          sale_date: string
          sale_time: string
          created_at?: string
        }
        Update: {
          id?: string
          product_id?: string | null
          quantity?: number
          unit_price?: number
          total_amount?: number
          recorded_by?: string | null
          sale_date?: string
          sale_time?: string
          created_at?: string
        }
      }
      documents: {
        Row: {
          id: string
          employee_id: string | null
          document_type: 'id_card' | 'resident_registration' | 'bank_account' | 'health_certificate' | null
          file_url: string | null
          file_name: string | null
          expiry_date: string | null
          uploaded_by: string | null
          created_at: string
        }
        Insert: {
          id?: string
          employee_id?: string | null
          document_type?: 'id_card' | 'resident_registration' | 'bank_account' | 'health_certificate' | null
          file_url?: string | null
          file_name?: string | null
          expiry_date?: string | null
          uploaded_by?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          employee_id?: string | null
          document_type?: 'id_card' | 'resident_registration' | 'bank_account' | 'health_certificate' | null
          file_url?: string | null
          file_name?: string | null
          expiry_date?: string | null
          uploaded_by?: string | null
          created_at?: string
        }
      }
    }
    Views: {
      store_attendance_overview: {
        Row: {
          store_id: string
          store_name: string
          store_code: string
          attendance_date: string
          total_checkins: number
          currently_working: number
          qr_checkins: number
          avg_work_hours: number
        }
      }
    }
    Functions: {
      generate_store_qr_code: {
        Args: { store_id: string }
        Returns: string
      }
      validate_qr_token: {
        Args: { p_token_hash: string; p_store_id: string }
        Returns: boolean
      }
      process_employee_signup: {
        Args: {
          p_request_id: string
          p_approved: boolean
          p_role?: string
          p_rejection_reason?: string
        }
        Returns: boolean
      }
      cleanup_expired_data: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}