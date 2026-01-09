from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routers import auth, projects

app = FastAPI(title="SDLC AI Hub API", version="2.0")

# --- Configurare CORS (Foarte important pentru Frontend) ---
origins = [
    "http://localhost:3000", # Next.js Frontend
    "http://127.0.0.1:3000",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Includem Routerele ---
app.include_router(auth.router)
app.include_router(projects.router)

@app.get("/")
def read_root():
    return {"message": "SDLC AI Hub API is running 🚀"}