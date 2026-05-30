Licenta - Preda Slavoliub-Denis

## Local setup dupa clone

Aplicatia este configurata sa ruleze local pe PostgreSQL.

1. Creeaza mediul Python si instaleaza backend-ul:

```bash
python3 -m venv .venv
.venv/bin/python -m pip install -r backend/requirements.txt
```

2. Creeaza fisierele locale de mediu:

```bash
cp .env.example .env
cp frontend/.env.local.example frontend/.env.local
```

3. Porneste PostgreSQL si asigura baza locala:

```bash
sudo pg_ctlcluster 16 main start
sudo -u postgres psql -c "CREATE USER sdlc_user WITH PASSWORD 'sdlc_password';"
sudo -u postgres createdb -O sdlc_user sdlchub
```

Daca userul sau baza exista deja, comenzile `CREATE USER` / `createdb` pot raporta eroare; este suficient ca `sdlc_user` si `sdlchub` sa existe.

4. Instaleaza frontend-ul:

```bash
cd frontend
npm install
cd ..
```

5. Ruleaza migrarile:

```bash
.venv/bin/alembic -c backend/alembic.ini upgrade head
```

6. Porneste proiectul:

```bash
./start.sh
```

URL-uri:

- Frontend: http://127.0.0.1:3000
- Backend health: http://127.0.0.1:8000/health

Pentru email real cu Gmail, foloseste un App Password:

```env
MAIL_USERNAME=adresa-ta@gmail.com
MAIL_PASSWORD=app-password-generat-de-google
MAIL_FROM=adresa-ta@gmail.com
MAIL_SERVER=smtp.gmail.com
MAIL_PORT=587
MAIL_STARTTLS=true
MAIL_SSL_TLS=false
MAIL_TIMEOUT=20
```

Parola normala de Gmail nu functioneaza pentru SMTP; Google cere App Password daca ai 2FA activ.
