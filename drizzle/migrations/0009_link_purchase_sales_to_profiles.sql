ALTER TABLE public.purchase_records
  ADD CONSTRAINT purchase_records_user_id_profiles_fkey
  FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE RESTRICT;

ALTER TABLE public.sales
  ADD CONSTRAINT sales_user_id_profiles_fkey
  FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE RESTRICT;