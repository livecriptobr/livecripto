# 003 - LivePix Feature Parity

Meta-prompts to implement all LivePix features in LiveCripto.
Based on analysis of 16 screenshots from `C:\Users\Pichau\Desktop\livecripto`.

## Execution Order

| Phase | File | Description | Priority |
|-------|------|-------------|----------|
| 0 | `003-00-profile-customization.md` | Profile customization + donation page redesign | HIGH |
| 1 | `003-01-incentives-advanced.md` | Advanced TTS, AI voice, voice messages, media | HIGH |
| 2 | `003-02-polls.md` | Polls system (enquetes) | HIGH |
| 3 | `003-03-widgets.md` | Full widgets system (ranking, QR, marathon, etc) | HIGH |
| 4 | `003-04-moderation.md` | Advanced moderation (GPT, audio, blocked terms) | MEDIUM |
| 5 | `003-05-wallet-complete.md` | Complete wallet (history, receivables, limits) | HIGH |
| 6 | `003-06-verification-security.md` | Account verification + security | MEDIUM |
| 7 | `003-07-dashboard-sidebar-redesign.md` | Dashboard + sidebar matching LivePix | HIGH |
| 8 | `003-08-remote-controls.md` | Remote controls / StreamDeck | MEDIUM |
| 9 | `003-09-crowdfunding-rewards.md` | Vaquinhas, rewards, charity | LOW |

## Recommended Execution

**Sprint 1 (Core UI):** Phase 7 → 0 → 5
**Sprint 2 (Engagement):** Phase 2 → 3 → 1
**Sprint 3 (Safety):** Phase 4 → 6 → 8
**Sprint 4 (Community):** Phase 9

## How to Execute
Use `/taches-cc-resources:run-prompt` or execute each phase sequentially:
```
Read phase file → Execute tasks → Verify acceptance criteria → Next phase
```
