from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from pydantic import BaseModel

from database.session import get_db
from models.user import User
from models.project import Task, Project, Sprint
from schemas.task import TaskCreate, TaskUpdate, TaskOut
from routers.auth import get_current_user
from services.ai_service import generate_task_metadata 
from utils.permissions import check_project_permission

router = APIRouter(prefix="/tasks", tags=["Tasks"])

# --- LOCAL SCHEMA PENTRU AI ---
class AIRequest(BaseModel):
    title: str
    priority: str
    context: str = "Software Development"

# --- CREATE TASK ---
@router.post("/", response_model=TaskOut)
def create_task(task_in: TaskCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    # 1. Verificăm permisiunile
    check_project_permission(db, current_user.id, task_in.project_id)

    project = db.query(Project).filter(Project.id == task_in.project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    # 2. Generăm cheia (ex: VEN-1)
    count = db.query(Task).filter(Task.project_id == task_in.project_id).count()
    task_key = f"{project.key}-{count + 1}"

    new_task = Task(
        key=task_key,
        title=task_in.title,
        description=task_in.description,
        priority=task_in.priority,
        story_points=task_in.story_points,
        project_id=task_in.project_id,
        assignee_id=task_in.assignee_id,
        sprint_id=task_in.sprint_id # Poate fi null (Backlog)
    )
    db.add(new_task)
    db.commit()
    db.refresh(new_task)
    return new_task

# --- GET TASKS (POLYMORPHIC) ---
@router.get("/project/{project_id}", response_model=List[TaskOut])
def get_project_tasks(
    project_id: int, 
    view: Optional[str] = Query("board", description="board or backlog"),
    db: Session = Depends(get_db), 
    current_user: User = Depends(get_current_user)
):
    check_project_permission(db, current_user.id, project_id)

    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    query = db.query(Task).filter(Task.project_id == project_id)

    # LOGICA SCRUM BOARD: Doar sprint activ
    if project.methodology == "SCRUM" and view == "board":
        active_sprint = db.query(Sprint).filter(
            Sprint.project_id == project_id,
            Sprint.is_active == True
        ).first()

        if active_sprint:
            query = query.filter(Task.sprint_id == active_sprint.id)
        else:
            return [] # Board gol dacă nu e sprint activ
            
    # LOGICA BACKLOG (Scrum) - Momentan returnăm tot ce e în proiect pentru Backlog Page
    # Frontend-ul filtrează ce e în sprinturi vs ce e unassigned.
    
    return query.all()

# --- UPDATE TASK (FIXED) ---
@router.put("/{task_id}", response_model=TaskOut)
def update_task(task_id: int, task_in: TaskUpdate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    # 1. MAI ÎNTÂI GĂSIM TASK-UL (Aici era eroarea NameError)
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    
    # 2. Verificăm permisiunile pe baza task-ului găsit
    member = check_project_permission(db, current_user.id, task.project_id)
    
    # Determinăm rolurile
    user_role = member.role.name if (member and member.role) else "Member"
    is_project_owner = (task.project.owner_id == current_user.id)
    is_tech_admin = is_project_owner or (user_role in ["Scrum Master", "Tech Lead", "Project Manager"])

    # 3. Governance: Story Points
    if task_in.story_points is not None and task_in.story_points != task.story_points:
        if not is_tech_admin:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN, 
                detail="Governance: Only Tech Leads can change Story Points."
            )
        task.story_points = task_in.story_points

    # 4. Updates standard
    # Verificăm explicit sprint_id
    if task_in.sprint_id is not None:
        # Dacă primim 0 sau un număr pozitiv, îl setăm. Dacă e 0, înseamnă "Scoate din sprint" (dar DB acceptă NULL)
        # Backend logic: if ID > 0 assign, else (0) make None
        task.sprint_id = task_in.sprint_id if task_in.sprint_id > 0 else None

    if task_in.status:
        task.status = task_in.status
    if task_in.priority:
        task.priority = task_in.priority
    if task_in.assignee_id:
        task.assignee_id = task_in.assignee_id
    if task_in.description:
        task.description = task_in.description
        
    db.commit()
    db.refresh(task)
    return task

# --- AI ---
@router.post("/ai-generate")
def generate_task_ai(req: AIRequest, current_user: User = Depends(get_current_user)):
    try:
        description = generate_task_metadata(req.title, req.priority, req.context)
        return {"description": description}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))