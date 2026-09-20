# Subir frontend e backend no mesmo repositório

Guia para enviar `frontend/` e `backend/` juntos para um único repositório no GitHub (por exemplo `https://github.com/usuario/projeto.git`).

O GitHub mostra a pasta vazia quando essa pasta tem um `.git` próprio. O repositório pai grava só um ponteiro, não os ficheiros.

## 1. Estrutura esperada

Na raiz do projeto deve existir **um único** `.git`. As pastas da aplicação são diretórios normais:

```text
projeto/
├── .git
├── .gitignore
├── README.md
├── docker-compose.yml
├── frontend/
│   ├── package.json
│   └── src/
└── backend/
    ├── package.json
    └── src/
```

Não pode existir:

```text
projeto/frontend/.git
projeto/backend/.git
```

## 2. Antes de qualquer commit: verificar

Na raiz do repositório:

```bash
git rev-parse --show-toplevel
```

Tem de apontar para a raiz (`projeto/`), não para `frontend/` nem `backend/`.

Confirmar que não há Git aninhado:

```bash
# PowerShell
Test-Path frontend/.git
Test-Path backend/.git

# bash
ls -la frontend/.git backend/.git
```

Se algum destes caminhos existir, vá à [secção 6](#6-corrigir-pasta-vazia-no-github) antes de continuar.

Confirmar como o Git vê as pastas:

```bash
git ls-tree HEAD frontend
git ls-tree HEAD backend
```

| Resultado | Significado |
|---|---|
| `040000 tree ... frontend` | Pasta real, com ficheiros. Correto. |
| `160000 commit ... backend` | Ponteiro (gitlink). A pasta vai vazia para o GitHub. Errado. |

## 3. `.gitignore` na raiz

Garantir que segredos e dependências não entram no Git:

```gitignore
node_modules
dist
.env
*.log
.DS_Store
frontend/node_modules
backend/node_modules
```

Cada pasta pode ter o seu `.gitignore`, mas o da raiz já deve cobrir `.env` e `node_modules`.

**Nunca** commitar `.env`, tokens, chaves ou `node_modules`.

## 4. Primeira vez: um repositório, duas pastas

Se o projeto ainda não está no GitHub, ou se as pastas foram criadas com `git init` à parte:

1. Na raiz, garantir um único repositório:

   ```bash
   git init
   ```

2. Remover Git aninhado, se existir:

   ```bash
   # PowerShell
   Remove-Item -Recurse -Force frontend/.git -ErrorAction SilentlyContinue
   Remove-Item -Recurse -Force backend/.git -ErrorAction SilentlyContinue

   # bash
   rm -rf frontend/.git backend/.git
   ```

3. Ligar o remoto (ajuste o URL):

   ```bash
   git remote add origin https://github.com/usuario/projeto.git
   ```

   Se o remoto já existir:

   ```bash
   git remote -v
   git remote set-url origin https://github.com/usuario/projeto.git
   ```

4. Adicionar as duas pastas como ficheiros normais:

   ```bash
   git add frontend backend
   git add .gitignore README.md docker-compose.yml
   ```

5. Confirmar que `.env` **não** está no stage:

   ```bash
   git diff --cached --name-only
   ```

   Se aparecer `.env`, retirar:

   ```bash
   git restore --staged frontend/.env backend/.env
   ```

6. Confirmar que não ficou gitlink:

   ```bash
   git ls-files -s frontend backend
   ```

   A primeira coluna tem de ser `100644` (ficheiros) ou o `git status` mostrar `new file: frontend/...` e `new file: backend/...`. Não pode aparecer só `backend` sem caminhos por baixo.

7. Commit e envio:

   ```bash
   git commit -m "Inclui frontend e backend no mesmo repositório."
   git branch -M main
   git push -u origin main
   ```

## 5. Atualizar um repositório que já existe

Quando `frontend/` e `backend/` já estão corretos no Git:

```bash
git status
git add frontend backend
git diff --cached --name-only
git commit -m "Atualiza frontend e backend."
git push origin main
```

Se só uma das pastas mudou, pode adicionar só essa. O remoto continua a ser o mesmo repositório.

## 6. Corrigir pasta vazia no GitHub

Sintoma: no GitHub a pasta `backend/` (ou `frontend/`) aparece sem ficheiros, ou como um commit de outro repositório.

### 6.1 Diagnóstico

```bash
git ls-files -s backend
```

`160000` na primeira coluna = gitlink. A pasta tem (ou teve) um `.git` próprio.

### 6.2 Correção

Na raiz:

```bash
# 1. Remover o Git interno da pasta afetada
# PowerShell
Remove-Item -Recurse -Force backend/.git

# bash
rm -rf backend/.git

# 2. Tirar o ponteiro do índice
git rm --cached backend

# 3. Adicionar os ficheiros de verdade
git add backend

# 4. Conferir: .env fora, código dentro
git diff --cached --name-only
```

Repetir `frontend` no lugar de `backend` se o problema for o frontend.

Depois:

```bash
git commit -m "Inclui o código da pasta no repositório principal."
git push origin main
```

No GitHub, atualize a página. A pasta deve mostrar `package.json`, `src/`, testes, etc.

## 7. Conferência depois do push

Na raiz:

```bash
git ls-tree HEAD frontend backend
```

Os dois têm de ser `040000 tree`, nunca `160000 commit`.

Listar ficheiros rastreados:

```bash
git ls-files frontend | more
git ls-files backend | more
```

Tem de aparecer caminhos como `frontend/src/App.tsx` e `backend/src/routes/index.js`, não uma linha só com `frontend` ou `backend`.

## 8. Regras para não repetir o problema

1. **Um `git init` na raiz.** Não rode `git init` dentro de `frontend/` nem de `backend/`.
2. **Não clone um repo dentro do outro.** Se o backend nasceu noutro GitHub, copie os ficheiros (sem a pasta `.git`) para `projeto/backend/`.
3. **Não use submodule** para este caso. Frontend e backend devem ser pastas do mesmo repositório.
4. **Antes do primeiro push**, rode `Test-Path frontend/.git` e `Test-Path backend/.git`. Os dois devem ser `False`.
5. **Não apague o `.git` da raiz.** Só apague `.git` que esteja *dentro* de `frontend/` ou `backend/`.

## 9. Checklist rápido

- [ ] Só existe `.git` na raiz do projeto
- [ ] Não existe `frontend/.git` nem `backend/.git`
- [ ] `git ls-tree HEAD frontend` e `backend` mostram `tree`, não `commit`
- [ ] `.env` e `node_modules` estão no `.gitignore` e fora do stage
- [ ] `git ls-files frontend` e `git ls-files backend` listam ficheiros dentro das pastas
- [ ] `git remote -v` aponta para o repositório único no GitHub
- [ ] `git push origin main` concluiu sem erro
- [ ] No GitHub, `frontend/` e `backend/` abrem com código
