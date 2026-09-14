# App Store / TestFlight operations checklist

## Pre-flight

- [ ] `npm run test:fixtures` green
- [ ] `cd ios && swift test` green
- [ ] CI workflow green on PR
- [ ] OpenAPI `/v1` deployed to staging Edge Function
- [ ] Feature flags reviewed (`FEATURE_PUSH`, kill switches)
- [ ] PrivacyInfo.xcprivacy present
- [ ] No Pluggy secrets in app binary / Info.plist
- [ ] App Privacy nutrition labels match collected data
- [ ] Demo/review account or sandbox notes for App Review
- [ ] `includeSandbox` disabled for production Pluggy Connect

## TestFlight waves

1. Internal — login, dashboard, accounts (demo/staging)
2. Closed — Pluggy Connect on device + credit fixtures banks
3. External — push, widgets, joint, Telegram

## Phased release

5% → 25% → 50% → 100% with daily crash-free / sync SLO check.

## Kill switches

| Env | Effect |
|---|---|
| `KILL_PLUGGY=true` | Disable Open Finance sync |
| `KILL_GEMINI=true` | Disable PDF/voice parsing |
| `KILL_TELEGRAM=true` | Disable bot replies |

## Rollback

1. Disable feature flag for failing module
2. Revert Edge Function deploy if contract regression
3. Halt phased release in App Store Connect

