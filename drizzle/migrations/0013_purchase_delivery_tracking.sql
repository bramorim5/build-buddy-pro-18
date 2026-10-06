ALTER TABLE public.purchase_records
  ADD COLUMN expected_delivery_date date,
  ADD COLUMN delivered boolean NOT NULL DEFAULT false,
  ADD COLUMN delivered_at timestamptz,
  ADD COLUMN delivered_by uuid;

ALTER TABLE public.purchase_records
  ADD CONSTRAINT purchase_records_delivered_by_profiles_fkey
  FOREIGN KEY (delivered_by) REFERENCES public.profiles(id) ON DELETE SET NULL;

DROP FUNCTION public.record_purchase(uuid, integer, uuid, numeric, numeric, text);

CREATE FUNCTION public.record_purchase(
  p_item_id uuid,
  p_qty integer,
  p_supplier_id uuid DEFAULT NULL,
  p_unit_cost numeric DEFAULT NULL,
  p_total_cost numeric DEFAULT NULL,
  p_note text DEFAULT NULL,
  p_expected_delivery_date date DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_user uuid := auth.uid();
  v_unit_cost numeric;
  v_total_cost numeric;
  v_record_id uuid;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Acesso negado'; END IF;
  IF p_qty IS NULL OR p_qty <= 0 THEN RAISE EXCEPTION 'Quantidade inválida'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.items WHERE id = p_item_id) THEN RAISE EXCEPTION 'Item não encontrado'; END IF;
  IF p_supplier_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.suppliers WHERE id = p_supplier_id) THEN
    RAISE EXCEPTION 'Fornecedor não encontrado';
  END IF;
  IF p_unit_cost IS NULL AND p_total_cost IS NULL THEN RAISE EXCEPTION 'Informe o valor unitário ou total'; END IF;
  IF coalesce(p_unit_cost, 0) < 0 OR coalesce(p_total_cost, 0) < 0 THEN RAISE EXCEPTION 'O valor não pode ser negativo'; END IF;

  v_total_cost := round(coalesce(p_total_cost, p_unit_cost * p_qty), 2);
  v_unit_cost := round(coalesce(p_unit_cost, v_total_cost / p_qty), 4);

  UPDATE public.items
  SET quantity = quantity + p_qty, updated_at = now()
  WHERE id = p_item_id;

  INSERT INTO public.purchase_records (
    item_id, supplier_id, quantity, unit_cost, total_cost, note, user_id, expected_delivery_date
  )
  VALUES (
    p_item_id, p_supplier_id, p_qty, v_unit_cost, v_total_cost,
    nullif(btrim(p_note), ''), v_user, p_expected_delivery_date
  )
  RETURNING id INTO v_record_id;

  INSERT INTO public.movements (item_id, delta, kind, note, user_id)
  VALUES (p_item_id, p_qty, 'compra', nullif(btrim(p_note), ''), v_user);

  RETURN v_record_id;
END;
$function$;

DROP FUNCTION public.update_purchase_record(uuid, integer, numeric, text);

CREATE FUNCTION public.update_purchase_record(
  p_id uuid,
  p_quantity integer,
  p_unit_cost numeric,
  p_note text,
  p_expected_delivery_date date DEFAULT NULL
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
      note = v_note,
      expected_delivery_date = p_expected_delivery_date
  WHERE id = p_id;
END;
$function$;

CREATE FUNCTION public.mark_purchase_delivered(p_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Acesso negado'; END IF;

  UPDATE public.purchase_records
  SET delivered = true,
      delivered_at = now(),
      delivered_by = auth.uid()
  WHERE id = p_id;

  IF NOT FOUND THEN RAISE EXCEPTION 'Compra não encontrada'; END IF;
END;
$function$;

CREATE FUNCTION public.reopen_purchase_delivery(p_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Acesso negado'; END IF;

  UPDATE public.purchase_records
  SET delivered = false,
      delivered_at = NULL,
      delivered_by = NULL
  WHERE id = p_id;

  IF NOT FOUND THEN RAISE EXCEPTION 'Compra não encontrada'; END IF;
END;
$function$;

REVOKE ALL ON FUNCTION public.record_purchase(uuid, integer, uuid, numeric, numeric, text, date) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.update_purchase_record(uuid, integer, numeric, text, date) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.mark_purchase_delivered(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.reopen_purchase_delivery(uuid) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.record_purchase(uuid, integer, uuid, numeric, numeric, text, date) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.update_purchase_record(uuid, integer, numeric, text, date) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.mark_purchase_delivered(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.reopen_purchase_delivery(uuid) TO authenticated, service_role;