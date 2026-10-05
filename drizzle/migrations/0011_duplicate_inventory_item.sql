CREATE OR REPLACE FUNCTION public.duplicate_item(
  p_item_id uuid,
  p_new_name text,
  p_new_code text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_user uuid := auth.uid();
  v_new_item_id uuid;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  IF btrim(coalesce(p_new_name, '')) = '' THEN
    RAISE EXCEPTION 'O nome do novo item é obrigatório';
  END IF;

  IF btrim(coalesce(p_new_code, '')) = '' THEN
    RAISE EXCEPTION 'O código do novo item é obrigatório';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.items
    WHERE lower(btrim(code)) = lower(btrim(p_new_code))
       OR lower(btrim(name)) = lower(btrim(p_new_name))
  ) THEN
    RAISE EXCEPTION 'Já existe um item com este código/nome';
  END IF;

  INSERT INTO public.items (
    code,
    name,
    item_type,
    description,
    photo_url,
    product_line,
    quantity,
    min_quantity
  )
  SELECT
    btrim(p_new_code),
    btrim(p_new_name),
    item_type,
    description,
    photo_url,
    product_line,
    0,
    min_quantity
  FROM public.items
  WHERE id = p_item_id
  RETURNING id INTO v_new_item_id;

  IF v_new_item_id IS NULL THEN
    RAISE EXCEPTION 'Item original não encontrado';
  END IF;

  INSERT INTO public.bom_lines (parent_id, child_id, quantity)
  SELECT v_new_item_id, child_id, quantity
  FROM public.bom_lines
  WHERE parent_id = p_item_id;

  INSERT INTO public.item_suppliers (
    item_id,
    supplier_id,
    unit_cost,
    lead_time,
    is_primary
  )
  SELECT
    v_new_item_id,
    supplier_id,
    unit_cost,
    lead_time,
    is_primary
  FROM public.item_suppliers
  WHERE item_id = p_item_id;

  RETURN v_new_item_id;
EXCEPTION
  WHEN unique_violation THEN
    RAISE EXCEPTION 'Já existe um item com este código/nome';
END;
$function$;

REVOKE ALL ON FUNCTION public.duplicate_item(uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.duplicate_item(uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.duplicate_item(uuid, text, text) TO service_role;