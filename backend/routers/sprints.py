from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional
from datetime import datetime

from database.session import get_db
from models.project import Sprint, Project, Task, TaskStatus
from models.user import User
from routers.auth import get_current_user
from utils.permissions import check_project_permission

router = APIRouter(prefix="/sprints", tags=["Sprints"])

# Schema de intrare (Input DTO)
class SprintCreate(BaseModel):
    name: str
    project_id: int
    goal: Optional[str] = None
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None

@router.post("/", response_model=dict) # Returnam simplu un dict sau poti face o schema SprintOut
def create_sprint(sprint_in: SprintCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    # Doar SM, PM sau Owner pot crea sprinturi
    check_project_permission(db, current_user.id, sprint_in.project_id, ["Scrum Master", "Project Manager", "Product Owner"])
    
    new_sprint = Sprint(
        name=sprint_in.name,
        project_id=sprint_in.project_id,
        goal=sprint_in.goal,
        start_date=sprint_in.start_date,
        end_date=sprint_in.end_date,
        is_active=False
    )
    db.add(new_sprint)
    db.commit()
    db.refresh(new_sprint)
    return {"message": "Sprint created", "id": new_sprint.id, "name": new_sprint.name}

@router.post("/{sprint_id}/start")
def start_sprint(sprint_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    sprint = db.query(Sprint).filter(Sprint.id == sprint_id).first()
    if not sprint:
        raise HTTPException(status_code=404, detail="Sprint not found")

    # Verificam permisiuni
    check_project_permission(db, current_user.id, sprint.project_id, ["Scrum Master", "Project Manager"])

    # Verificam daca exista DEJA un sprint activ (Regula Scrum)
    active_sprint = db.query(Sprint).filter(
        Sprint.project_id == sprint.project_id, 
        Sprint.is_active == True
    ).first()
    
    if active_sprint:
        raise HTTPException(status_code=400, detail=f"Sprint '{active_sprint.name}' is already active. Complete it first.")

    sprint.is_active = True
    db.commit()
    return {"message": "Sprint started successfully", "sprint": sprint.name}

# ... importurile existente

@router.get("/project/{project_id}")
def get_project_sprints(project_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """
    Returnează toate sprint-urile unui proiect (Active, Future, Closed).
    """
    # Verificăm că ești membru
    check_project_permission(db, current_user.id, project_id)
    
    return db.query(Sprint).filter(Sprint.project_id == project_id).order_by(Sprint.id.desc()).all()

@router.post("/{sprint_id}/complete")
def complete_sprint(sprint_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    sprint = db.query(Sprint).filter(Sprint.id == sprint_id).first()
    if not sprint:
        raise HTTPException(status_code=404, detail="Sprint not found")

    # 1. Permisiuni (Doar SM/PO/Manager)
    check_project_permission(db, current_user.id, sprint.project_id, ["Scrum Master", "Project Manager", "Product Owner"])

    if not sprint.is_active:
        raise HTTPException(status_code=400, detail="Sprint is not active.")

    # 2. Logica de "Cleanup": Mutăm task-urile neterminate înapoi în Backlog
    # Task-urile DONE rămân legate de acest sprint pentru istoric/rapoarte.
    unfinished_tasks = db.query(Task).filter(
        Task.sprint_id == sprint_id,
        Task.status != TaskStatus.DONE
    ).all()

    moved_count = 0
    for task in unfinished_tasks:
        task.sprint_id = None # Îl trimitem în Backlog
        moved_count += 1

    # 3. Dezactivăm Sprintul
    sprint.is_active = False
    
    # Opțional: Poți seta un field 'completed_at' dacă ai adăugat coloana în model
    # sprint.end_date = datetime.now() 

    db.commit()
    
    return {
        "message": f"Sprint completed. {moved_count} unfinished tasks moved to backlog.",
        "sprint": sprint.name
    }