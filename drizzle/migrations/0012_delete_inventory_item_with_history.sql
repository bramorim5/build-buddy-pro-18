CREATE OR REPLACE FUNCTION public.delete_inventory_item(p_item_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.items WHERE id = p_item_id) THEN
    RAISE EXCEPTION 'Item não encontrado';
  END IF;

  DELETE FROM public.purchase_records WHERE item_id = p_item_id;
  DELETE FROM public.sales WHERE item_id = p_item_id;
  DELETE FROM public.movements WHERE item_id = p_item_id;
  DELETE FROM public.item_suppliers WHERE item_id = p_item_id;
  DELETE FROM public.bom_lines WHERE parent_id = p_item_id OR child_id = p_item_id;
  DELETE FROM public.items WHERE id = p_item_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.delete_inventory_item(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delete_inventory_item(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_inventory_item(uuid) TO service_role;