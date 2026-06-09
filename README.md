# LabLeaf

Projeto academico para analise de folhas com IA, autenticacao de usuarios,
historico de resultados e relatorios.

## Backend

O backend usa FastAPI, SQLAlchemy e PostgreSQL. A API de IA fica separada: a
tela envia a imagem para `window.LABLEAF_AI_API_URL` em `config.js` e depois
salva o resultado neste backend.

Principais rotas:

- `POST /api/auth/register`: cria usuario.
- `POST /api/auth/login`: autentica e retorna token.
- `POST /api/auth/logout`: encerra sessao.
- `POST /api/auth/forgot-password`: gera token de recuperacao de senha.
- `POST /api/auth/reset-password`: redefine a senha com token valido.
- `GET /api/me`: retorna usuario autenticado.
- `PUT /api/profile`: atualiza nome e email.
- `PUT /api/profile/password`: troca senha do usuario autenticado.
- `GET /api/settings`: retorna preferencias da conta.
- `PUT /api/settings`: salva preferencias da conta.
- `GET /api/plans`: lista os planos disponiveis.
- `GET /api/subscription`: retorna plano ativo e saldo de tokens.
- `POST /api/subscription/checkout`: pagamento ficticio e ativacao do plano.
- `POST /api/analyses`: salva uma analise ja processada pela API de IA.
- `GET /api/analyses`: lista analises do usuario.
- `GET /api/reports/summary`: dados do dashboard.

Cada analise salva consome 1 token do plano ativo. Sem plano ativo ou sem
tokens disponiveis, o backend bloqueia o registro da analise.

## Rodar local

```bash
pip install -r requirements.txt
uvicorn main:app --reload
```

Por padrao, o backend usa SQLite local para desenvolvimento. Para usar
PostgreSQL, configure:

```bash
DATABASE_URL=postgresql://usuario:senha@localhost:5432/lableaf
```

Enquanto nao houver servico de e-mail configurado, `RETURN_RESET_TOKEN=true`
faz a tela de recuperacao mostrar o link de redefinicao gerado. Em producao,
troque para `false` depois de integrar um envio de e-mail.

## Deploy no Render

O arquivo `render.yaml` cria:

- um Web Service Python para o FastAPI;
- um banco Render PostgreSQL;
- a variavel `DATABASE_URL` ligada automaticamente ao banco.
- a variavel `AI_API_URL` para apontar para a API de IA separada.

No Render, crie um Blueprint apontando para este repositorio. Se a conta nao
permitir banco `free`, troque o plano do banco em `render.yaml` para
`basic-256mb`.

Depois que a API de IA estiver pronta, preencha `AI_API_URL` no Render. Se
abrir os HTMLs direto pelo navegador, tambem pode atualizar `config.js`:

```js
window.LABLEAF_AI_API_URL = "https://sua-api-ia.onrender.com/predict";
```
