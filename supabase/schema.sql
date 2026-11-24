create table if not exists public.products (
    id text primary key,
    name text not null check (char_length(trim(name)) between 2 and 120),
    category text not null,
    image text,
    color text,
    material text,
    description text check (description is null or char_length(description) <= 1000),
    price numeric(12, 2) check (price is null or price > 0),
    active boolean not null default true,
    position integer not null default 0,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

alter table public.products
    add column if not exists description text check (description is null or char_length(description) <= 1000);

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

create table if not exists public.upcoming_products (
    id uuid primary key default gen_random_uuid(),
    name text not null check (char_length(trim(name)) between 2 and 120),
    category text not null check (char_length(trim(category)) between 2 and 80),
    description text not null check (char_length(trim(description)) between 2 and 1000),
    image text check (image is null or char_length(image) <= 1000),
    color text check (color is null or char_length(color) <= 80),
    material text check (material is null or char_length(material) <= 120),
    expected_release text check (expected_release is null or char_length(expected_release) <= 80),
    created_at timestamptz not null default now()
);

alter table public.upcoming_products enable row level security;
revoke all on public.upcoming_products from anon, authenticated;
grant select, insert, update, delete on public.upcoming_products to authenticated;

drop policy if exists upcoming_products_member_read on public.upcoming_products;
create policy upcoming_products_member_read
on public.upcoming_products for select to authenticated
using (true);

drop policy if exists upcoming_products_admin_insert on public.upcoming_products;
create policy upcoming_products_admin_insert
on public.upcoming_products for insert to authenticated
with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

drop policy if exists upcoming_products_admin_update on public.upcoming_products;
create policy upcoming_products_admin_update
on public.upcoming_products for update to authenticated
using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

drop policy if exists upcoming_products_admin_delete on public.upcoming_products;
create policy upcoming_products_admin_delete
on public.upcoming_products for delete to authenticated
using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

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
    payment_contact_method text,
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
        (payment_timing = 'before_delivery' and (delivery_fee is null or delivery_fee = 0))
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
    add column if not exists payment_contact_method text,
    add column if not exists payment_status text not null default 'unpaid',
    add column if not exists paid_at timestamptz;

alter table public.orders
    drop constraint if exists orders_payment_method_check,
    drop constraint if exists orders_payment_provider_matches_timing,
    drop constraint if exists orders_delivery_fee_matches_timing,
    drop constraint if exists orders_payment_contact_method_check;

update public.orders
set payment_method = 'legacy-online',
    payment_provider = 'legacy'
where payment_method = 'paystack'
   or payment_provider = 'paystack';

alter table public.orders
    add constraint orders_payment_method_check
        check (payment_method in ('legacy-online', 'on-delivery', 'mtn-momo', 'momo', 'telecel-cash', 'access-bank', 'bank-transfer', 'cash-app', 'other')),
    add constraint orders_delivery_fee_matches_timing check (
        (payment_timing = 'before_delivery' and (delivery_fee is null or delivery_fee = 0))
        or (payment_timing = 'on_delivery' and (delivery_fee is null or delivery_fee >= 0))
    ),
    add constraint orders_payment_contact_method_check
        check (payment_contact_method is null or payment_contact_method in ('whatsapp', 'email')),
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
        (payment_timing = 'before_delivery'
            and payment_method in ('mtn-momo', 'telecel-cash', 'access-bank', 'other')
            and (
                (delivery_city ilike '%accra%' and delivery_fee = 0)
                or (delivery_city not ilike '%accra%' and delivery_fee is null)
            )
        )
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

create table if not exists public.customer_profiles (
    user_id uuid primary key references auth.users (id) on delete cascade,
    email text,
    full_name text,
    created_at timestamptz not null default now(),
    last_active_at timestamptz
);

alter table public.customer_profiles enable row level security;
revoke all on public.customer_profiles from public, anon, authenticated;
grant select on public.customer_profiles to authenticated;

create or replace function public.sync_customer_profile()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
    insert into public.customer_profiles (user_id, email, full_name, created_at)
    values (
        new.id,
        new.email,
        coalesce(
            nullif(trim(new.raw_user_meta_data ->> 'name'), ''),
            nullif(split_part(coalesce(new.email, ''), '@', 1), '')
        ),
        new.created_at
    )
    on conflict (user_id) do update
    set email = excluded.email,
        full_name = excluded.full_name;
    return new;
end;
$$;

revoke all on function public.sync_customer_profile() from public, anon, authenticated;

drop trigger if exists on_auth_user_profile_synced on auth.users;
create trigger on_auth_user_profile_synced
after insert or update of email, raw_user_meta_data on auth.users
for each row execute function public.sync_customer_profile();

insert into public.customer_profiles (user_id, email, full_name, created_at)
select
    id,
    email,
    coalesce(
        nullif(trim(raw_user_meta_data ->> 'name'), ''),
        nullif(split_part(coalesce(email, ''), '@', 1), '')
    ),
    created_at
from auth.users
on conflict (user_id) do update
set email = excluded.email,
    full_name = excluded.full_name;

drop policy if exists customer_profiles_owner_read on public.customer_profiles;
create policy customer_profiles_owner_read
on public.customer_profiles for select to authenticated
using (user_id = auth.uid());

drop policy if exists customer_profiles_admin_read on public.customer_profiles;
create policy customer_profiles_admin_read
on public.customer_profiles for select to authenticated
using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

create or replace function public.touch_customer_activity()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
    if auth.uid() is null then
        raise exception 'Authentication is required to record customer activity';
    end if;

    update public.customer_profiles
    set last_active_at = now()
    where user_id = auth.uid();

    if not found then
        raise exception 'Customer profile not found';
    end if;
end;
$$;

revoke all on function public.touch_customer_activity() from public, anon;
grant execute on function public.touch_customer_activity() to authenticated;

create table if not exists public.site_visits (
    visitor_id uuid not null,
    visit_date date not null default (timezone('utc', now())::date),
    primary key (visitor_id, visit_date)
);

alter table public.site_visits enable row level security;
revoke all on public.site_visits from anon, authenticated;
grant insert on public.site_visits to anon, authenticated;
grant select on public.site_visits to authenticated;

drop policy if exists site_visits_public_insert on public.site_visits;
create policy site_visits_public_insert
on public.site_visits
for insert
to anon, authenticated
with check (visit_date = timezone('utc', now())::date);

drop policy if exists site_visits_admin_read on public.site_visits;
create policy site_visits_admin_read
on public.site_visits
for select
to authenticated
using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

create or replace view public.site_visit_daily_summary
with (security_invoker = true)
as
select visit_date, count(distinct visitor_id)::integer as unique_visitors
from public.site_visits
group by visit_date;

revoke all on public.site_visit_daily_summary from anon, authenticated;
grant select on public.site_visit_daily_summary to authenticated;

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
