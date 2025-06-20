from typing import List, Dict, Optional
from fastapi import FastAPI, APIRouter, Body
from fastapi.responses import JSONResponse
from pydantic import BaseModel

router = APIRouter()

# Will hold the received top-3 results
top_3_results: Optional[List[Dict]] = None

@router.post("/top-3-results/")
def receive_top_3_results(data: List[Dict] = Body(...)):
    """Accept the top-3 results and save them in memory."""
    global top_3_results
    top_3_results = data
    return {"message": "Top-3 results received successfully", "count": len(data)}

@router.get("/top-3-results/")
def get_top_3_results():
    """Return the top-3 results if available."""
    if top_3_results is None:
        return {"message": "No results have been received yet."}
    return JSONResponse(content={"results": top_3_results})
