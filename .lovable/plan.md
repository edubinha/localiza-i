
# Plano: Correção do Bug Visual - Linha Acima dos Campos

## Resumo

Corrigir a linha horizontal indesejada que aparece acima de alguns campos do formulário (visível especialmente no campo "Cidade").

---

## Diagnóstico

A linha horizontal visível acima dos campos é causada por estilos de **autofill do navegador** combinados com o container `relative` do componente `CityAutocomplete`. Quando o navegador aplica estilos de autocomplete/autofill, ele pode adicionar decorações visuais que aparecem como bordas extras.

---

## Solução

Aplicar estilos CSS para neutralizar os efeitos do autofill do navegador e garantir consistência visual.

### Arquivo 1: `src/components/ui/input.tsx`

Adicionar classes para remover decorações de autofill do navegador em todos os inputs:

```tsx
className={cn(
  "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
  // Novos estilos para remover decorações de autofill
  "[&:-webkit-autofill]:bg-background",
  "[&:-webkit-autofill]:[-webkit-box-shadow:0_0_0_1000px_hsl(var(--background))_inset]",
  "[&:-webkit-autofill]:[-webkit-text-fill-color:hsl(var(--foreground))]",
  className,
)}
```

### Arquivo 2: `src/components/CityAutocomplete.tsx`

Adicionar `overflow-hidden` ao container e garantir que não há bordas extras:

```tsx
<div ref={containerRef} className="relative overflow-hidden">
```

---

## Arquivos a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `src/components/ui/input.tsx` | Adicionar estilos anti-autofill |
| `src/components/CityAutocomplete.tsx` | Adicionar `overflow-hidden` ao container |

---

## Impacto

- **Visual**: Remove a linha indesejada que aparece acima dos campos
- **Compatibilidade**: Funciona em Chrome, Edge, Safari e Firefox
- **Sem quebras**: Não afeta a funcionalidade dos campos

