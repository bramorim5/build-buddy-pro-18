create or replace function public.assemble(p_item_id uuid, p_qty integer, p_user uuid)
returns void language plpgsql security definer set search_path = public as $$
declare r record;
begin
  if auth.uid() is null or p_user is distinct from auth.uid() then raise exception 'Acesso negado'; end if;
  if p_qty is null or p_qty <= 0 then raise exception 'Quantidade inválida'; end if;
  if not exists (select 1 from bom_lines where parent_id = p_item_id) then
    raise exception 'Este item não possui estrutura cadastrada';
  end if;
  for r in select b.child_id, b.quantity * p_qty as need, i.name, i.quantity as have
           from bom_lines b join items i on i.id = b.child_id where b.parent_id = p_item_id loop
    if r.need <> trunc(r.need) then
      raise exception 'A estrutura de % gera quantidade fracionada; ajuste a quantidade da estrutura', r.name;
    end if;
    if r.have < r.need then
      raise exception 'Estoque insuficiente de % (precisa %, tem %)', r.name, r.need, r.have;
    end if;
  end loop;
  for r in select b.child_id, (b.quantity * p_qty)::int as need from bom_lines b where b.parent_id = p_item_id loop
    update items set quantity = quantity - r.need, updated_at = now() where id = r.child_id;
    insert into movements (item_id, delta, kind, note, user_id) values (r.child_id, -r.need, 'montagem', 'Consumido na montagem', auth.uid());
  end loop;
  update items set quantity = quantity + p_qty, updated_at = now() where id = p_item_id;
  insert into movements (item_id, delta, kind, note, user_id) values (p_item_id, p_qty, 'montagem', 'Montagem concluída', auth.uid());
end; $$;
revoke all on function public.assemble(uuid,integer,uuid) from public;
grant execute on function public.assemble(uuid,integer,uuid) to authenticated, service_role;

create or replace function public.receive_purchase(p_item_id uuid, p_qty integer, p_note text default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'Acesso negado'; end if;
  if p_qty is null or p_qty <= 0 then raise exception 'Quantidade inválida'; end if;
  if not exists (select 1 from items where id = p_item_id) then raise exception 'Item não encontrado'; end if;
  update items set quantity = quantity + p_qty, updated_at = now() where id = p_item_id;
  insert into movements (item_id, delta, kind, note, user_id)
  values (p_item_id, p_qty, 'compra', nullif(trim(p_note), ''), auth.uid());
end; $$;
revoke all on function public.receive_purchase(uuid,integer,text) from public;
grant execute on function public.receive_purchase(uuid,integer,text) to authenticated, service_role;