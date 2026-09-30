# Gestão de estoque mais intuitiva

## Objetivo
Tornar peças, submontagens, produtos, estruturas e fornecedores fáceis de cadastrar, editar e remover, além de corrigir e deixar claras as falhas nas páginas de fornecedores e montagem.

## O que será alterado
- **Itens:** adicionar um cadastro rápido com tipo, código, nome, linha, estoque inicial e limite de aviso; permitir editar os dados principais e excluir itens com confirmação e proteção quando houver vínculos.
- **Estrutura do produto:** mostrar a estrutura mesmo quando estiver vazia; incluir busca para adicionar componentes, ajuste simples de quantidade e ação de remover cada componente.
- **Fornecedores:** tratar carregamento e erros de forma visível; permitir cadastrar, editar e excluir fornecedores; mostrar e gerenciar os itens vinculados, custo, prazo e fornecedor principal.
- **Montagem:** tratar falhas de carregamento; separar produtos finais e submontagens; facilitar a busca/seleção e mostrar claramente disponibilidade, faltas e consumo antes da confirmação.
- **Confiabilidade:** manter todas as alterações de estoque nas operações seguras existentes e validar as telas principais com uma sessão real.

## Detalhes técnicos
- Reutilizar as tabelas atuais de itens, estruturas e fornecedores no Lovable Cloud.
- Atualizar os dados em tela imediatamente após cada cadastro, edição, vínculo ou remoção.
- Impedir vínculos duplicados, um item dentro de si mesmo e exclusões que quebrariam estruturas ou históricos.
- Incluir estados de carregamento, lista vazia e erro nas consultas das páginas afetadas.
