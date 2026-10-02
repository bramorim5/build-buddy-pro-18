# Vendas e histórico financeiro de compras

## Objetivo
Permitir dar baixa em produtos finais por venda e registrar quanto foi pago em cada compra, mantendo históricos claros e separados.

## O que será alterado
- **Compras:** aceitar valor total do lote ou valor unitário, calcular automaticamente o valor correspondente e registrar fornecedor, quantidade, observação, data e valores.
- **Histórico de compras:** exibir na própria aba as compras mais recentes, com item, fornecedor, quantidade, custo unitário e total.
- **Vendas:** criar uma nova aba para selecionar somente produtos finais, informar a quantidade e uma observação opcional, descontando o estoque com proteção contra saldo negativo.
- **Histórico de vendas:** exibir na própria aba produto, quantidade, observação, responsável e data.
- **Navegação:** incluir “Vendas” no menu principal.

## Confiabilidade
- Registrar entrada/baixa de estoque e seu histórico financeiro na mesma operação, evitando registros incompletos.
- Manter as páginas protegidas pelo login atual.
- Validar compras e vendas com uma sessão real, incluindo tentativa de venda acima do estoque.

## Detalhes técnicos
- Criar registros próprios de compras e vendas vinculados aos itens, fornecedores e usuário autenticado.
- Usar funções seguras do banco para registrar cada operação e atualizar o saldo de forma atômica.
- Preservar o histórico geral de movimentações já existente.
