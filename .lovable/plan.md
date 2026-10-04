# Relatórios simples de estoque

## Objetivo
Adicionar uma página protegida de Relatórios, mantendo intactos os fluxos atuais de itens, compras, vendas, montagem e fornecedores.

## Implementação
- Incluir “Relatórios” no menu principal, seguindo o mesmo padrão visual das outras opções.
- Criar a página `/relatorios` com três indicadores e seletor de 30, 90 ou 365 dias.
- Calcular nos indicadores o total gasto em compras, as unidades vendidas e a quantidade de vendas dentro do período escolhido.
- Exibir um gráfico de barras com o custo mensal de compras nos últimos seis meses, incluindo meses sem compras.
- Exibir um gráfico horizontal com os dez itens mais vendidos, somando quantidades e relacionando cada registro ao nome do item.
- Reaproveitar as consultas existentes de compras, vendas e itens; adicionar a consulta de movimentações solicitada à biblioteca de estoque.
- Formatar valores em reais e datas/períodos em português do Brasil.

## Detalhes técnicos
- Usar React Query com `fetchPurchaseRecords`, `fetchSales` e `fetchItems`.
- Usar Recharts com dimensões responsivas e as cores semânticas do projeto.
- Manter a rota sob o grupo autenticado e adicionar metadados próprios da página.
- Tratar carregamento, falha e ausência de dados sem afetar outras telas.

## Validação
- Abrir Relatórios com uma sessão real.
- Comparar os totais e rankings com os históricos de Compras e Vendas.
- Alternar entre 30, 90 e 365 dias e confirmar a atualização dos três indicadores.
- Conferir os gráficos em tela larga e estreita e verificar a compilação final.
