# MeuFlux iOS

App nativo universal (iPhone + iPad), mínimo **iOS/iPadOS 26**, SwiftUI + Liquid Glass.

## Por que a tela ficou vazia?

Até esta rodada o login era **simulado** e as telas usavam **stubs vazios**. Agora o app:

1. autentica no **mesmo Supabase** do web
2. busca contas/transações no **pluggy-proxy** (mesmos paths do web)
3. monta o Dashboard / Contas com esses dados

## Setup para ver seus dados reais

```bash
# Na raiz do repo — gera Secrets.xcconfig a partir do .env do web
npm run ios:secrets
```

No Xcode:

1. Confirme que o target usa `MeuFluxApp/Config/Debug.xcconfig`
2. Confirme que `Info.plist` tem `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `API_BASE_URL`
3. Clean Build Folder → Run
4. Entre com o **mesmo e-mail/senha** do web

Se ainda vier vazio depois do login OK: no web, em **Conexões Bancárias**, confirme que há `pluggy_item_ids` no perfil e rode um sync.

## Build

```bash
cd ios
swift test
# regenera o .xcodeproj (já aplica o patch de SPM local):
brew install xcodegen && xcodegen generate && open MeuFlux.xcodeproj
```

Se o Xcode mostrar **Missing package product**, rode `xcodegen generate` de novo em `ios/` (o `postGenCommand` corrige o backlink dos pacotes locais).

## Arquitetura

Ver [docs/ios/architecture.md](../docs/ios/architecture.md).
