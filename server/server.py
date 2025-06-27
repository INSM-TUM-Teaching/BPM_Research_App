# Add imported modules
import os
import time
import threading
import pandas as pd
from typing import Optional, List, Dict
from fastapi import FastAPI, HTTPException, UploadFile, File, Form, Body
from fastapi.middleware.cors import CORSMiddleware
from pathlib import Path
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
import shutil

app = FastAPI()

########## API ENDPOINTS - SIMOD CONTROL FLOW ##########

# Variables for top-3 results
top_3_results: Optional[List[Dict]] = None

# API for sending top-3 results
@app.post("/top-3-results")
def receive_top_3_results(data: List[Dict] = Body(...)):
    """Accept the top-3 results and save them in memory."""
    global top_3_results
    top_3_results = data
    return {"message": "Top-3 results received successfully", "count": len(data)}

# # API for retrieving the top-3 results
@app.get("/top-3-results")
def get_top_3_results():
    """Return the top-3 results if available."""
    if top_3_results is None:
        return {"message": "No results have been received yet."}
    return JSONResponse(content={"results": top_3_results})

BASE_BPMN_DIR = "static/best_bpmns"

@app.get("/api/bpmn/{full_path:path}")
def get_bpmn(full_path: str):
    bpmn_path = os.path.join(BASE_BPMN_DIR, full_path)
    if not os.path.isfile(bpmn_path):
        raise HTTPException(status_code=404, detail="BPMN file not found")
    with open(bpmn_path, "r", encoding="utf-8") as f:
        xml = f.read()
    return JSONResponse(content={"bpmn_xml": xml})

# Variables for best model selection
selected_model_path: Optional[Path] = None

class Selection(BaseModel):
    model_path: str

# API for selecting a model
@app.post("/select-model/")
def select_model(selection: Selection):
    global selected_model_path
    selected_model_path = Path(selection.model_path)
    return {"message": "Model selection received", "model_path": str(selected_model_path)}

# API for getting the selected model path
@app.get("/get-selected-model/")
def get_selection():
    if selected_model_path is None:
        return {"message": "No model has been selected yet"}
    return {"selected_model_path": str(selected_model_path)}

# API for best model selection state reset
@app.post("/reset-selected-model/")
def reset_selected_model():
    """Reset the selected model path state."""
    global selected_model_path
    selected_model_path = None
    return {"message": "Selection reset"}

######### API ENDPOINTS - EVENT LOGS ##########
origins = [
    "http://localhost:3000",
    "http://localhost",
    "http://localhost:8000", 
    # Your React development server port, modify as needed
    "http://127.0.0.1:8000",
    "http://127.0.0.1:3000",
    # Add your frontend domain for production deployment
]

app.add_middleware(
    CORSMiddleware,
    # allow_origins=["http://localhost:3000"],  # or ["*"]
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
# CORS settings - very important!
# app.add_middleware(
#     CORSMiddleware,
#     allow_origins=["*"],  # Allow all origins for development
#     allow_credentials=True,
#     allow_methods=["*"],
#     allow_headers=["*"],
# )

# Global variables
SIMOD_CONTINUE_EVENT = threading.Event()
FILTERED_EVENT_LOG_PATH = None
CURRENT_EVENT_LOG_PATH = None
SIMOD_STATUS = "idle"  # idle, running, waiting_for_filter, completed, error

# Define upload directory
UPLOAD_DIR = Path("uploaded_logs")
if not UPLOAD_DIR.exists():
    UPLOAD_DIR.mkdir(parents=True)    

# Simple endpoint for homepage
@app.get("/")
async def root():
    return {"status": "ok", "message": "API is running"}

# Event log upload endpoint
@app.post("/api/eventlog/upload")
async def upload_event_log(file: UploadFile = File(...)):
    """Uploads the event log file and makes it accessible by the API"""
    global CURRENT_EVENT_LOG_PATH
    
    try:
        # Check and create upload directory
        if not UPLOAD_DIR.exists():
            UPLOAD_DIR.mkdir(parents=True)
            
        # Create file path
        file_path = UPLOAD_DIR / file.filename
        
        # Save the file
        with open(file_path, "wb") as f:
            content = await file.read()
            f.write(content)
        
        CURRENT_EVENT_LOG_PATH = str(file_path)
        
        print(f"Event log file uploaded successfully: {file.filename} ({os.path.getsize(file_path)} bytes)")
        
        # Check the content by reading the first few rows
        try:
            df = pd.read_csv(file_path, nrows=5)
            print(f"Event log sample content - first 5 rows, columns: {', '.join(df.columns.tolist())}")
        except Exception as e:
            print(f"Error checking event log content: {str(e)}")
        
        return {
            "status": "success", 
            "message": f"Event log file uploaded successfully: {file.filename}",
            "file_path": CURRENT_EVENT_LOG_PATH
        }
    except Exception as e:
        import traceback
        error_details = traceback.format_exc()
        print(f"Event log upload error: {str(e)}")
        print(error_details)
        raise HTTPException(status_code=500, detail=f"Error occurred while uploading event log: {str(e)}")

# Event log endpoint - with pagination
@app.get("/api/eventlog")
async def get_event_log(limit: int = 100, offset: int = 0):
    """Event log data with pagination"""
    global CURRENT_EVENT_LOG_PATH
    
    try:
        # Event log file check
        if not CURRENT_EVENT_LOG_PATH or not os.path.exists(CURRENT_EVENT_LOG_PATH):
            # Try to find the latest event log file in the folder
            if UPLOAD_DIR.exists():
                log_files = list(UPLOAD_DIR.glob("*.csv"))
                if log_files:
                    CURRENT_EVENT_LOG_PATH = str(max(log_files, key=os.path.getmtime))
                else:
                    raise HTTPException(status_code=404, detail="Event log file not found")
            else:
                raise HTTPException(status_code=404, detail="Event log file not found")
        
        # Read file based on extension
        log_df = None
        if CURRENT_EVENT_LOG_PATH.endswith('.csv'):
            log_df = pd.read_csv(CURRENT_EVENT_LOG_PATH)
        elif CURRENT_EVENT_LOG_PATH.endswith('.csv.gz'):
            log_df = pd.read_csv(CURRENT_EVENT_LOG_PATH, compression='gzip')
        else:
            raise HTTPException(status_code=400, detail="Unsupported file format")
        
        # Total row count
        total_rows = len(log_df)
        
        # Pagination
        paginated_df = log_df.iloc[offset:offset+limit]
        
        # Convert to JSON (convert NaN values to empty string)
        log_data = paginated_df.fillna('').to_dict(orient="records")
        
        return {
            "status": "success",
            "data": log_data,
            "total_rows": total_rows,
            "columns": log_df.columns.tolist(),
            "file_path": CURRENT_EVENT_LOG_PATH
        }
        
    except HTTPException:
        raise
    except Exception as e:
        import traceback
        error_details = traceback.format_exc()
        print(f"Error: {str(e)}")
        print(error_details)
        raise HTTPException(status_code=500, detail=f"Error loading event log data: {str(e)}")

# Endpoint to return all event log data
@app.get("/api/eventlog/full")
async def get_full_event_log():
    """Return all event log data at once"""
    global CURRENT_EVENT_LOG_PATH
    
    try:
        # Event log file check
        if not CURRENT_EVENT_LOG_PATH or not os.path.exists(CURRENT_EVENT_LOG_PATH):
            # Try to find the latest event log file in the folder
            if UPLOAD_DIR.exists():
                log_files = list(UPLOAD_DIR.glob("*.csv"))
                if log_files:
                    CURRENT_EVENT_LOG_PATH = str(max(log_files, key=os.path.getmtime))
                else:
                    raise HTTPException(status_code=404, detail="Event log file not found")
            else:
                raise HTTPException(status_code=404, detail="Event log file not found")
        
        # Read file
        log_df = None
        if CURRENT_EVENT_LOG_PATH.endswith('.csv'):
            log_df = pd.read_csv(CURRENT_EVENT_LOG_PATH)
        elif CURRENT_EVENT_LOG_PATH.endswith('.csv.gz'):
            log_df = pd.read_csv(CURRENT_EVENT_LOG_PATH, compression='gzip')
        else:
            raise HTTPException(status_code=400, detail="Unsupported file format")
        
        # Convert to JSON (convert NaN values to empty string)
        log_data = log_df.fillna('').to_dict(orient="records")
        
        return {
            "status": "success",
            "data": log_data,
            "total_rows": len(log_data),
            "columns": log_df.columns.tolist(),
            "file_path": CURRENT_EVENT_LOG_PATH
        }
        
    except HTTPException:
        raise
    except Exception as e:
        import traceback
        error_details = traceback.format_exc()
        print(f"Error: {str(e)}")
        print(error_details)
        raise HTTPException(status_code=500, detail=f"Error loading event log data: {str(e)}")

# Filtered event log data saving endpoint
@app.post("/api/eventlog/filtered")
async def save_filtered_event_log(data: dict):
    """
    Save filtered event log data as CSV
    """
    global FILTERED_EVENT_LOG_PATH, SIMOD_CONTINUE_EVENT
    
    try:
        # Validate incoming data
        if not data or "data" not in data or not isinstance(data["data"], list):
            raise HTTPException(status_code=400, detail="Invalid data format: 'data' field expected")
            
        if len(data["data"]) == 0:
            raise HTTPException(status_code=400, detail="Empty data list received")
        
        # Convert incoming data to Pandas DataFrame
        import pandas as pd
        df = pd.DataFrame(data["data"])
        
        # Define file name and path
        from datetime import datetime
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        file_name = f"filtered_event_log_{timestamp}.csv"
        
        # Check upload directory
        if not UPLOAD_DIR.exists():
            UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
        
        # Save the file
        file_path = UPLOAD_DIR / file_name
        df.to_csv(file_path, index=False)
        
        # File check
        if not os.path.exists(file_path):
            raise HTTPException(status_code=500, detail="File saved but could not be verified")
            
        # Assign to global variable
        FILTERED_EVENT_LOG_PATH = str(file_path)
        SIMOD_CONTINUE_EVENT.set()  # Set continue signal
        
        print(f"Filtered event log file saved: {file_path} ({len(df)} records)")
        
        return {
            "status": "success", 
            "message": f"Filtered event log file saved successfully",
            "file_path": FILTERED_EVENT_LOG_PATH,
            "row_count": len(df),
            "file_exists": os.path.exists(FILTERED_EVENT_LOG_PATH),
            "file_size_bytes": os.path.getsize(FILTERED_EVENT_LOG_PATH)
        }
    except HTTPException:
        raise
    except Exception as e:
        import traceback
        error_details = traceback.format_exc()
        print(f"Error saving filtered event log: {str(e)}")
        print(error_details)
        raise HTTPException(status_code=500, detail=f"Error occurred while saving filtered event log: {str(e)}")

# Endpoint to send continue signal to Simod
@app.post("/api/simod/continue")
async def continue_simod():
    """Sends continue signal to Simod"""
    global SIMOD_CONTINUE_EVENT, FILTERED_EVENT_LOG_PATH
    
    try:
        if not FILTERED_EVENT_LOG_PATH:
            raise HTTPException(status_code=400, detail="Filtered event log file not found")
        
        # Send continue signal to Simod
        SIMOD_CONTINUE_EVENT.set()
        
        return {
            "status": "success",
            "message": "Continue signal sent to Simod",
            "filtered_event_log": FILTERED_EVENT_LOG_PATH
        }
    except HTTPException:
        raise
    except Exception as e:
        import traceback
        error_details = traceback.format_exc()
        print(f"Simod continue error: {str(e)}")
        print(error_details)
        raise HTTPException(status_code=500, detail=f"Error occurred while sending continue signal to Simod: {str(e)}")

# Endpoint to return filtered event log path
@app.get("/api/eventlog/filtered-path")
async def get_filtered_event_log_path():
    """Returns the path of the filtered event log"""
    global FILTERED_EVENT_LOG_PATH
    
    if FILTERED_EVENT_LOG_PATH and os.path.exists(FILTERED_EVENT_LOG_PATH):
        # File size check
        file_size = os.path.getsize(FILTERED_EVENT_LOG_PATH)
        
        return {
            "path": FILTERED_EVENT_LOG_PATH,
            "exists": True,
            "size_bytes": file_size,
            "size_mb": round(file_size / (1024 * 1024), 2)
        }
    else:
        return {
            "path": FILTERED_EVENT_LOG_PATH,
            "exists": False if FILTERED_EVENT_LOG_PATH else None,
            "message": "Filtered file not found or not yet created"
        }

# Endpoint to return Simod status
@app.get("/api/simod/status")
async def get_simod_status():
    """Returns the status of Simod"""
    global SIMOD_STATUS
    
    return {
        "status": SIMOD_STATUS,
        "timestamp": time.time()
    }

# Endpoint to set Simod status
@app.post("/api/simod/set-status")
async def set_simod_status(data: dict):
    """Updates the status of Simod"""
    global SIMOD_STATUS
    
    try:
        if "status" not in data:
            raise HTTPException(status_code=400, detail="Status value is required")
        
        new_status = data["status"]
        allowed_statuses = ["idle", "running", "waiting_for_filter", "completed_filtering", "completed", "error"]
        
        if new_status not in allowed_statuses:
            raise HTTPException(status_code=400, detail=f"Invalid status. Allowed values: {', '.join(allowed_statuses)}")
        
        SIMOD_STATUS = new_status
        print(f"Simod status updated: {SIMOD_STATUS}")
        
        return {"status": "success", "message": f"Status updated: {SIMOD_STATUS}"}
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error occurred while updating status: {str(e)}")

# Endpoint to clear event logs
@app.post("/api/eventlog/clear")
async def clear_event_logs():
    """Clears uploaded event logs and filtering status"""
    global CURRENT_EVENT_LOG_PATH, FILTERED_EVENT_LOG_PATH, SIMOD_CONTINUE_EVENT
    
    try:
        # Reset global variables
        old_path = CURRENT_EVENT_LOG_PATH
        CURRENT_EVENT_LOG_PATH = None
        FILTERED_EVENT_LOG_PATH = None
        SIMOD_CONTINUE_EVENT.clear()
        
        # Clear files in the folder
        if UPLOAD_DIR.exists():
            import shutil
            try:
                # Clear files in the folder but do not delete the folder
                for file_path in UPLOAD_DIR.glob("*"):
                    if file_path.is_file():
                        file_path.unlink()  # Delete the file
                print(f"All files in the folder have been cleared: {UPLOAD_DIR}")
            except Exception as e:
                print(f"Error deleting files: {str(e)}")
            
        return {
            "status": "success",
            "message": f"Event log data cleared. Folder: {UPLOAD_DIR}, Old file: {old_path}"
        }
    except Exception as e:
        import traceback
        error_details = traceback.format_exc()
        print(f"Event log clearing error: {str(e)}")
        print(error_details)
        raise HTTPException(status_code=500, detail=f"Error occurred while clearing event log: {str(e)}")    


if __name__ == "__main__":
    import uvicorn
    
    print("Starting FastAPI server...")
    uvicorn.run(app, host="0.0.0.0", port=8000, log_level="info")