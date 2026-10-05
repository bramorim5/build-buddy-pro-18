# Correção segura dos históricos

## Objetivo
Permitir editar e excluir compras e vendas já registradas, revertendo ou compensando o estoque automaticamente e sem alterar as demais áreas do app.

## O que será feito
- Adicionar ações de editar e excluir em cada linha dos históricos de Compras e Vendas.
- Abrir um diálogo de edição com:
  - Compra: quantidade, custo unitário e observação.
  - Venda: quantidade e observação.
- Exibir uma confirmação antes da exclusão, informando claramente que o saldo do item será revertido.
- Atualizar imediatamente os históricos, saldos e movimentações após cada operação.
- Manter a observação anterior com um complemento indicando a quantidade e o custo anteriores nas correções de compra; nas vendas, registrar a quantidade anterior.

## Regras de estoque
- Compra corrigida: aplicar ao saldo somente a diferença entre a quantidade nova e a antiga.
- Venda corrigida: retirar estoque quando a quantidade aumenta e devolver quando diminui.
- Compra excluída: subtrair do estoque toda a quantidade originalmente comprada.
- Venda excluída: devolver ao estoque toda a quantidade originalmente vendida.
- Bloquear qualquer correção ou exclusão que deixaria o estoque negativo.
- Registrar cada diferença ou reversão no histórico de movimentações como ajuste.

## Detalhes técnicos e segurança
- Criar quatro funções atômicas no banco para editar/excluir compras e vendas, todas exigindo usuário autenticado e bloqueando os registros envolvidos durante o cálculo.
- Liberar execução somente para usuários autenticados e para o serviço interno.
- Manter UPDATE e DELETE diretos das tabelas bloqueados. As políticas diretas pedidas no arquivo permitiriam alterar históricos sem ajustar o estoque; as quatro funções seguras atendem à funcionalidade sem abrir essa inconsistência.
- Criar os quatro wrappers solicitados em `@/lib/inventory` e usá-los nas duas páginas.
- Não alterar Itens, Montagem, Fornecedores, Painel ou outras funcionalidades.

## Validação
- Criar dados temporários de compra e venda com uma sessão real.
- Editar a quantidade de uma compra e confirmar a diferença exata no saldo e a movimentação de ajuste.
- Excluir uma venda e confirmar a devolução exata ao saldo e a movimentação de ajuste.
- Conferir diálogos, confirmações, mensagens e atualização das listas em tela.
- Remover os dados temporários e restaurar os saldos ao final.
