-- bank_transactions: tracks all bank account movements
create table if not exists bank_transactions (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid references shops(id) on delete cascade not null,
  transaction_type text not null check (transaction_type in ('opening','deposit','withdrawal','expense_paid','udhaar_received','sale_received')),
  amount numeric not null check (amount >= 0),
  direction text not null check (direction in ('in','out')),
  reference_number text,
  description text,
  transaction_date date not null default current_date,
  created_at timestamptz not null default now()
);

alter table bank_transactions enable row level security;

create policy "owner full access bank_transactions" on bank_transactions
  for all using (
    shop_id in (select id from shops where owner_id = auth.uid())
  );

-- expense_budgets: monthly budgets per expense category
create table if not exists expense_budgets (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid references shops(id) on delete cascade not null,
  category text not null,
  monthly_budget numeric not null check (monthly_budget >= 0),
  budget_month integer not null check (budget_month between 1 and 12),
  budget_year integer not null,
  created_at timestamptz not null default now(),
  unique(shop_id, category, budget_month, budget_year)
);

alter table expense_budgets enable row level security;

create policy "owner full access expense_budgets" on expense_budgets
  for all using (
    shop_id in (select id from shops where owner_id = auth.uid())
  );
