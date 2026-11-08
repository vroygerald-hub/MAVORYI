create table if not exists public.products (
    id text primary key,
    name text not null check (char_length(trim(name)) between 2 and 120),
    category text not null,
    image text,
    color text,
    material text,
    price numeric(12, 2) check (price is null or price > 0),
    active boolean not null default true,
    position integer not null default 0,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

insert into public.products (id, name, category, image, color, material, price, position)
values
    ('nomad', 'THE NOMAD', 'Travel bag', 'bag1.jpeg', 'Black', 'Nylon Fabric', null, 10),
    ('hauler', 'THE HAULER', 'Travel bag', 'bag2.jpeg', 'Black', 'Coated Fabric', null, 20),
    ('inferno-helmet', 'INFERNO-HELMET', 'Helmet', 'helmet1.jpeg', 'Electric Blue and Black', 'ABS Shell / PC Visor', null, 30),
    ('nimbus', 'NIMBUS', 'Umbrella', 'umb1.jpeg', 'Black', '8-Rib Full Fibre Frame', null, 40),
    ('voyager', 'THE VOYAGER', 'Travel bag', 'bag3.jpeg', 'Charcoal Grey', 'Ballistic Nylon', null, 50),
    ('courier', 'THE COURIER', 'Travel bag', 'bag4.jpeg', 'Olive Green', 'Waxed Canvas', null, 60),
    ('vortex-helmet', 'VORTEX-HELMET', 'Helmet', 'helmet 2.jpeg', 'Matte Black', 'Carbon Fibre Shell / PC Visor', null, 70),
    ('stratus', 'STRATUS', 'Umbrella', 'umb2.jpeg', 'Navy Blue', '10-Rib Windproof Frame', null, 80),
    ('sentinel', 'THE SENTINEL', 'Gloves', null, 'Black', 'Full-Grain Leather', null, 90)
on conflict (id) do nothing;

update public.products
set active = false
where id = 'stratus';

alter table public.products enable row level security;
revoke all on public.products from anon, authenticated;
grant select on public.products to anon, authenticated;
grant insert, update on public.products to authenticated;

drop policy if exists products_public_read on public.products;
create policy products_public_read
on public.products for select to anon, authenticated
using (active = true);

drop policy if exists products_admin_insert on public.products;
create policy products_admin_insert
on public.products for insert to authenticated
with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

drop policy if exists products_admin_update on public.products;
create policy products_admin_update
on public.products for update to authenticated
using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

create table if not exists public.orders (
    id uuid primary key default gen_random_uuid(),
    customer_name text not null check (char_length(trim(customer_name)) between 2 and 120),
    customer_phone text not null check (char_length(trim(customer_phone)) between 5 and 40),
    customer_email text check (customer_email is null or char_length(trim(customer_email)) <= 254),
    delivery_address text not null check (char_length(trim(delivery_address)) between 5 and 500),
    delivery_city text not null check (char_length(trim(delivery_city)) between 2 and 120),
    payment_timing text not null check (payment_timing in ('before_delivery', 'on_delivery')),
    payment_method text not null check (payment_method in ('legacy-online', 'on-delivery', 'mtn-momo', 'momo', 'telecel-cash', 'access-bank', 'bank-transfer', 'cash-app', 'other')),
    delivery_fee numeric check (delivery_fee is null or delivery_fee >= 0),
    amount numeric(12, 2) check (amount is null or amount >= 0),
    currency text not null default 'GHS',
    payment_provider text,
    payment_reference text,
    payment_status text not null default 'unpaid' check (
        payment_status in ('unpaid', 'pending', 'paid', 'failed', 'cancelled')
    ),
    paid_at timestamptz,
    items jsonb not null check (
        jsonb_typeof(items) = 'array'
        and jsonb_array_length(items) between 1 and 30
    ),
    status text not null default 'new' check (
        status in ('new', 'confirmed', 'preparing', 'out_for_delivery', 'delivered', 'cancelled')
    ),
    created_at timestamptz not null default now(),
    constraint orders_payment_matches_timing check (
        (payment_timing = 'on_delivery' and payment_method = 'on-delivery')
        or (payment_timing = 'before_delivery' and payment_method <> 'on-delivery')
    ),
    constraint orders_delivery_fee_matches_timing check (
        (payment_timing = 'before_delivery' and delivery_fee = 0)
        or (payment_timing = 'on_delivery' and (delivery_fee is null or delivery_fee >= 0))
    ),
    constraint orders_payment_provider_matches_timing check (
        (payment_timing = 'on_delivery' and payment_provider is null and payment_reference is null)
        or (
            payment_timing = 'before_delivery'
            and (
                payment_provider is null
                or (payment_method = 'legacy-online' and payment_provider = 'legacy')
                or (payment_method in ('mtn-momo', 'telecel-cash', 'access-bank') and payment_provider = payment_method)
            )
        )
    ),
    constraint orders_paid_state_is_consistent check (
        (payment_status = 'paid' and paid_at is not null)
        or (payment_status <> 'paid' and paid_at is null)
    )
);

alter table public.orders
    add column if not exists amount numeric(12, 2),
    add column if not exists currency text not null default 'GHS',
    add column if not exists payment_provider text,
    add column if not exists payment_reference text,
    add column if not exists payment_status text not null default 'unpaid',
    add column if not exists paid_at timestamptz;

alter table public.orders
    drop constraint if exists orders_payment_method_check,
    drop constraint if exists orders_payment_provider_matches_timing;

update public.orders
set payment_method = 'legacy-online',
    payment_provider = 'legacy'
where payment_method = 'paystack'
   or payment_provider = 'paystack';

alter table public.orders
    add constraint orders_payment_method_check
        check (payment_method in ('legacy-online', 'on-delivery', 'mtn-momo', 'momo', 'telecel-cash', 'access-bank', 'bank-transfer', 'cash-app', 'other')),
    add constraint orders_payment_provider_matches_timing check (
        (payment_timing = 'on_delivery' and payment_provider is null and payment_reference is null)
        or (
            payment_timing = 'before_delivery'
            and (
                payment_provider is null
                or (payment_method = 'legacy-online' and payment_provider = 'legacy')
                or (payment_method in ('mtn-momo', 'telecel-cash', 'access-bank') and payment_provider = payment_method)
            )
        )
    );

create index if not exists orders_created_at_desc_idx on public.orders (created_at desc);
create index if not exists orders_status_idx on public.orders (status);
create index if not exists orders_payment_reference_idx on public.orders (payment_reference);

alter table public.orders enable row level security;

revoke all on public.orders from anon, authenticated;
grant insert on public.orders to anon, authenticated;
grant select, update on public.orders to authenticated;

drop policy if exists orders_customer_insert on public.orders;
create policy orders_customer_insert
on public.orders
for insert
to anon, authenticated
with check (
    status = 'new'
    and char_length(trim(customer_name)) between 2 and 120
    and char_length(trim(customer_phone)) between 5 and 40
    and customer_email is not null
    and char_length(trim(customer_email)) between 3 and 254
    and char_length(trim(delivery_address)) between 5 and 500
    and char_length(trim(delivery_city)) between 2 and 120
    and jsonb_typeof(items) = 'array'
    and jsonb_array_length(items) between 1 and 30
    and (
        (payment_timing = 'before_delivery' and payment_method in ('mtn-momo', 'telecel-cash', 'access-bank') and delivery_fee = 0)
        or (payment_timing = 'on_delivery' and payment_method = 'on-delivery' and delivery_fee is null)
    )
);

drop policy if exists orders_admin_read on public.orders;
create policy orders_admin_read
on public.orders
for select
to authenticated
using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

drop policy if exists orders_admin_update on public.orders;
create policy orders_admin_update
on public.orders
for update
to authenticated
using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
with check (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
    and status in ('new', 'confirmed', 'preparing', 'out_for_delivery', 'delivered', 'cancelled')
);

do $$
begin
    if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
       and not exists (
           select 1
           from pg_publication_tables
           where pubname = 'supabase_realtime'
             and schemaname = 'public'
             and tablename = 'orders'
       ) then
        execute 'alter publication supabase_realtime add table public.orders';
    end if;
end;
$$;
