from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routers import auth, workspaces, invitations, projects
# Vom adăuga restul routerelor pe parcurs

app = FastAPI(title="SDLC AI Hub API", version="2.0")

# --- CONFIGURARE CORS ---
origins = [
    "http://localhost:3000", # Next.js local
    "http://127.0.0.1:3000",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"], # Permite GET, POST, PUT, DELETE etc.
    allow_headers=["*"], # Permite Authorization header
)
# ------------------------

# Includem rutele
app.include_router(auth.router)
app.include_router(workspaces.router)
app.include_router(invitations.router)
app.include_router(projects.router)

@app.get("/")
def read_root():
    return {"message": "SDLC AI Hub API is running 🚀"}