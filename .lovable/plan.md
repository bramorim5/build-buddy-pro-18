# Período mensal nos relatórios

## Alteração
- Substituir o controle atual por um seletor de modo com “Rápido” e “Por mês”.
- No modo Rápido, manter 30, 90 e 365 dias e acrescentar 6 e 12 meses.
- No modo Por mês, exibir seletores de mês e ano; iniciar no mês e ano atuais de São Paulo.
- Montar a lista de anos a partir das datas existentes em compras e vendas, do mais recente ao mais antigo, incluindo o ano atual.

## Aplicação dos filtros
- Filtrar compras e vendas antes de calcular qualquer card ou gráfico.
- No modo mensal, considerar exatamente o início e o fim do mês no fuso America/Sao_Paulo.
- No modo rápido, aplicar o período escolhido a cards e aos dois gráficos.
- O gráfico de compras agrupará os registros filtrados por mês; o ranking usará somente as vendas filtradas.
- Quando não houver registros no período, os gráficos mostrarão “Sem dados para este período”.

## Escopo e validação
- Alterar somente a página Relatórios e registrar a tarefa no roteiro do projeto.
- Validar com sessão real um mês com compras, comparando o total com os registros desse mês.
- Validar um mês vazio, os controles rápido/mensal e a mensagem de ausência de dados.
