create or replace function public.adjust_stock(p_item_id uuid, p_delta integer, p_note text default null)
returns void language plpgsql security definer set search_path = public as $$
declare current_qty integer;
begin
  if auth.uid() is null then raise exception 'Acesso negado'; end if;
  if p_delta is null or p_delta = 0 then raise exception 'Ajuste inválido'; end if;
  select quantity into current_qty from items where id = p_item_id for update;
  if current_qty is null then raise exception 'Item não encontrado'; end if;
  if current_qty + p_delta < 0 then raise exception 'O estoque não pode ficar negativo'; end if;
  update items set quantity = quantity + p_delta, updated_at = now() where id = p_item_id;
  insert into movements (item_id, delta, kind, note, user_id)
  values (p_item_id, p_delta, 'ajuste', coalesce(nullif(trim(p_note), ''), 'Ajuste manual de inventário'), auth.uid());
end; $$;
revoke all on function public.adjust_stock(uuid,integer,text) from public;
grant execute on function public.adjust_stock(uuid,integer,text) to authenticated, service_role;