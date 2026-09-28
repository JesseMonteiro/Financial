# 08: Acessibilidade Liquid Glass: Contraste WCAG AA e Touch Targets

**What to build:**
Ajuste dos tokens de design system e ergonomia móvel:
1. Atualizar o token `--text-muted` no tema claro (`src/styles/variables.css`) de `#94a3b8` para `#64748b` (elevando o contraste para 4.6:1, atendendo WCAG AA).
2. Atualizar o token `--text-muted` no tema escuro para `#94a3b8` (contraste 5.4:1).
3. Escurecer os tokens de categoria `--cat-education` e `--cat-investments` no tema claro para legibilidade.
4. Garantir que botões e elementos interativos possuam altura/largura mínima de toque de 44×44px no viewport móvel (390×844).

**Blocked by:** Ticket 02

**Status:** done

- [x] Contraste de `--text-muted` contra branco atinge no mínimo 4.5:1
- [x] Textos secundários permanecem legíveis em ambientes claros
- [x] Botões em mobile atendem a área mínima de 44×44px
