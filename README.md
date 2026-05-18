Licenta - Preda Slavoliub-Denis

## Ce mai rămâne de implementat / îmbunătățit

### Stabilizare proiect
- Curățare fișiere temporare: patch_*.py, verify_*.py, make_batch_*.sh, .bak_*.
- Verificare finală Alembic: current + heads.
- Verificare seed demo final.
- Backup bază de date.
- Actualizare PLAN_CONTINUARE_LICENTA_SDLC_HUB.txt.

### Notificări
- Dropdown rapid la clopoțel.
- Scheduler automat pentru due soon / overdue tasks.
- Notificări AI risk complet validate.
- Notificări pentru GitHub events și documentation generated.
- Grupare notificări pe proiect.

### Live updates
- WebSocket sau SSE.
- Refresh live pentru board, tasks, comments, calendar, notifications.
- Invalidare cache când alt utilizator modifică date.
- Refresh live pentru avatar/nume/team/assignee chips.

### @mentions
- Autocomplete frontend pentru membri proiect.
- Highlight pentru @mentions în comments.
- Link de la mention către user/membru.

### GitHub / DevOps avansat
- Configurare repository per project.
- UI pentru webhook setup instructions.
- GitHub OAuth.
- Mapare GitHub user -> SDLC Hub user.
- Suport pentru GitHub issues.
- Deployment/release events.
- Evitare duplicate mai avansată.

### Documentation / Wiki avansat
- Markdown renderer complet.
- Search în documentație.
- Tags/categorii.
- Version history.
- Buton Generate documentation direct în task detail.
- Export PDF pentru documentation.
- AI improve/regenerate page.

### Reports avansat
- Sprint report.
- Member performance report.
- Risk report.
- DevOps report.
- Documentation coverage report.
- Export CSV.
- Interval custom pentru rapoarte.

### Security hardening
- Rate limiting.
- Audit pentru login.
- Refresh tokens.
- CORS strict pentru production.
- Validări suplimentare input.
- Sanitizare Markdown/documentație.
- Testare permisiuni pe endpoint-urile noi.
- Secret rotation pentru webhook/API keys.

### Testing
- Unit tests backend.
- Integration tests pentru endpoint-uri importante.
- E2E browser tests.
- Teste pentru permissions.
- Teste pentru GitHub webhook signature.
- Teste pentru export PDF.

### Deployment / Production
- Docker Compose final.
- Config production env.
- CI/CD pipeline.
- Logging mai structurat.
- Monitorizare erori.
- Deployment pe server/cloud.

### Demo licență
- Seed demo final cu date curate.
- Useri demo documentați.
- Task-uri pe toate statusurile.
- Evenimente calendar demo.
- Notificări demo.
- Documentation pages demo.
- GitHub events demo.
- Rapoarte populate.
- Capturi de ecran.
- Flow de prezentare pentru comisie.

### Cel mai important de menționat ca neimplementat încă:

- WebSocket/SSE live updates
- dropdown notifications
- autocomplete @mentions
- scheduler due soon/overdue
- GitHub OAuth/config repo din UI
- version history/search pentru documentation
- teste automate complete
- deployment production

## Ce mai rămâne de îmbunătățit la AI

- Conectare completă și stabilă cu Gemini în toate modulele AI.
- Prompt engineering mai bun pentru descrieri, documentație și workload.
- AI chat assistant contextual pentru proiect.
- AI sprint planning assistant.
- AI backlog refinement.
- AI task splitting: împărțirea unui task mare în subtasks.
- AI acceptance criteria generator.
- AI bug triage.
- AI risk notifications automate.
- AI documentation improve/regenerate.
- AI report summary pentru rapoarte PDF.
- AI DevOps insights pe baza GitHub events.
- Salvarea istoricului de recomandări AI.
- Buton de feedback pentru sugestiile AI.
- Limitare/rate limit pentru apeluri AI.
- Tratarea costurilor și erorilor API.


## Status AI

Implementat parțial și funcțional:
- AI generated task description;
- AI methodology recommendation;
- AI role suggestions;
- AI workload suggestions;
- AI documentation generation from DONE tasks;
- fallback mode când Gemini API key lipsește.

## Neimplementat complet:
- AI assistant conversațional;
- AI sprint planning;
- AI backlog refinement;
- AI DevOps insights;
- AI risk notifications automate;
- AI summaries avansate pentru reports.