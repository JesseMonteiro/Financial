---
name: handoff
description: "Compactar a conversa atual em um documento de handoff para outro agente continuar o trabalho. Salvar no diretório temporário do OS."
---

# Handoff — Documento de Continuidade

Escrever um documento de handoff resumindo a conversa atual para que um agente novo possa continuar o trabalho sem perder contexto.

## Process

### 1. Capturar o Estado Atual

Incluir no documento:

**Contexto do trabalho:**
- O que estava sendo feito
- Por que estava sendo feito
- O que já foi completado
- O que ainda está pendente

**Decisões tomadas:**
- Decisões chave e suas razões
- Alternativas descartadas e por quê

**Estado do código:**
- Branches e commits relevantes
- Testes passando ou falhando
- Issues em aberto

**Referências:**
- Links para specs/issues no GitHub
- Paths de arquivos relevantes (sem duplicar conteúdo)
- Artifacts criados (screenshots, relatórios HTML)

### 2. Sugestão de Skills

Incluir seção "Suggested Skills" nomeando quais skills o próximo agente deve ler:

```markdown
## Suggested Skills
- `code-review`: para revisar o diff quando a implementação estiver pronta
- `tdd`: se ainda há testes a escrever
- `browser-qa`: para validação final de UI
```

### 3. Redação de Informações Sensíveis

Redactar:
- API keys e secrets
- Tokens de acesso
- Dados financeiros reais do usuário
- Informações pessoais identificáveis

### 4. Salvar

Salvar em diretório temporário do OS:
```bash
# macOS
$TMPDIR/meuflux-handoff-<timestamp>.md
# ex: /var/folders/.../T/meuflux-handoff-20260928-1154.md
```

Não commitar no repositório. Não salvar em `.agents/` (é memória de sessão, não do repo).

Dizer ao usuário o path exato do arquivo.

### 5. Quando o Usuário Passou Argumentos

Se o usuário descreveu em que a próxima sessão vai focar, adaptar o documento para esse foco: enfatizar o contexto mais relevante e as skills mais úteis para aquele objetivo.
