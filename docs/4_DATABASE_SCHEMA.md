## 1. Database Schema Design
 
### 1.1 Catalog Domain
**Categories**
- id (PK), name, display_order, is_active, created_at, updated_at
**Products**
- id (PK), category_id (FK -> Categories), name, description, image_url, tag (enum: "best_seller", "new", "none"), is_active, created_at, updated_at
**Product_Variants**
- id (PK), product_id (FK -> Products), variant_name (e.g., "Size L", "Extra Shot"), cogs_price (decimal), retail_price (decimal), sku, is_active
**Variant_Groups** (optional, for structured modifiers e.g. Size/Toppings as distinct groups)
- id (PK), product_id (FK -> Products), group_name (e.g., "Size", "Toppings"), selection_type (enum: "single", "multiple"), is_required
### 1.2 Order Domain
**Orders**
- id (PK), order_code (human-readable), status (enum: "pending", "completed", "cancelled"), subtotal, discount_amount, total_amount, fund_id (FK -> Funds), created_by, created_at
**Order_Items**
- id (PK), order_id (FK -> Orders), product_variant_id (FK -> Product_Variants), quantity, unit_price, line_total, notes
**Funds**
- id (PK), name (e.g., "Cash Drawer", "Bank Transfer"), fund_type (enum: "cash", "bank", "e-wallet"), current_balance, is_active
### 1.3 Financial Ledger Domain
**Transactions**
- id (PK), fund_id (FK -> Funds), transaction_type (enum: "inflow", "outflow"), category (e.g., "sale", "ingredient_purchase", "utility_bill"), amount, reference_order_id (FK -> Orders, nullable), description, created_by, created_at
### 1.4 Relationships Summary
- Categories 1—N Products
- Products 1—N Product_Variants
- Products 1—N Variant_Groups (optional structured modifiers)
- Orders 1—N Order_Items
- Order_Items N—1 Product_Variants
- Funds 1—N Orders (selected payment fund)
- Funds 1—N Transactions
- Orders 1—1(0) Transactions (auto-generated inflow on completion)