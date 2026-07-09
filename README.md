# SDLC Hub

**Lucrare de licență:** „Dezvoltarea unei platforme web de management al proiectelor software cu funcționalități asistate de inteligența artificială”

SDLC Hub este o platformă web pentru managementul proiectelor software, construită pentru echipe care au nevoie de Scrum, Kanban sau Scrumban într-un singur produs. Aplicația combină task management, sprint planning, board interactiv, raportare, DevOps, suport, notificări, audit log și funcționalități asistate de AI local.

## Funcționalități principale

- Autentificare cu JWT, confirmare email, resetare parolă și sesiuni active.
- Onboarding proiect cu wizard, recomandare de metodologie și roluri sugerate de AI.
- Proiecte Scrum, Kanban și Scrumban cu tranziții controlate între metodologii.
- Task management complet: board, backlog, list view, story points, deadline, assignee, subtask-uri, comentarii și audit log.
- Guvernanță pentru acțiuni sensibile: delete task, invalidare estimare, arhivare proiect și permisiuni pe roluri.
- AI local prin Ollama pentru Spec Refiner, Poker Estimator, Workload Balancer, Release Notes, roluri și advisor de metodologie.
- Integrare GitHub: repository settings, webhook, commit/PR linking și audit DevOps.
- Calendar cu evenimente, meeting link, disponibilitate și concedii.
- Documentație/wiki generată automat din taskuri finalizate.
- Global Admin Console separată pentru utilizatori, proiecte, suport, AI usage, system health și regression testing.
- Testare automată cu Playwright pentru API, UI, responsive și fluxuri funcționale.

## Stack tehnologic

| Zonă | Tehnologii |
| --- | --- |
| Backend | Python, FastAPI, SQLAlchemy, Alembic, PostgreSQL, JWT, SMTP |
| Frontend | Next.js, TypeScript, Tailwind CSS, shadcn/ui, Radix UI, Zustand |
| AI | Ollama local, model implicit `qwen2.5-coder:7b`, provider custom opțional |
| DevOps | GitHub webhooks, ngrok, Tailscale, Playwright |
| Raportare | Recharts, export PDF, raport Markdown + SVG pentru testare |

## Structură proiect

```text
.
├── backend/                 # API FastAPI, modele, rute, servicii, migrări
├── frontend/                # Aplicația Next.js și testele Playwright
├── licenta/                 # Planuri, rapoarte și figuri pentru lucrare
├── scripts/                 # Scripturi de seed, testare și configurare locală
├── start.sh                 # Pornire backend + frontend în dezvoltare
└── README.md
```

## Cerințe locale

- Python 3.11+
- Node.js 20+
- PostgreSQL 16+
- Ollama instalat pe calculatorul care rulează modelul AI
- Model Ollama: `qwen2.5-coder:7b`
- Tailscale, dacă modelul AI rulează pe alt dispozitiv din rețea
- Gmail App Password sau un SMTP server valid pentru email

## Instalare după clone

### 1. Backend

```bash
python3 -m venv .venv
.venv/bin/python -m pip install -r backend/requirements.txt
```

### 2. Frontend

```bash
cd frontend
npm install
cd ..
```

### 3. PostgreSQL

```bash
sudo pg_ctlcluster 16 main start
sudo -u postgres psql -c "CREATE USER sdlc_user WITH PASSWORD 'sdlc_password';"
sudo -u postgres createdb -O sdlc_user sdlchub
```

Dacă userul sau baza există deja, este suficient ca `sdlc_user` și `sdlchub` să fie disponibile.

### 4. Fișiere de mediu

```bash
cp .env.example .env
cp frontend/.env.local.example frontend/.env.local
```

Exemplu minim pentru backend:

```env
DATABASE_URL=postgresql://sdlc_user:sdlc_password@localhost:5432/sdlchub
SECRET_KEY=schimba-aceasta-cheie-in-local
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=1440

FRONTEND_URL=http://127.0.0.1:3000
BACKEND_URL=http://127.0.0.1:8000

MAIL_USERNAME=adresa-ta@gmail.com
MAIL_PASSWORD=app-password-generat-de-google
MAIL_FROM=adresa-ta@gmail.com
MAIL_SERVER=smtp.gmail.com
MAIL_PORT=587
MAIL_STARTTLS=true
MAIL_SSL_TLS=false
MAIL_TIMEOUT=20

LOCAL_AI_PROVIDER_NAME=Qwen local (Ollama)
LOCAL_AI_BASE_URL=http://100.121.227.11:11434
LOCAL_AI_MODEL=qwen2.5-coder:7b
LOCAL_AI_AUTO_DETECT=true
```

Pentru Gmail SMTP nu se folosește parola normală a contului. Este necesar un **App Password** generat din contul Google cu 2FA activ.

### 5. Migrări

```bash
.venv/bin/alembic -c backend/alembic.ini upgrade head
```

### 6. Pornire aplicație

```bash
./start.sh
```

URL-uri utile:

- Frontend: <http://127.0.0.1:3000>
- Backend health: <http://127.0.0.1:8000/health>
- Swagger UI: <http://127.0.0.1:8000/docs>

## AI local cu Ollama

Aplicația este local-first pentru AI. Implicit folosește Ollama cu modelul `qwen2.5-coder:7b`, disponibil la:

```text
http://100.121.227.11:11434
```

Dacă backend-ul rulează în WSL, iar Ollama este instalat pe Windows, Ollama trebuie să asculte pe o interfață vizibilă din WSL:

```powershell
powershell.exe -ExecutionPolicy Bypass -NoProfile -File .\scripts\configure_windows_ollama.ps1
```

Sau:

```bat
scripts\configure_windows_ollama.cmd
```

Verificare din WSL:

```bash
curl http://$(awk '/nameserver/{print $2; exit}' /etc/resolv.conf):11434/api/tags
```

Verificare prin Tailscale:

```bash
curl http://100.121.227.11:11434/api/tags
```

În aplicație, testarea se face din `Settings -> Project AI provider -> Test provider`.

## Provider AI custom

Owner-ul proiectului poate folosi:

- cheia AI locală a platformei;
- un provider Ollama propriu;
- un provider compatibil OpenAI, cu cheie introdusă de owner.

Cheile custom sunt criptate server-side și nu sunt trimise înapoi către browser.

## Date demo

Pentru demo-uri mai bogate, pot fi rulate scripturile din `scripts/`, de exemplu seed pentru suport/admin sau scenarii demo. Rulează-le doar pe baza locală de dezvoltare.

```bash
.venv/bin/python scripts/seed_admin_support_demo.py
```

## Testare automată

Testele Playwright acoperă API, fluxuri funcționale, UI desktop, UI mobil, responsive și funcționalități AI.

```bash
cd frontend
SDLC_TEST_EMAIL="email@exemplu.ro" SDLC_TEST_PASSWORD="parola" npm run test:e2e:licenta
```

Raportul HTML este generat în:

```text
frontend/playwright-report/index.html
```

Raportul pentru lucrarea de licență este generat în:

```text
licenta/RAPORT_TESTARE_PLAYWRIGHT.md
licenta/figures/playwright-summary.svg
```

Pentru generarea raportului din rezultatele existente:

```bash
cd frontend
npm run test:e2e:licenta-report
```

## Scripturi utile

```bash
./start.sh                              # pornește backend + frontend
cd frontend && npm run dev              # pornește doar frontend
.venv/bin/python -m uvicorn backend.main:app --reload
cd frontend && npm run lint
cd frontend && npm run build
cd frontend && npm run test:e2e:licenta
```

## Observații de securitate

- Nu comita fișiere `.env`, parole, API keys sau App Passwords.
- Cheile AI custom sunt criptate în baza de date.
- Audit log-ul este folosit pentru modificări relevante de task, proiect, workflow, comentarii și setări.
- Acțiunile sensibile sunt protejate prin permisiuni de proiect și roluri.

## Troubleshooting

### Emailul nu se trimite

Verifică:

- `MAIL_USERNAME`, `MAIL_PASSWORD`, `MAIL_FROM`
- `MAIL_STARTTLS=true`
- `MAIL_SSL_TLS=false`
- App Password valid pentru Gmail
- portul `587`

### AI-ul local nu răspunde

Verifică:

- Ollama este pornit;
- modelul există: `ollama list`;
- backend-ul poate accesa `http://100.121.227.11:11434/api/tags`;
- Tailscale este conectat;
- firewall-ul permite portul `11434`;
- pe Windows, `OLLAMA_HOST=0.0.0.0:11434`.

### Frontend-ul nu vede backend-ul

Verifică `frontend/.env.local`:

```env
NEXT_PUBLIC_API_URL=http://127.0.0.1:8000
NEXT_PUBLIC_WS_URL=ws://127.0.0.1:8000/ws
```

## Autor

Preda Slavoliub-Denis

Proiect realizat pentru lucrarea de licență: **Dezvoltarea unei platforme web de management al proiectelor software cu funcționalități asistate de inteligența artificială**.
