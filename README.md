# Palavras Cruzadas de Encaixe

Aplicação que cria especificamente palavras cruzadas de encaixe, já que a minha mãe não gosta muito das palavras cruzadas tradicionais e é difícil de encontrar esse tipo de jogo pra comprar.

**Demo:** https://davidbitner.github.io/palavras-cruzadas-de-encaixe/

## O que faz

- Gera palavras cruzadas de encaixe (sem definições - só o encaixe das palavras pelo tamanho e pelas letras em comum) a partir de bancos de palavras por tema, ou de uma lista digitada manualmente
- Permite revelar palavras já preenchidas no jogo, incluindo controle de quantas ficam preenchidas
- Exporta um único jogo em PDF, pronto pra imprimir
- Também gera um "livro de atividades" em PDF com vários jogos inéditos de uma vez

## Rodando localmente

É um site estático, sem build nem dependências. Clone o repositório e abra o `index.html` no navegador, ou sirva com qualquer servidor de arquivos estático:

```bash
git clone https://github.com/DavidBitner/palavras-cruzadas-de-encaixe.git
cd palavras-cruzadas-de-encaixe
npx serve .
```

## Licença

Veja [LICENSE](./LICENSE).
