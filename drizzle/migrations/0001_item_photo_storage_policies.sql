create policy "fotos itens leitura" on storage.objects for select to authenticated using (bucket_id = 'fotos-itens');
create policy "fotos itens upload" on storage.objects for insert to authenticated with check (bucket_id = 'fotos-itens');
create policy "fotos itens update" on storage.objects for update to authenticated using (bucket_id = 'fotos-itens');
create policy "fotos itens delete" on storage.objects for delete to authenticated using (bucket_id = 'fotos-itens');