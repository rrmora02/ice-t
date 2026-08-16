// Tipos de dominio (reflejan supabase/migrations/0001_init.sql).
// Se mantienen a mano en lugar de generarlos porque el proyecto de
// Supabase se crea fuera de este repo; si usas la Supabase CLI puedes
// reemplazarlos con `supabase gen types typescript`.

export type Role = "admin" | "vendedor";

export interface Profile {
  id: string;
  business_id: string;
  role: Role;
  full_name: string;
  email: string;
  phone: string | null;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Business {
  id: string;
  name: string;
  owner_id: string;
  currency: string;
  timezone: string;
  created_at: string;
  updated_at: string;
}

export interface IceProduct {
  id: string;
  business_id: string;
  name: string;
  unit: "pieza" | "kg";
  is_bulk: boolean;
  price: number;
  sort_order: number;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export type CustomerType = "tienda" | "restaurante" | "particular" | "otro";

export interface Customer {
  id: string;
  business_id: string;
  assigned_vendedor_id: string | null;
  name: string;
  customer_type: CustomerType;
  phone: string | null;
  address: string | null;
  notes: string | null;
  last_restock_date: string | null;
  next_restock_date: string | null;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export type PaymentMethod = "efectivo" | "transferencia" | "credito";
export type SaleStatus = "completada" | "cancelada";

export interface Sale {
  id: string;
  business_id: string;
  vendedor_id: string;
  customer_id: string | null;
  total: number;
  payment_method: PaymentMethod;
  status: SaleStatus;
  client_uuid: string;
  sold_at: string;
  notes: string | null;
  created_at: string;
}

export interface SaleItem {
  id: string;
  sale_id: string;
  business_id: string;
  product_id: string | null;
  product_name_snapshot: string;
  unit_price: number;
  quantity: number;
  subtotal: number;
}

export type ExpenseType = "capital" | "operativo";
export type ExpenseCategory = "equipo" | "insumo" | "transporte" | "servicios" | "otro";

export interface Expense {
  id: string;
  business_id: string;
  expense_type: ExpenseType;
  category: ExpenseCategory;
  description: string;
  unit_cost: number;
  quantity: number;
  amount: number;
  expense_date: string;
  created_by: string | null;
  created_at: string;
}

export interface PushSubscriptionRow {
  id: string;
  user_id: string;
  business_id: string;
  endpoint: string;
  p256dh: string;
  auth_key: string;
  created_at: string;
}

export interface SalesDailyRow {
  business_id: string;
  sale_date: string;
  sales_count: number;
  total_amount: number;
}

export interface UpcomingRestockRow {
  customer_id: string;
  business_id: string;
  name: string;
  customer_type: CustomerType;
  phone: string | null;
  address: string | null;
  assigned_vendedor_id: string | null;
  next_restock_date: string;
  days_until: number;
}

export interface BusinessRoiSummary {
  business_id: string;
  capital_invested: number;
  total_operational_expenses: number;
  total_income: number;
  net_profit: number;
  remaining_to_recover: number;
  investment_recovered: boolean;
}

// Item que viaja del carrito local -> RPC create_sale
export interface SaleCartItem {
  product_id: string;
  product_name: string;
  unit_price: number;
  quantity: number;
}
