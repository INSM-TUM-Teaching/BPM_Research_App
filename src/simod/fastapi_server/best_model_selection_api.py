from fastapi import FastAPI, APIRouter
from pydantic import BaseModel
from pathlib import Path
from typing import Optional

router = APIRouter()

# In-memory store for selected model path
selected_model_path: Optional[Path] = None

class Selection(BaseModel):
    model_path: str

@router.post("/select-model/")
def select_model(selection: Selection):
    global selected_model_path
    selected_model_path = Path(selection.model_path)
    return {"message": "Model selection received", "model_path": str(selected_model_path)}

@router.get("/get-selected-model/")
def get_selection():
    if selected_model_path is None:
        return {"message": "No model has been selected yet"}
    return {"selected_model_path": str(selected_model_path)}
