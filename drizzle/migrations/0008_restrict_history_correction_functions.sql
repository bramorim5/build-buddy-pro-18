REVOKE ALL ON FUNCTION public.update_purchase_record(uuid, integer, numeric, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.update_sale_record(uuid, integer, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.delete_purchase_record(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.delete_sale_record(uuid) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.update_purchase_record(uuid, integer, numeric, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.update_sale_record(uuid, integer, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.delete_purchase_record(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.delete_sale_record(uuid) TO authenticated, service_role;