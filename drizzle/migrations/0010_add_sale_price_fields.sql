ALTER TABLE public.sales
  ADD COLUMN unit_price numeric(14,2),
  ADD COLUMN total_cost numeric(14,2);

DROP FUNCTION public.record_sale(uuid, integer, text);

CREATE FUNCTION public.record_sale(
  p_item_id uuid,
  p_qty integer,
  p_note text DEFAULT NULL,
  p_unit_price numeric DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_user uuid := auth.uid();
  v_current integer;
  v_type public.item_type;
  v_sale_id uuid;
  v_unit_price numeric(14,2);
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Acesso negado'; END IF;
  IF p_qty IS NULL OR p_qty <= 0 THEN RAISE EXCEPTION 'Quantidade inválida'; END IF;

  SELECT quantity, item_type INTO v_current, v_type
  FROM public.items WHERE id = p_item_id FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'Item não encontrado'; END IF;
  IF v_type <> 'produto' THEN RAISE EXCEPTION 'Somente produtos finais podem ser vendidos'; END IF;
  IF v_current < p_qty THEN RAISE EXCEPTION 'Estoque insuficiente (disponível: %)', v_current; END IF;

  v_unit_price := CASE WHEN p_unit_price > 0 THEN round(p_unit_price, 2) ELSE NULL END;

  UPDATE public.items
  SET quantity = quantity - p_qty, updated_at = now()
  WHERE id = p_item_id;

  INSERT INTO public.sales (item_id, quantity, unit_price, total_cost, note, user_id)
  VALUES (
    p_item_id,
    p_qty,
    v_unit_price,
    CASE WHEN v_unit_price IS NOT NULL THEN round(v_unit_price * p_qty, 2) ELSE NULL END,
    nullif(btrim(p_note), ''),
    v_user
  )
  RETURNING id INTO v_sale_id;

  INSERT INTO public.movements (item_id, delta, kind, note, user_id)
  VALUES (p_item_id, -p_qty, 'venda', nullif(btrim(p_note), ''), v_user);

  RETURN v_sale_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.record_sale(uuid, integer, text, numeric) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_sale(uuid, integer, text, numeric) TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_sale(uuid, integer, text, numeric) TO service_role;