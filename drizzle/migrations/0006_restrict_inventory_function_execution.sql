REVOKE ALL ON FUNCTION public.adjust_stock(uuid, integer, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.adjust_stock(uuid, integer, text) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.assemble(uuid, integer, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.assemble(uuid, integer, uuid) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.create_inventory_item(text, text, public.item_type, text, integer, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_inventory_item(text, text, public.item_type, text, integer, integer) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.receive_purchase(uuid, integer, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.receive_purchase(uuid, integer, text) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC;