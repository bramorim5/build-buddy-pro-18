CREATE OR REPLACE FUNCTION public.create_inventory_item(
  p_code text,
  p_name text,
  p_item_type public.item_type,
  p_product_line text DEFAULT NULL,
  p_initial_quantity integer DEFAULT 0,
  p_min_quantity integer DEFAULT 10
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_item_id uuid;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado';
  END IF;
  IF btrim(coalesce(p_code, '')) = '' OR btrim(coalesce(p_name, '')) = '' THEN
    RAISE EXCEPTION 'Código e nome são obrigatórios';
  END IF;
  IF p_initial_quantity < 0 OR p_min_quantity < 0 THEN
    RAISE EXCEPTION 'Estoque e limite devem ser maiores ou iguais a zero';
  END IF;

  INSERT INTO public.items (code, name, item_type, product_line, quantity, min_quantity)
  VALUES (btrim(p_code), btrim(p_name), p_item_type, nullif(btrim(p_product_line), ''), p_initial_quantity, p_min_quantity)
  RETURNING id INTO v_item_id;

  IF p_initial_quantity > 0 THEN
    INSERT INTO public.movements (item_id, delta, kind, note, user_id)
    VALUES (v_item_id, p_initial_quantity, 'ajuste', 'Estoque inicial', v_user);
  END IF;

  RETURN v_item_id;
END;
$$;

REVOKE ALL ON FUNCTION public.create_inventory_item(text,text,public.item_type,text,integer,integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_inventory_item(text,text,public.item_type,text,integer,integer) TO authenticated, service_role;