CREATE TABLE public.purchase_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id uuid NOT NULL REFERENCES public.items(id) ON DELETE RESTRICT,
  supplier_id uuid REFERENCES public.suppliers(id) ON DELETE SET NULL,
  quantity integer NOT NULL CHECK (quantity > 0),
  unit_cost numeric(14, 4) NOT NULL CHECK (unit_cost >= 0),
  total_cost numeric(14, 2) NOT NULL CHECK (total_cost >= 0),
  note text,
  user_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.purchase_records TO authenticated;
GRANT ALL ON public.purchase_records TO service_role;

ALTER TABLE public.purchase_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "purchase records read"
ON public.purchase_records FOR SELECT TO authenticated
USING (true);

CREATE POLICY "purchase records insert"
ON public.purchase_records FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE INDEX purchase_records_created_at_idx ON public.purchase_records (created_at DESC);
CREATE INDEX purchase_records_item_id_idx ON public.purchase_records (item_id);

CREATE TABLE public.sales (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id uuid NOT NULL REFERENCES public.items(id) ON DELETE RESTRICT,
  quantity integer NOT NULL CHECK (quantity > 0),
  note text,
  user_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.sales TO authenticated;
GRANT ALL ON public.sales TO service_role;

ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sales read"
ON public.sales FOR SELECT TO authenticated
USING (true);

CREATE POLICY "sales insert"
ON public.sales FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE INDEX sales_created_at_idx ON public.sales (created_at DESC);
CREATE INDEX sales_item_id_idx ON public.sales (item_id);

CREATE OR REPLACE FUNCTION public.record_purchase(
  p_item_id uuid,
  p_qty integer,
  p_supplier_id uuid DEFAULT NULL,
  p_unit_cost numeric DEFAULT NULL,
  p_total_cost numeric DEFAULT NULL,
  p_note text DEFAULT NULL
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

  INSERT INTO public.purchase_records (item_id, supplier_id, quantity, unit_cost, total_cost, note, user_id)
  VALUES (p_item_id, p_supplier_id, p_qty, v_unit_cost, v_total_cost, nullif(btrim(p_note), ''), v_user)
  RETURNING id INTO v_record_id;

  INSERT INTO public.movements (item_id, delta, kind, note, user_id)
  VALUES (p_item_id, p_qty, 'compra', nullif(btrim(p_note), ''), v_user);

  RETURN v_record_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.record_purchase(uuid, integer, uuid, numeric, numeric, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_purchase(uuid, integer, uuid, numeric, numeric, text) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.record_sale(
  p_item_id uuid,
  p_qty integer,
  p_note text DEFAULT NULL
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
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Acesso negado'; END IF;
  IF p_qty IS NULL OR p_qty <= 0 THEN RAISE EXCEPTION 'Quantidade inválida'; END IF;

  SELECT quantity, item_type INTO v_current, v_type
  FROM public.items WHERE id = p_item_id FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'Item não encontrado'; END IF;
  IF v_type <> 'produto' THEN RAISE EXCEPTION 'Somente produtos finais podem ser vendidos'; END IF;
  IF v_current < p_qty THEN RAISE EXCEPTION 'Estoque insuficiente (disponível: %)', v_current; END IF;

  UPDATE public.items
  SET quantity = quantity - p_qty, updated_at = now()
  WHERE id = p_item_id;

  INSERT INTO public.sales (item_id, quantity, note, user_id)
  VALUES (p_item_id, p_qty, nullif(btrim(p_note), ''), v_user)
  RETURNING id INTO v_sale_id;

  INSERT INTO public.movements (item_id, delta, kind, note, user_id)
  VALUES (p_item_id, -p_qty, 'venda', nullif(btrim(p_note), ''), v_user);

  RETURN v_sale_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.record_sale(uuid, integer, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_sale(uuid, integer, text) TO authenticated, service_role;