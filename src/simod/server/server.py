# Import required modules
import os
import sys
import time
import threading
import pandas as pd
from typing import Optional, List, Dict
from fastapi import FastAPI, HTTPException, UploadFile, File, Form, Body, Response
from fastapi.middleware.cors import CORSMiddleware
from pathlib import Path
from fastapi.responses import JSONResponse
from pydantic import BaseModel

# Import auto_bpmn_layout only when needed
def import_auto_bpmn_layout():
    """Import auto_bpmn_layout module dynamically"""
    current_dir = os.path.dirname(os.path.abspath(__file__))
    bpmn_dir = os.path.join(current_dir, '..', 'bpmn')
    auto_layout_file = os.path.join(bpmn_dir, 'auto_bpmn_layout.py')
    
    if os.path.exists(auto_layout_file):
        import importlib.util
        spec = importlib.util.spec_from_file_location("auto_bpmn_layout", auto_layout_file)
        auto_bpmn_layout = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(auto_bpmn_layout)
        return auto_bpmn_layout.create_layout_bpmn
    else:
        def create_layout_bpmn(file_path):
            raise HTTPException(status_code=500, detail="Auto layout functionality not available")
        return create_layout_bpmn

app = FastAPI()

########## API ENDPOINTS - SIMOD CONTROL FLOW ##########

# Variables for top-3 results
top_3_results: Optional[List[Dict]] = None

# API for sending top-3 results
@app.post("/top-3-results/")
def receive_top_3_results(data: List[Dict] = Body(...)):
    """Accept the top-3 results and save them in memory."""
    global top_3_results
    top_3_results = data
    return {"message": "Top-3 results received successfully", "count": len(data)}

# API for retrieving the top-3 results
@app.get("/top-3-results/")
def get_top_3_results():
    """Return the top-3 results if available."""
    if top_3_results is None:
        return {"message": "No results have been received yet."}
    return JSONResponse(content={"results": top_3_results})

# API for resetting the top-3 results
@app.delete("/top-3-results/")
def reset_top_3_results():
    """Reset the top-3 results to None."""
    global top_3_results
    top_3_results = None
    return  {"message": "Top-3 results have been reset."}

# API for getting static BPMN files
# This endpoint serves BPMN files from a static directory

# New endpoint: Serve existing output_ prefixed BPMN file directly
@app.get("/api/layout-bpmn/{file_path:path}")
def serve_layout_bpmn(file_path: str, response: Response):
    import datetime
    from pathlib import Path
    from fastapi import Response
    from urllib.parse import quote
    
    print(f"[DEBUG] /api/layout-bpmn/ endpoint called with: {file_path}")
    
    try:
        # Decode URL-encoded path
        from urllib.parse import unquote
        decoded_path = unquote(file_path)
        
        # Create log file in the same directory as the input file
        input_path = Path(decoded_path)
        log_file = input_path.parent / "server_layout_bpmn.log"
        
        def log_message(message):
            timestamp = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            with open(log_file, 'a', encoding='utf-8') as f:
                f.write(f"[{timestamp}] {message}\n")
            print(message)  # Keep print as well
        
        log_message(f"=== LAYOUT BPMN REQUEST ===")
        log_message(f"Original file_path: {file_path}")
        log_message(f"Decoded path: {decoded_path}")
        
        # Create the output file path by adding output_ prefix to the filename
        original_path = Path(decoded_path)
        output_filename = f"output_{original_path.name}"
        output_path = original_path.parent / output_filename
        
        log_message(f"Looking for output file: {output_path}")
        log_message(f"Output file exists: {output_path.exists()}")
        
        if not output_path.exists():
            log_message(f"Output file not found: {output_path}")
            log_message("Attempting to create auto layout from original file...")
            
            # If output file doesn't exist, create it using auto layout
            try:
                # Import auto layout function only when needed
                create_layout_bpmn = import_auto_bpmn_layout()
                layout_file = create_layout_bpmn(decoded_path)
                log_message(f"Auto layout created: {layout_file}")
                
                # Update output_path to the newly created file
                output_path = Path(layout_file)
                
                if not output_path.exists():
                    log_message(f"ERROR: Auto layout failed to create file: {layout_file}")
                    raise FileNotFoundError(f"Could not create or find output BPMN file: {output_path}")
                    
            except Exception as auto_error:
                log_message(f"ERROR: Auto layout creation failed: {str(auto_error)}")
                raise FileNotFoundError(f"Output BPMN file not found and auto creation failed: {str(auto_error)}")
        
        log_message(f"Output file size: {output_path.stat().st_size} bytes")
        
        # Serve the output file directly
        log_message(f"Reading output file from: {output_path}")
        with open(output_path, 'r', encoding='utf-8') as f:
            content = f.read()
            
        log_message(f"Successfully read output file: {len(content)} characters")
        
        # Debug: Check if content contains layout information
        has_layout = 'bpmndi:BPMNDiagram' in content or 'bpmndi:BPMNPlane' in content
        log_message(f"Content has layout information: {has_layout}")
        log_message(f"Content preview (first 300 chars): {content[:300]}")
        
        log_message("=== LAYOUT BPMN SUCCESS ===")
        
        # Set response URL to the actual output file path that was served
        output_file_encoded = quote(str(output_path).replace('\\', '/'))
        actual_response_url = f"/api/layout-bpmn/{output_file_encoded}"
        log_message(f"Setting response URL to output file: {actual_response_url}")
        
        # Update the response headers to show the correct file being served
        response.headers["X-Served-File"] = str(output_path)
        response.headers["X-Original-Request"] = decoded_path
        
        return {
            "bpmn_xml": content,
            "source_file": str(output_path),
            "is_auto_layout": True,
            "has_layout_info": has_layout,
            "actual_file_served": str(output_path),
            "response_url": actual_response_url
        }
        
    except FileNotFoundError as e:
        if 'log_message' in locals():
            log_message(f"File not found error: {str(e)}")
        print(f"File not found error: {str(e)}")
        raise HTTPException(status_code=404, detail=f"Layout BPMN file not found: {str(e)}")
    except Exception as e:
        if 'log_message' in locals():
            log_message(f"Error serving layout BPMN: {str(e)}")
        print(f"Error serving layout BPMN: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Failed to read layout BPMN file: {str(e)}")

# New endpoint: Serve BPMN with auto layout
@app.get("/api/bpmn/{file_path:path}")
def serve_bpmn_with_layout(file_path: str):
    import datetime
    from pathlib import Path
    
    try:
        # Decode URL-encoded path
        from urllib.parse import unquote
        decoded_path = unquote(file_path)
        
        # Create log file in the same directory as the input file
        input_path = Path(decoded_path)
        log_file = input_path.parent / "server_bpmn.log"
        
        def log_message(message):
            timestamp = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            with open(log_file, 'a', encoding='utf-8') as f:
                f.write(f"[{timestamp}] {message}\n")
            print(message)  # Keep print as well
        
        log_message(f"=== BPMN AUTO LAYOUT REQUEST ===")
        log_message(f"Original file_path: {file_path}")
        log_message(f"Decoded path: {decoded_path}")
        log_message(f"File exists: {os.path.exists(decoded_path)}")
        
        if not os.path.exists(decoded_path):
            log_message(f"ERROR: Source file not found: {decoded_path}")
            raise FileNotFoundError(f"Source BPMN file not found: {decoded_path}")
        
        log_message(f"Source file size: {os.path.getsize(decoded_path)} bytes")
        
        # Create auto layout - this creates output_filename.bpmn in the same directory
        log_message("Calling create_layout_bpmn...")
        # Import auto layout function only when needed
        create_layout_bpmn = import_auto_bpmn_layout()
        layout_file = create_layout_bpmn(decoded_path)
        
        log_message(f"Layout function returned: {layout_file}")
        log_message(f"Layout file exists: {os.path.exists(layout_file)}")
        
        if not os.path.exists(layout_file):
            log_message(f"ERROR: Layout file was not created: {layout_file}")
            raise FileNotFoundError(f"Layout file was not created: {layout_file}")
        
        log_message(f"Layout file size: {os.path.getsize(layout_file)} bytes")
        
        # Serve the layout file
        log_message(f"Reading layout file from: {layout_file}")
        with open(layout_file, 'r', encoding='utf-8') as f:
            content = f.read()
            
        log_message(f"Successfully read layout file: {len(content)} characters")
        
        # Debug: Check if content contains layout information
        has_layout = 'bpmndi:BPMNDiagram' in content or 'bpmndi:BPMNPlane' in content
        log_message(f"Content has layout information: {has_layout}")
        log_message(f"Content preview (first 300 chars): {content[:300]}")
        
        log_message("=== BPMN AUTO LAYOUT SUCCESS ===")
        return {"bpmn_xml": content}
        
    except FileNotFoundError as e:
        if 'log_message' in locals():
            log_message(f"File not found error: {str(e)}")
        print(f"File not found error: {str(e)}")
        raise HTTPException(status_code=404, detail=f"BPMN file not found: {str(e)}")
    except Exception as e:
        if 'log_message' in locals():
            log_message(f"Error serving BPMN with layout: {str(e)}")
        print(f"Error serving BPMN with layout: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Failed to process BPMN file: {str(e)}")

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

########## API ENDPOINTS - EVENT LOGS ##########

# Add CORS settings - very important!
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allow all origins for development
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global variables
SIMOD_CONTINUE_EVENT = threading.Event()
FILTERED_EVENT_LOG_PATH = None
CURRENT_EVENT_LOG_PATH = None
SIMOD_STATUS = "idle"  # idle, running, waiting_for_filter, completed, error

# Define upload directory
UPLOAD_DIR = Path("uploaded_logs")
if not UPLOAD_DIR.exists():
    UPLOAD_DIR.mkdir(parents=True)    

# Simple endpoint for main page
@app.get("/")
async def root():
    return {"status": "ok", "message": "API is running"}

# Event log upload endpoint
@app.post("/api/event-log/upload")
async def upload_event_log(file: UploadFile = File(...)):
    """Upload event log file and make it accessible via API"""
    global CURRENT_EVENT_LOG_PATH
    
    try:
        # Check and create upload folder
        if not UPLOAD_DIR.exists():
            UPLOAD_DIR.mkdir(parents=True)
            
        # Create file path
        file_path = UPLOAD_DIR / file.filename
        
        # Save file
        with open(file_path, "wb") as f:
            content = await file.read()
            f.write(content)
        
        CURRENT_EVENT_LOG_PATH = str(file_path)
        
        print(f"Event log file successfully uploaded: {file.filename} ({os.path.getsize(file_path)} bytes)")
        
        # Read first few rows to check content
        try:
            df = pd.read_csv(file_path, nrows=5)
            print(f"Event log sample content - first 5 rows, columns: {', '.join(df.columns.tolist())}")
        except Exception as e:
            print(f"Error checking event log content: {str(e)}")
        
        return {
            "status": "success", 
            "message": f"Event log file successfully uploaded: {file.filename}",
            "file_path": CURRENT_EVENT_LOG_PATH
        }
    except Exception as e:
        import traceback
        error_details = traceback.format_exc()
        print(f"Event log upload error: {str(e)}")
        print(error_details)
        raise HTTPException(status_code=500, detail=f"Error uploading event log: {str(e)}")

# Event log endpoint - with pagination
@app.get("/api/event-log")
async def get_event_log(limit: int = 100, offset: int = 0):
    """Return event log data with pagination"""
    global CURRENT_EVENT_LOG_PATH
    
    try:
        # Check event log file
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
        
        # Convert to JSON (replace NaN values with empty strings)
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
@app.get("/api/event-log/full")
async def get_full_event_log():
    """Return all event log data at once"""
    global CURRENT_EVENT_LOG_PATH
    
    try:
        # Check event log file
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
        
        # Convert to JSON (replace NaN values with empty strings)
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

# Endpoint to save filtered event log data
@app.post("/api/event-log/filtered")
async def save_filtered_event_log(data: dict):
    """
    Save filtered event log data as CSV
    """
    global FILTERED_EVENT_LOG_PATH, SIMOD_CONTINUE_EVENT
    
    try:
        # Check incoming data
        if not data or "data" not in data or not isinstance(data["data"], list):
            raise HTTPException(status_code=400, detail="Invalid data format: 'data' field expected")
            
        if len(data["data"]) == 0:
            raise HTTPException(status_code=400, detail="Empty data list sent")
        
        # Convert incoming data to Pandas DataFrame
        import pandas as pd
        df = pd.DataFrame(data["data"])
        
        # Determine file name and path
        from datetime import datetime
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        file_name = f"filtered_event_log_{timestamp}.csv"
        
        # Check upload directory
        if not UPLOAD_DIR.exists():
            UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
        
        # Save file
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
            "message": f"Filtered event log file successfully saved",
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
        print(f"Filtered event log save error: {str(e)}")
        print(error_details)
        raise HTTPException(status_code=500, detail=f"Error saving filtered event log: {str(e)}")

# Endpoint to send continue signal to Simod
@app.post("/api/simod/continue")
async def continue_simod():
    """Send continue signal to Simod"""
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
        raise HTTPException(status_code=500, detail=f"Error sending continue signal to Simod: {str(e)}")

# Endpoint to return filtered event log path
@app.get("/api/event-log/filtered-path")
async def get_filtered_event_log_path():
    """Return filtered event log path"""
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
    """Return Simod status"""
    global SIMOD_STATUS
    
    return {
        "status": SIMOD_STATUS,
        "timestamp": time.time()
    }

# Endpoint to update Simod status
@app.post("/api/simod/set-status")
async def set_simod_status(data: dict):
    """Update Simod status"""
    global SIMOD_STATUS
    
    try:
        if "status" not in data:
            raise HTTPException(status_code=400, detail="Status value required")
        
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
        raise HTTPException(status_code=500, detail=f"Error updating status: {str(e)}")

# Cleanup endpoint
@app.post("/api/event-log/clear")
async def clear_event_logs():
    """Clear uploaded event logs and filtering state"""
    global CURRENT_EVENT_LOG_PATH, FILTERED_EVENT_LOG_PATH, SIMOD_CONTINUE_EVENT
    
    try:
        # Reset global variables
        old_path = CURRENT_EVENT_LOG_PATH
        CURRENT_EVENT_LOG_PATH = None
        FILTERED_EVENT_LOG_PATH = None
        SIMOD_CONTINUE_EVENT.clear()
        
        # Clean files in the folder
        if UPLOAD_DIR.exists():
            import shutil
            try:
                # Clean files in the folder but don't delete the folder
                for file_path in UPLOAD_DIR.glob("*"):
                    if file_path.is_file():
                        file_path.unlink()  # Delete file
                print(f"All files in folder cleaned: {UPLOAD_DIR}")
            except Exception as e:
                print(f"Error deleting files: {str(e)}")
            
        return {
            "status": "success",
            "message": f"Event log data cleared. Folder: {UPLOAD_DIR}, Old file: {old_path}"
        }
    except Exception as e:
        import traceback
        error_details = traceback.format_exc()
        print(f"Event log cleanup error: {str(e)}")
        print(error_details)
        raise HTTPException(status_code=500, detail=f"Error clearing event log: {str(e)}")    

if __name__ == "__main__":
    import uvicorn
    
    print("Starting FastAPI server...")
    uvicorn.run(app, host="0.0.0.0", port=8000, log_level="info")