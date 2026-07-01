export type PlanType = 'standard' | 'pro' | 'boss'
export type SubscriptionStatus = 'trial' | 'active' | 'payment_pending' | 'expired' | 'cancelled'
export type PaymentMethod = 'cash' | 'udhaar' | 'bank_transfer'
export type LaptopStatus = 'in_stock' | 'sold' | 'traded_in'
export type UdhaarStatus = 'pending' | 'partial' | 'paid' | 'overdue'
export type UdhaarMode = 'item_based' | 'value_based'
export type CountStatus = 'pending' | 'submitted' | 'verified' | 'flagged'
export type ActivityType =
  | 'login'
  | 'logout'
  | 'sale'
  | 'udhaar'
  | 'stock_add'
  | 'search'
  | 'page_view'
  | 'price_edit'
  | 'count_submit'
  | 'void_attempt'

export interface Shop {
  id: string
  owner_id: string
  name: string
  owner_name: string
  owner_phone: string
  whatsapp_number: string
  wa_phone_number_id: string | null
  wa_access_token: string | null
  plan: PlanType
  subscription_status: SubscriptionStatus
  trial_ends_at: string
  subscription_ends_at: string | null
  next_reminder_date: string
  easypaisa_payment_ref: string | null
  shop_open_time: string
  shop_close_time: string
  max_udhaar_without_approval: number
  large_sale_alert_threshold: number
  min_sale_prices: Record<string, number> | null
  created_at: string
  updated_at: string
}

export interface Worker {
  id: string
  shop_id: string
  name: string
  pin_hash: string
  email: string | null
  role: string | null
  is_active: boolean
  auth_user_id: string | null
  push_token: string | null
  created_at: string
}

export interface Laptop {
  id: string
  shop_id: string
  imei: string
  brand: string
  model: string
  specs: Record<string, unknown>
  condition?: string
  notes?: string | null
  purchase_price: number
  asking_price: number
  purchase_date: string | null
  supplier_name: string | null
  supplier_payment?: string | null
  sale_price?: number | null
  sold_at?: string | null
  customer_name?: string | null
  added_by?: string | null
  status: LaptopStatus
  added_at: string
  days_in_stock?: number
  imported_batch_id?: string | null
  stock_type?: 'own' | 'market' | null
  source_shop_name?: string | null
  source_shop_price?: number | null
}

export interface SupplierCredit {
  id: string
  shop_id: string
  laptop_id: string | null
  supplier_name: string
  amount_owed: number
  amount_paid: number
  due_date: string | null
  status: 'pending' | 'partial' | 'paid'
  created_at: string
}

export interface UdhaarPayment {
  id: string
  shop_id: string
  udhaar_id: string
  amount_paid: number
  payment_date: string
  payment_method: 'cash' | 'bank'
  notes: string | null
  created_at: string
}

export interface DailyCashRecord {
  id: string
  shop_id: string
  record_date: string
  opening_balance: number
  closing_balance_expected: number
  closing_balance_actual: number | null
  difference: number | null
  is_closed: boolean
  notes: string | null
  created_at: string
}

export type ExpenseCategory =
  | 'Rent' | 'Electricity' | 'Stock purchase' | 'Transport' | 'Food' | 'Salary' | 'Other'

export interface Expense {
  id: string
  shop_id: string
  amount: number
  category: string
  description: string
  payment_type: 'cash' | 'bank'
  expense_date: string
  created_at: string
}

export interface Sale {
  id: string
  shop_id: string
  laptop_id: string
  worker_id: string | null
  sale_price: number
  payment_type: PaymentMethod
  customer_phone: string | null
  customer_name: string | null
  profit: number
  receipt_sent: boolean
  wa_alert_sent: boolean
  is_voided: boolean
  void_approved_by: string | null
  sold_at: string
  post_snapshot: boolean
  notes: string | null
  bank_reference: string | null
}

export interface AccessoryCategory {
  id: string
  shop_id: string
  name: string
  cost_per_unit: number
  display_qty: number
  total_value_added: number
  total_value_sold: number
  units_restocked: number
  units_sold: number
  last_manual_count: number | null
  last_manual_count_date: string | null
  last_spot_check_at: string | null
  last_spot_check_declared: number | null
  last_spot_check_expected: number | null
  created_at: string
}

export interface AccessoryTransaction {
  id: string
  shop_id: string
  category_id: string
  worker_id: string
  transaction_type: 'sale' | 'udhaar' | 'restock' | 'adjustment'
  units: number
  value: number
  note: string | null
  created_at: string
}

export interface CountRequest {
  id: string
  shop_id: string
  category_id: string
  status: CountStatus
  fired_at: string
  submitted_at: string | null
  declared_count: number | null
  expected_count: number | null
  gap: number
  photo_url: string | null
  response_seconds: number | null
  submitted_by: string | null
  flagged_reason: string | null
}

export interface UdhaarRecord {
  id: string
  shop_id: string
  worker_id: string
  mode: UdhaarMode
  customer_name: string
  customer_phone: string
  cnic_photo_url: string | null
  total_amount: number
  amount_paid: number
  amount_remaining: number
  items: Array<{ name: string; price: number }>
  due_date: string | null
  status: UdhaarStatus
  approved_by_owner: boolean
  reminder_sent_at: string | null
  deduct_from_accessories: boolean
  category_id: string | null
  sale_id: string | null
  created_at: string
}

export interface UdhaarApproval {
  id: string
  shop_id: string
  worker_id: string
  status: 'pending' | 'approved' | 'rejected'
  amount: number
  customer_name: string
  customer_phone: string
  mode: UdhaarMode
  items: Array<{ name: string; price: number }> | null
  note: string | null
  category_id: string | null
  deduct_units: number | null
  due_date: string | null
  cnic_photo_url: string | null
  created_at: string
  resolved_at: string | null
}

export interface CashRecord {
  id: string
  shop_id: string
  worker_id: string
  record_type: 'opening' | 'closing' | 'expense' | 'deposit'
  amount: number
  note: string | null
  created_at: string
}

export interface ActivityLog {
  id: string
  shop_id: string
  worker_id: string
  event_type: ActivityType
  page: string | null
  details: Record<string, unknown>
  post_snapshot: boolean
  logged_at: string
}

export interface Snapshot {
  id: string
  shop_id: string
  snapshot_type: 'left' | 'returned'
  laptop_count: number | null
  laptops_in_stock_value: number | null
  cash_declared: number | null
  accessories_total_value: number | null
  udhaar_total_pending: number | null
  worker_id: string | null
  worker_last_action: string | null
  created_at: string
}

export interface PaymentProof {
  id: string
  shop_id: string
  screenshot_url: string
  amount: number
  plan: PlanType
  status: 'pending' | 'verified' | 'rejected'
  submitted_at: string
  verified_at: string | null
  admin_note: string | null
}

export interface ChecklistReminder {
  id: string
  shop_id: string
  sent_at: string
  next_reminder_date: string
  channel: string
}

