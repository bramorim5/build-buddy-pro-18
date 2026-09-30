create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text,
  created_at timestamptz not null default now()
);
grant select, insert, update on public.profiles to authenticated;
grant all on public.profiles to service_role;
alter table public.profiles enable row level security;
create policy "own profile read" on public.profiles for select to authenticated using (auth.uid() = id);
create policy "own profile update" on public.profiles for update to authenticated using (auth.uid() = id);
create policy "own profile insert" on public.profiles for insert to authenticated with check (auth.uid() = id);

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, name) values (new.id, coalesce(new.raw_user_meta_data->>'name', new.email));
  return new;
end; $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

create table public.suppliers (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  phone text,
  contact text,
  notes text,
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.suppliers to authenticated;
grant all on public.suppliers to service_role;
alter table public.suppliers enable row level security;
create policy "suppliers all" on public.suppliers for all to authenticated using (true) with check (true);

create type public.item_type as enum ('material','submontagem','produto');

create table public.items (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  item_type public.item_type not null default 'material',
  description text,
  photo_url text,
  product_line text,
  quantity integer not null default 0,
  min_quantity integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update, delete on public.items to authenticated;
grant all on public.items to service_role;
alter table public.items enable row level security;
create policy "items all" on public.items for all to authenticated using (true) with check (true);
create index items_type_idx on public.items(item_type);

create table public.item_suppliers (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.items(id) on delete cascade,
  supplier_id uuid not null references public.suppliers(id) on delete cascade,
  unit_cost numeric(12,2),
  lead_time text,
  is_primary boolean not null default false,
  unique (item_id, supplier_id)
);
grant select, insert, update, delete on public.item_suppliers to authenticated;
grant all on public.item_suppliers to service_role;
alter table public.item_suppliers enable row level security;
create policy "item_suppliers all" on public.item_suppliers for all to authenticated using (true) with check (true);

create table public.bom_lines (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid not null references public.items(id) on delete cascade,
  child_id uuid not null references public.items(id) on delete cascade,
  quantity numeric(12,3) not null default 1,
  unique (parent_id, child_id),
  check (parent_id <> child_id)
);
grant select, insert, update, delete on public.bom_lines to authenticated;
grant all on public.bom_lines to service_role;
alter table public.bom_lines enable row level security;
create policy "bom all" on public.bom_lines for all to authenticated using (true) with check (true);
create index bom_parent_idx on public.bom_lines(parent_id);

create table public.movements (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.items(id) on delete cascade,
  delta integer not null,
  kind text not null,
  note text,
  user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
grant select, insert on public.movements to authenticated;
grant all on public.movements to service_role;
alter table public.movements enable row level security;
create policy "movements read" on public.movements for select to authenticated using (true);
create policy "movements insert" on public.movements for insert to authenticated with check (true);
create index movements_item_idx on public.movements(item_id, created_at desc);

-- montagem: desconta filhos e credita o pai
create or replace function public.assemble(p_item_id uuid, p_qty integer, p_user uuid)
returns void language plpgsql security definer set search_path = public as $$
declare r record;
begin
  if p_qty is null or p_qty <= 0 then raise exception 'Quantidade inválida'; end if;
  if not exists (select 1 from bom_lines where parent_id = p_item_id) then
    raise exception 'Este item não possui estrutura cadastrada';
  end if;
  for r in select b.child_id, b.quantity * p_qty as need, i.name, i.quantity as have
           from bom_lines b join items i on i.id = b.child_id where b.parent_id = p_item_id loop
    if r.have < r.need then
      raise exception 'Estoque insuficiente de % (precisa %, tem %)', r.name, r.need, r.have;
    end if;
  end loop;
  for r in select b.child_id, (b.quantity * p_qty)::int as need from bom_lines b where b.parent_id = p_item_id loop
    update items set quantity = quantity - r.need, updated_at = now() where id = r.child_id;
    insert into movements (item_id, delta, kind, note, user_id) values (r.child_id, -r.need, 'montagem', 'Consumido na montagem', p_user);
  end loop;
  update items set quantity = quantity + p_qty, updated_at = now() where id = p_item_id;
  insert into movements (item_id, delta, kind, note, user_id) values (p_item_id, p_qty, 'montagem', 'Montagem concluída', p_user);
end; $$;
revoke all on function public.assemble(uuid,integer,uuid) from public;
grant execute on function public.assemble(uuid,integer,uuid) to authenticated, service_role;