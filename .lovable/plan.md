# Nome do responsável em compras e vendas

## Objetivo
Mostrar quem registrou cada compra e venda, sem alterar os fluxos existentes.

## Alterações
- Adicionar as relações de `purchase_records.user_id` e `sales.user_id` com `profiles.id`, mantendo as relações atuais com autenticação.
- Incluir o perfil responsável nas consultas dos históricos e expor `user_name`, com valor vazio tratado como `usuário`.
- Acrescentar `por [nome]` à linha de data e observação em Compras e Vendas.

## Validação
- Conferir que os dois históricos carregam normalmente e mostram o responsável em cada registro existente.
- Confirmar que cadastro, correção e exclusão continuam inalterados e que o app termina sem erros.

## Detalhes técnicos
- A mudança de banco será apenas aditiva, por duas chaves estrangeiras.
- Os dados continuarão protegidos pelas regras de acesso atuais; nenhuma permissão será ampliada.
- Somente `src/lib/inventory.ts`, Compras e Vendas serão ajustados no app.
