# Lastro Contabilidade: landing page

Landing page de um **escritório de contabilidade fictício**. É um site estático (HTML, CSS e JavaScript puro), sem build e sem dependências, pronto para a Vercel.

## Estrutura

```
index.html              página principal
404.html                página de erro (a Vercel a usa automaticamente)
assets/css/style.css    estilos, animações e responsividade
assets/js/main.js       interações (scroll, hover, simulador, formulário)
assets/img/             favicon, ícone Apple e imagem de compartilhamento (OG)
vercel.json             URLs limpas, headers de segurança e cache de imagens
robots.txt              bloqueia indexação (o escritório é fictício)
```

## Rodar localmente

```bash
npm run dev
```

O site abre em http://localhost:3000. Sem Node, use `python -m http.server 3000`.

## Deploy na Vercel

**Pelo painel (recomendado):** suba o repositório para o GitHub, clique em *Add New → Project* na Vercel, importe o repositório e use o preset **Other**, sem comando de build e com o diretório de saída padrão. Cada push na `main` gera um novo deploy.

**Pela CLI:**

```bash
npm run deploy
```

## Personalização

| O quê | Onde |
| --- | --- |
| Telefone, WhatsApp, e-mail e endereço | `index.html`: procure por `3254-8190`, `97412-3386`, `lastrocontabil` e `Paulista` |
| Cores e fontes | variáveis em `:root`, no topo de `assets/css/style.css` |
| Preços dos planos | atributos `data-monthly` e `data-annual` em `index.html` |
| Lógica do simulador | constantes `RATE` e `SAVE` em `assets/js/main.js` |
| Dados do gráfico | atributo `data-chart` em `index.html` |

> **Atenção:** os contatos são fictícios, mas o número de WhatsApp pode pertencer a uma pessoa real. Troque-os antes de divulgar o link.

### Formulário

O formulário valida os campos e mostra a animação de "protocolado", mas **não envia dados para lugar nenhum**. Para receber mensagens de verdade, troque o trecho marcado com `Integração` em `main.js` por um `fetch` para Formspree, Resend, Web3Forms ou uma Vercel Function.

### Indexação

Como o escritório é fictício, o site vem com `noindex` (meta tag em `index.html` e `robots.txt`). Para que ele apareça no Google, remova a meta tag `robots` e troque `Disallow: /` por `Allow: /`.

## Efeitos incluídos

- Intro com contador, exibida uma vez por sessão
- Padrões *guilloché* (os mesmos das cédulas) gerados em SVG e girando em sentidos opostos
- Cédula 3D com inclinação, brilho holográfico e reflexo que acompanham o mouse
- Títulos revelados palavra por palavra, elementos com *fade* e parallax no scroll
- Faixas de impostos cuja velocidade e direção seguem a rolagem
- Gráfico de linha que se desenha durante a rolagem, com tooltips no hover
- Cartões empilhados (*sticky stack*) na seção de método
- Cursor personalizado, botões magnéticos, *spotlight* dourado e bordas iluminadas nos cards
- Simulador tributário interativo e alternância de preços mensal/anual
- Carimbo "PROTOCOLADO" no envio do formulário
- Respeita `prefers-reduced-motion` e continua funcionando sem JavaScript
