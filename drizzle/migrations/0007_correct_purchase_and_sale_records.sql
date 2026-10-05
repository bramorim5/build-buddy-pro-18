CREATE OR REPLACE FUNCTION public.update_purchase_record(
  p_id uuid,
  p_quantity integer,
  p_unit_cost numeric,
  p_note text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_user uuid := auth.uid();
  v_record public.purchase_records%ROWTYPE;
  v_difference integer;
  v_current_stock integer;
  v_note text;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Acesso negado'; END IF;
  IF p_quantity IS NULL OR p_quantity <= 0 THEN RAISE EXCEPTION 'Quantidade inválida'; END IF;
  IF p_unit_cost IS NULL OR p_unit_cost < 0 THEN RAISE EXCEPTION 'Custo unitário inválido'; END IF;

  SELECT * INTO v_record
  FROM public.purchase_records
  WHERE id = p_id
  FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'Compra não encontrada'; END IF;

  v_difference := p_quantity - v_record.quantity;

  SELECT quantity INTO v_current_stock
  FROM public.items
  WHERE id = v_record.item_id
  FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'Item não encontrado'; END IF;
  IF v_current_stock + v_difference < 0 THEN
    RAISE EXCEPTION 'Estoque insuficiente para corrigir a compra (disponível: %)', v_current_stock;
  END IF;

  UPDATE public.items
  SET quantity = quantity + v_difference, updated_at = now()
  WHERE id = v_record.item_id;

  IF v_difference <> 0 THEN
    INSERT INTO public.movements (item_id, delta, kind, note, user_id)
    VALUES (v_record.item_id, v_difference, 'ajuste', 'Correção de compra', v_user);
  END IF;

  v_note := concat_ws(' - ', nullif(btrim(p_note), ''), format('corrigido de: qtd %s, custo %s', v_record.quantity, v_record.unit_cost));

  UPDATE public.purchase_records
  SET quantity = p_quantity,
      unit_cost = round(p_unit_cost, 4),
      total_cost = round(p_unit_cost * p_quantity, 2),
      note = v_note
  WHERE id = p_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.update_purchase_record(uuid, integer, numeric, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_purchase_record(uuid, integer, numeric, text) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.update_sale_record(
  p_id uuid,
  p_quantity integer,
  p_note text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_user uuid := auth.uid();
  v_record public.sales%ROWTYPE;
  v_stock_delta integer;
  v_current_stock integer;
  v_note text;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Acesso negado'; END IF;
  IF p_quantity IS NULL OR p_quantity <= 0 THEN RAISE EXCEPTION 'Quantidade inválida'; END IF;

  SELECT * INTO v_record
  FROM public.sales
  WHERE id = p_id
  FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'Venda não encontrada'; END IF;

  v_stock_delta := v_record.quantity - p_quantity;

  SELECT quantity INTO v_current_stock
  FROM public.items
  WHERE id = v_record.item_id
  FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'Item não encontrado'; END IF;
  IF v_current_stock + v_stock_delta < 0 THEN
    RAISE EXCEPTION 'Estoque insuficiente para aumentar a venda (disponível: %)', v_current_stock;
  END IF;

  UPDATE public.items
  SET quantity = quantity + v_stock_delta, updated_at = now()
  WHERE id = v_record.item_id;

  IF v_stock_delta <> 0 THEN
    INSERT INTO public.movements (item_id, delta, kind, note, user_id)
    VALUES (v_record.item_id, v_stock_delta, 'ajuste', 'Correção de venda', v_user);
  END IF;

  v_note := concat_ws(' - ', nullif(btrim(p_note), ''), format('corrigido de: qtd %s', v_record.quantity));

  UPDATE public.sales
  SET quantity = p_quantity,
      note = v_note
  WHERE id = p_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.update_sale_record(uuid, integer, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_sale_record(uuid, integer, text) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.delete_purchase_record(p_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_user uuid := auth.uid();
  v_record public.purchase_records%ROWTYPE;
  v_current_stock integer;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Acesso negado'; END IF;

  SELECT * INTO v_record
  FROM public.purchase_records
  WHERE id = p_id
  FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'Compra não encontrada'; END IF;

  SELECT quantity INTO v_current_stock
  FROM public.items
  WHERE id = v_record.item_id
  FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'Item não encontrado'; END IF;
  IF v_current_stock < v_record.quantity THEN
    RAISE EXCEPTION 'Estoque insuficiente para excluir a compra (disponível: %, necessário: %)', v_current_stock, v_record.quantity;
  END IF;

  UPDATE public.items
  SET quantity = quantity - v_record.quantity, updated_at = now()
  WHERE id = v_record.item_id;

  INSERT INTO public.movements (item_id, delta, kind, note, user_id)
  VALUES (v_record.item_id, -v_record.quantity, 'ajuste', 'Exclusão de compra', v_user);

  DELETE FROM public.purchase_records WHERE id = p_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.delete_purchase_record(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delete_purchase_record(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.delete_sale_record(p_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_user uuid := auth.uid();
  v_record public.sales%ROWTYPE;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Acesso negado'; END IF;

  SELECT * INTO v_record
  FROM public.sales
  WHERE id = p_id
  FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'Venda não encontrada'; END IF;

  PERFORM 1 FROM public.items WHERE id = v_record.item_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Item não encontrado'; END IF;

  UPDATE public.items
  SET quantity = quantity + v_record.quantity, updated_at = now()
  WHERE id = v_record.item_id;

  INSERT INTO public.movements (item_id, delta, kind, note, user_id)
  VALUES (v_record.item_id, v_record.quantity, 'ajuste', 'Exclusão de venda', v_user);

  DELETE FROM public.sales WHERE id = p_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.delete_sale_record(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delete_sale_record(uuid) TO authenticated, service_role;