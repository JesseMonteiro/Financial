# MeuFlux

App web (React) + **app nativo iOS** (SwiftUI / iOS 26 / Liquid Glass).

## Web

```bash
npm install
npm run dev
```

## iOS

Ver [ios/README.md](ios/README.md).

```bash
cd ios && swift test
# opcional: xcodegen generate && open MeuFlux.xcodeproj
```

## Qualidade

```bash
npm run lint
npm run test:fixtures
npm run test:ios
```

## Documentação

- Paridade web→iOS: [docs/ios/parity-inventory.md](docs/ios/parity-inventory.md)
- Arquitetura iOS: [docs/ios/architecture.md](docs/ios/architecture.md)
- OpenAPI BFF `/v1`: [docs/api/openapi-v1.yaml](docs/api/openapi-v1.yaml)
- Threat model: [docs/security/threat-model.md](docs/security/threat-model.md)
- Launch runbook: [docs/ios/launch-runbook.md](docs/ios/launch-runbook.md)
- Conectores de cartão: [docs/connectors/README.md](docs/connectors/README.md)
