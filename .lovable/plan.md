

# LocalizAI - Plano de Implementação

## Visão Geral
Aplicação web que permite usuários encontrarem os 3 locais mais próximos para realizar exame ocupacional, com base em uma planilha importada pelo próprio usuário.

---

## Funcionalidades

### 1. Cabeçalho e Identidade Visual
- Logo **LocalizAI** com "Localiz" em cinza/branco e "AI" em azul marinho
- Ícone de localização com elemento tecnológico
- Design limpo com paleta: branco, cinza claro, azul marinho e verde esmeralda

### 2. Importação de Planilha
- Área de upload para arquivo CSV ou Excel (.xlsx)
- Aceita planilhas com colunas: Nome do local, Latitude, Longitude
- Validação do formato e exibição de mensagem de erro se inválido
- Indicador visual quando planilha está carregada com sucesso

### 3. Formulário de Endereço
- Campos obrigatórios separados:
  - Endereço (rua/avenida)
  - Número
  - Bairro
  - Cidade
  - Estado (dropdown com estados brasileiros)
- Validação de campos antes da busca
- Botão "Buscar Locais Próximos"

### 4. Busca e Processamento
- Geocodificação via **Nominatim/OpenStreetMap** (gratuita)
- Cálculo de distância usando **fórmula de Haversine**
- Cache local para evitar chamadas repetidas ao mesmo endereço
- Indicador de carregamento durante processamento

### 5. Exibição de Resultados
- Lista com os **3 locais mais próximos**
- Cada card mostra: **Nome do local** e **Distância aproximada** (em km)
- Ordenação da menor para maior distância
- Mensagem informativa se nenhum local for encontrado

### 6. Tratamento de Erros
- Mensagem clara se endereço não puder ser geocodificado
- Alerta se planilha não estiver carregada
- Feedback visual para campos inválidos

---

## Experiência do Usuário
- Interface 100% em **Português (Brasil)**
- Design responsivo (desktop e mobile)
- Sem necessidade de login ou cadastro
- Fluxo simples: Importar planilha → Preencher endereço → Ver resultados

