

# Plano: Reestruturação Multi-Tenant LocalizAI

## Visao Geral

Transformar o LocalizAI em um produto SaaS B2B com isolamento completo de dados entre empresas, mantendo intacta toda a logica de busca por endereco existente.

---

## Arquitetura Proposta

```text
+------------------+     +-------------------+     +------------------+
|   Tela de Login  |     |   Interface       |     |   Tela Admin     |
|   (Access Key)   | --> |   Principal       | --> |   (Admin Secret) |
+------------------+     +-------------------+     +------------------+
         |                       |                         |
         v                       v                         v
+------------------------------------------------------------------------+
|                        Contexto da Empresa                             |
|   - empresa_id (UUID)                                                  |
|   - nome da empresa                                                    |
|   - google_sheets_url                                                  |
+------------------------------------------------------------------------+
         |
         v
+------------------+     +-------------------+     +------------------+
|   Google Sheets  | --> |   Parse/Validate  | --> |   Busca Locais   |
|   (Vinculado)    |     |   CSV             |     |   (Inalterado)   |
+------------------+     +-------------------+     +------------------+
```

---

## Estrutura do Banco de Dados

### Tabela: empresas

| Coluna | Tipo | Descricao |
|--------|------|-----------|
| id | UUID (PK) | Identificador unico interno |
| nome | TEXT | Nome da empresa exibido na interface |
| access_key | TEXT (UNIQUE) | Chave de acesso para usuarios |
| admin_secret | TEXT | Codigo secreto para administracao |
| google_sheets_url | TEXT | Link publico da planilha Google Sheets |
| is_active | BOOLEAN | Empresa ativa/inativa |
| created_at | TIMESTAMPTZ | Data de criacao |
| updated_at | TIMESTAMPTZ | Data de atualizacao |

### SQL de Criacao

```sql
CREATE TABLE public.empresas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  access_key TEXT NOT NULL UNIQUE,
  admin_secret TEXT NOT NULL,
  google_sheets_url TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.empresas ENABLE ROW LEVEL SECURITY;

-- Politica: Leitura publica para validacao de access_key
CREATE POLICY "Allow public read for access validation"
  ON public.empresas
  FOR SELECT
  USING (true);

-- Trigger para atualizar updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER empresas_updated_at
  BEFORE UPDATE ON public.empresas
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();
```

---

## Fluxo de Acesso

### 1. Tela de Login (Access Key)

```text
Usuario acessa o site
        |
        v
+-------------------+
| Tela de Acesso    |
| [   Access Key  ] |
| [   Entrar      ] |
+-------------------+
        |
        v
Valida access_key no banco
        |
    +---+---+
    |       |
 Valida   Invalida
    |       |
    v       v
Armazena   Exibe erro
empresa    "Chave invalida"
em sessao
    |
    v
Redireciona para
interface principal
```

### 2. Interface Principal

- Header exibe nome da empresa ativa
- Campos de endereco: **INALTERADOS**
- Remove opcao de upload manual
- Carrega planilha automaticamente do google_sheets_url

### 3. Tela de Configuracoes (Admin)

- Acesso via rota /admin
- Exige validacao de admin_secret
- Permite editar google_sheets_url
- Permite visualizar informacoes da empresa

---

## Novas Paginas e Componentes

### Paginas

| Arquivo | Funcao |
|---------|--------|
| src/pages/Login.tsx | Tela de acesso com campo de chave |
| src/pages/Admin.tsx | Tela de configuracoes da empresa |

### Componentes

| Arquivo | Funcao |
|---------|--------|
| src/components/EmpresaHeader.tsx | Header com nome da empresa |
| src/components/AdminKeyDialog.tsx | Dialog para validar admin_secret |

### Contexto

| Arquivo | Funcao |
|---------|--------|
| src/contexts/EmpresaContext.tsx | Gerencia estado da empresa ativa |

### Hooks

| Arquivo | Funcao |
|---------|--------|
| src/hooks/useEmpresa.ts | Hook para acessar contexto da empresa |

---

## Alteracoes em Arquivos Existentes

### src/App.tsx

- Envolver app com EmpresaProvider
- Adicionar rotas /login e /admin
- Implementar protecao de rotas

### src/pages/Index.tsx

- Remover FileUpload
- Usar google_sheets_url da empresa ativa
- Carregar planilha automaticamente ao montar

### src/components/Header.tsx

- Exibir nome da empresa ao lado do logo
- Adicionar botao de configuracoes (visivel apenas com contexto admin)

---

## Validacao da Planilha Google Sheets

### Funcao: validateGoogleSheetsUrl

```text
Input: URL do Google Sheets
        |
        v
Extrai ID da planilha
        |
        v
Monta URL de exportacao CSV
        |
        v
Fetch do CSV
        |
    +---+---+
    |       |
  OK     Erro
    |       |
    v       v
Parse    Retorna erro
colunas  "Planilha inacessivel"
    |
    v
Valida colunas obrigatorias:
- nome_clinica OU nome do local
- latitude
- longitude
    |
    +---+---+
    |       |
 Validas  Invalidas
    |       |
    v       v
Retorna   Retorna erro
sucesso   com colunas faltantes
```

### Colunas Obrigatorias

A validacao sera flexivel para aceitar os nomes de colunas ja existentes no sistema:

| Campo | Nomes Aceitos |
|-------|---------------|
| Nome | nome do local, nome, local, name, nome_clinica |
| Latitude | latitude, lat |
| Longitude | longitude, lon, long, lng |

---

## Edge Function: validate-empresa

Nova Edge Function para validar acesso e carregar dados da empresa:

### Endpoints

| Metodo | Path | Funcao |
|--------|------|--------|
| POST | /validate | Valida access_key e retorna dados da empresa |
| POST | /admin-validate | Valida admin_secret para acesso admin |
| PUT | /update-settings | Atualiza google_sheets_url (requer admin) |

---

## Seguranca

### Armazenamento de Sessao

- Usar sessionStorage para empresa_id e admin_validated
- Limpar ao fechar aba/navegador
- Nao armazenar admin_secret no cliente

### Validacao Server-Side

- Todas operacoes admin validam admin_secret no servidor
- Edge Function valida antes de permitir alteracoes
- RLS protege dados no banco

### Proteção de Credenciais

- access_key: usado apenas para identificar empresa
- admin_secret: nunca exposto no cliente apos validacao
- Hashes podem ser implementados futuramente para maior seguranca

---

## Arquivos Nao Alterados

Os seguintes arquivos permanecem **100% inalterados**:

| Arquivo | Motivo |
|---------|--------|
| src/components/AddressForm.tsx | Logica de endereco intacta |
| src/lib/geocoding.ts | Geocodificacao inalterada |
| src/lib/routing.ts | Calculo de rotas inalterado |
| src/lib/haversine.ts | Calculo de distancia inalterado |
| src/components/ResultsList.tsx | Exibicao de resultados inalterada |
| supabase/functions/calculate-routes | Edge function inalterada |

---

## Resumo de Implementacao

### Fase 1: Banco de Dados

1. Criar tabela empresas com RLS
2. Inserir empresa de teste para desenvolvimento

### Fase 2: Contexto e Autenticacao

1. Criar EmpresaContext
2. Criar pagina de Login
3. Implementar protecao de rotas

### Fase 3: Interface Principal

1. Adaptar Index.tsx para carregar planilha automatica
2. Remover FileUpload da interface
3. Atualizar Header com nome da empresa

### Fase 4: Administracao

1. Criar pagina Admin
2. Criar dialog de validacao admin_secret
3. Implementar edicao de google_sheets_url

### Fase 5: Validacao e Edge Functions

1. Criar Edge Function validate-empresa
2. Implementar validacao de planilha
3. Testes end-to-end

---

## Estrutura Final de Arquivos

```text
src/
├── contexts/
│   └── EmpresaContext.tsx       [NOVO]
├── hooks/
│   ├── use-mobile.tsx
│   ├── use-toast.ts
│   └── useEmpresa.ts            [NOVO]
├── pages/
│   ├── Index.tsx                [MODIFICADO]
│   ├── Login.tsx                [NOVO]
│   ├── Admin.tsx                [NOVO]
│   └── NotFound.tsx
├── components/
│   ├── AddressForm.tsx          [INALTERADO]
│   ├── ResultsList.tsx          [INALTERADO]
│   ├── Header.tsx               [MODIFICADO]
│   ├── EmpresaHeader.tsx        [NOVO]
│   ├── AdminKeyDialog.tsx       [NOVO]
│   └── FileUpload.tsx           [REMOVIDO DA UI]
├── lib/
│   ├── geocoding.ts             [INALTERADO]
│   ├── routing.ts               [INALTERADO]
│   ├── haversine.ts             [INALTERADO]
│   ├── spreadsheet.ts           [INALTERADO]
│   └── empresa.ts               [NOVO - utils]
└── App.tsx                      [MODIFICADO]

supabase/
├── functions/
│   ├── calculate-routes/        [INALTERADO]
│   └── validate-empresa/        [NOVO]
└── config.toml                  [ATUALIZADO]
```

