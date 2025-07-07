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
from fastapi.responses import JSONResponse, FileResponse
from pydantic import BaseModel
import csv
from io import StringIO
from typing import List, Dict, Any
import shutil
import traceback
import zipfile
import tempfile
from datetime import datetime
import glob

# Prosimos CSV hjas multiple sections so parsing to structured JSON object
def parse_prosimos_stats(csv_content: str) -> Dict[str, Any]:
    """
    Parses the multi-section prosimos_stats.csv content into a structured dictionary.
    """
    if not csv_content:
        return {}
    sections = {
        "Resource Utilization": [],
        "Individual Task Statistics": [],
        "Overall Scenario Statistics": []
    }
    metadata = {}
    current_section_name = None
    f = StringIO(csv_content)
    lines = f.readlines()

    for line in lines:
        line = line.strip()
        if not line or line == '""':  # Skip blank lines just ""
            continue
        if line in sections:
            current_section_name = line
            continue

        # Handle the initial metadata lines (e.g., started_at)
        if "," in line and ":" in line and current_section_name is None:
             try:
                key, value = line.split(',', 1)
                metadata[key.strip()] = value.strip()
                continue
             except ValueError:
                pass

        # If we are inside a known section, parse it as a table
        if current_section_name:
            reader = csv.reader([line])
            row = next(reader)
            
            # If the section is empty, this line is the header
            if not sections[current_section_name]:
                 sections[current_section_name].append(row) # Add header
            else:
                header = sections[current_section_name][0]
                row_dict = {header[i]: (row[i] if i < len(row) else None) for i in range(len(header))}
                sections[current_section_name].append(row_dict)

    # Clean up the output: remove the header from the data list and store it separately
    parsed_output = {"metadata": metadata}
    for section_name, content in sections.items():
        if len(content) > 1:
            header = content[0]
            data_rows = content[1:]
            parsed_output[section_name] = {
                "headers": header,
                "rows": data_rows
            }
        else:
            # Section was found but had no data rows
             parsed_output[section_name] = {
                "headers": [],
                "rows": []
            }

    return parsed_output
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
    from pathlib import Path
    from fastapi import Response
    from urllib.parse import quote, unquote
    
    try:
        # Decode URL-encoded path
        decoded_path = unquote(file_path)
        
        # Create the output file path by adding output_ prefix to the filename
        original_path = Path(decoded_path)
        output_filename = f"output_{original_path.name}"
        output_path = original_path.parent / output_filename
        
        if not output_path.exists():
            # If output file doesn't exist, create it using auto layout
            try:
                # Import auto layout function only when needed
                create_layout_bpmn = import_auto_bpmn_layout()
                layout_file = create_layout_bpmn(decoded_path)
                
                # Update output_path to the newly created file
                output_path = Path(layout_file)
                
                if not output_path.exists():
                    raise FileNotFoundError(f"Could not create or find output BPMN file: {output_path}")
                    
            except Exception as auto_error:
                raise FileNotFoundError(f"Output BPMN file not found and auto creation failed: {str(auto_error)}")
        
        # Serve the output file directly
        with open(output_path, 'r', encoding='utf-8') as f:
            content = f.read()
        
        # Check if content contains layout information
        has_layout = 'bpmndi:BPMNDiagram' in content or 'bpmndi:BPMNPlane' in content
        
        # Set response URL to the actual output file path that was served
        output_file_encoded = quote(str(output_path).replace('\\', '/'))
        actual_response_url = f"/api/layout-bpmn/{output_file_encoded}"
        
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
        raise HTTPException(status_code=404, detail=f"Layout BPMN file not found: {str(e)}")
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Failed to read layout BPMN file: {str(e)}")

# New endpoint: Serve BPMN with auto layout
@app.get("/api/bpmn/{file_path:path}")
def serve_bpmn_with_layout(file_path: str):
    from pathlib import Path
    from urllib.parse import unquote
    
    try:
        # Decode URL-encoded path
        decoded_path = unquote(file_path)
        
        if not os.path.exists(decoded_path):
            raise FileNotFoundError(f"Source BPMN file not found: {decoded_path}")
        
        # Create auto layout - this creates output_filename.bpmn in the same directory
        # Import auto layout function only when needed
        create_layout_bpmn = import_auto_bpmn_layout()
        layout_file = create_layout_bpmn(decoded_path)
        
        if not os.path.exists(layout_file):
            raise FileNotFoundError(f"Layout file was not created: {layout_file}")
        
        # Serve the layout file
        with open(layout_file, 'r', encoding='utf-8') as f:
            content = f.read()
        
        return {"bpmn_xml": content}
        
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=f"BPMN file not found: {str(e)}")
    except Exception as e:
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

########## API ENDPOINTS - EXPORTING SIMULATION DATA ##########

#### ENDPOINTS FOR EXPORTING CANONICAL MODEL ####

# In-memory storage for the canonical model JSON
canonical_model_data: Optional[Dict[str, Any]] = None

# POST endpoint to receive and store the canonical model JSON
@app.post("/api/upload-canonical-model/")
def receive_canonical_model(data: Dict[str, Any] = Body(...)):
    global canonical_model_data
    canonical_model_data = data
    return {"message": "Canonical model received successfully"}

# GET endpoint to retrieve the canonical model JSON
@app.get("/api/upload-canonical-model/")
def get_canonical_model():
    if canonical_model_data is None:
        return {"message": "No canonical model has been received yet."}
    return JSONResponse(content=canonical_model_data)

# DELETE endpoint to reset stored canonical model data
@app.delete("/api/upload-canonical-model/")
def reset_canonical_model():
    global canonical_model_data
    canonical_model_data = None
    return {"message": "Canonical model data has been reset."}

##### ENDPOINTS FOR EXPORTING SIMULATION DATA #####

# Simulation parameters memory store
simulation_parameters: Optional[Dict] = None

@app.post("/simulation-parameters/")
def receive_simulation_parameters(data: Dict = Body(...)):
    global simulation_parameters
    simulation_parameters = data
    return {"message": "Simulation parameters received successfully"}

@app.get("/simulation-parameters/")
def get_simulation_parameters():
    if simulation_parameters is None:
        return {"message": "No simulation parameters have been received yet."}
    return JSONResponse(content={"parameters": simulation_parameters})

@app.delete("/simulation-parameters/")
def reset_simulation_parameters():
    global simulation_parameters
    simulation_parameters = None
    return {"message": "Simulation parameters have been reset."}


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
SIMOD_STATUS = "idle"  # idle, running, waiting_for_filter, completed_filtering, completed, error

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
        
        # Store and return the ABSOLUTE path for robustness
        CURRENT_EVENT_LOG_PATH = str(file_path.resolve())
        
        print(f"Event log dosyası başarıyla yüklendi: {file.filename} ({os.path.getsize(file_path)} bytes)")
        print(f"Absolute path set to: {CURRENT_EVENT_LOG_PATH}")
        
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
# @app.post("/api/event-log/upload")
# async def upload_event_log(file: UploadFile = File(...)):
#     """Upload event log file safely and make it accessible via API"""
#     global CURRENT_EVENT_LOG_PATH
    
#     try:
#         # Sanitize the filename to prevent directory traversal issues
#         safe_filename = os.path.basename(file.filename)
#         if not safe_filename:
#             raise HTTPException(status_code=400, detail="Invalid or empty filename provided.")

#         file_path = UPLOAD_DIR / safe_filename
        
#         # Save the file in chunks to avoid high memory usage
#         with open(file_path, "wb") as buffer:
#             shutil.copyfileobj(file.file, buffer)
        
#         # Store the absolute path for robustness
#         CURRENT_EVENT_LOG_PATH = str(file_path.resolve())
        
#         print(f"Event log file successfully uploaded: {safe_filename} ({os.path.getsize(file_path)} bytes)")
#         print(f"Absolute path set to: {CURRENT_EVENT_LOG_PATH}")
        
#         # --- START OF FIX ---
#         # Verify content by reading the first few rows, handling compression
#         print("Verifying uploaded file content...")
#         try:
#             # Check the file extension to decide how to read it
#             if CURRENT_EVENT_LOG_PATH.endswith('.gz'):
#                 # Tell pandas to decompress the gzipped file
#                 df = pd.read_csv(CURRENT_EVENT_LOG_PATH, nrows=5, compression='gzip')
#             else:
#                 # Read as a normal CSV
#                 df = pd.read_csv(CURRENT_EVENT_LOG_PATH, nrows=5)
                
#             print(f"Verification successful. Columns found: {', '.join(df.columns.tolist())}")
#         except Exception as e:
#             # This is now a non-critical warning, as the file is already saved.
#             print(f"Warning: Could not read sample from uploaded event log: {str(e)}")
#         # --- END OF FIX ---
        
#         return {
#             "status": "success", 
#             "message": f"Event log file successfully uploaded: {safe_filename}",
#             "file_path": CURRENT_EVENT_LOG_PATH
#         }
#     except Exception as e:
#         # Log the full error traceback for easier debugging
#         error_details = traceback.format_exc()
#         print(f"Event log upload error: {str(e)}")
#         print(error_details)
#         raise HTTPException(status_code=500, detail=f"Error uploading event log: {str(e)}")

# Add the missing endpoint for the wrapper to poll for UI uploads
@app.get("/api/event-log/uploaded-path")
async def get_uploaded_log_path():
    """
    Returns the path of the originally uploaded event log.
    """
    global CURRENT_EVENT_LOG_PATH
    print(f"[SERVER-POLL] Checking for uploaded path. Current value: '{CURRENT_EVENT_LOG_PATH}'")
    if CURRENT_EVENT_LOG_PATH and os.path.exists(CURRENT_EVENT_LOG_PATH):
        return {"path": CURRENT_EVENT_LOG_PATH}
    else:
        return {"path": None}

# Event log endpoint'i - sayfalama ile
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
                    CURRENT_EVENT_LOG_PATH = str(max(log_files, key=os.path.getmtime).resolve())
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
                    CURRENT_EVENT_LOG_PATH = str(max(log_files, key=os.path.getmtime).resolve())
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
    Filtrelenmiş event log verilerini CSV olarak kaydeder
    """
    global FILTERED_EVENT_LOG_PATH, SIMOD_CONTINUE_EVENT, SIMOD_STATUS
    
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
            
        # Store absolute path and update Simod status
        FILTERED_EVENT_LOG_PATH = str(file_path.resolve())
        SIMOD_STATUS = "completed_filtering"
        SIMOD_CONTINUE_EVENT.set()
        
        print(f"Filtrelenmiş event log dosyası kaydedildi: {FILTERED_EVENT_LOG_PATH} ({len(df)} kayıt)")
        print(f"Simod durumu güncellendi: {SIMOD_STATUS}")
        
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
    """Yüklü event log'ları ve filtreleme durumunu temizler"""
    global CURRENT_EVENT_LOG_PATH, FILTERED_EVENT_LOG_PATH, SIMOD_CONTINUE_EVENT, SIMOD_STATUS
    print("[SERVER-CLEAR] Received request to clear state.")
    try:
        # Reset global variables
        old_path = CURRENT_EVENT_LOG_PATH
        CURRENT_EVENT_LOG_PATH = None
        FILTERED_EVENT_LOG_PATH = None
        SIMOD_STATUS = "idle"
        SIMOD_CONTINUE_EVENT.clear()
        print(f"[SERVER-CLEAR] Globals reset. CURRENT_EVENT_LOG_PATH is now: '{CURRENT_EVENT_LOG_PATH}'")
        # Klasördeki dosyaları temizle
        if UPLOAD_DIR.exists():
            import shutil
            try:
                # Clean files in the folder but don't delete the folder
                for file_path in UPLOAD_DIR.glob("*"):
                    if file_path.is_file():
                        file_path.unlink()  # Dosyayı sil
                print(f"Klasördeki tüm dosyalar temizlendi: {UPLOAD_DIR}")
            except Exception as e:
                print(f"[SERVER-CLEAR] Error while deleting files: {str(e)}")
            
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


class ProsimosStats(BaseModel):
    stats_path: str
    log_path: str
    stats_content: str
# Global variable to store the final stats
final_prosimos_stats: Optional[Dict] = None
@app.post("/final-prosimos-stats/")
def receive_final_stats(data: ProsimosStats):
    """Accept and store the final Prosimos simulation statistics."""
    print("\nINCOMING PROSIMOS STATS")
    print(f"Received stats file path: {data.stats_path}")
    print(f"First 25 chars of content: {data.stats_content[:25]}...")
    print("---------------------------------\n")
    global final_prosimos_stats
    # Parse the raw CSV content into a structured dictionary
    parsed_stats = parse_prosimos_stats(data.stats_content)
    # Store the complete, clean object
    final_prosimos_stats = {
        "stats_path": data.stats_path,
        "log_path": data.log_path,
        "parsed_stats": parsed_stats # Store the newly parsed object
    }
    return {"message": "Final Prosimos stats received successfully", "log_file": data.log_path}
  
 # API for retrieving the final stats

@app.get("/final-prosimos-stats/")
def get_final_stats():
    """Return the final Prosimos simulation statistics if available."""
    if final_prosimos_stats is None:
        raise HTTPException(status_code=404, detail="Final Prosimos stats not available yet.")
    return JSONResponse(content=final_prosimos_stats)

 # API for resetting the final stats

@app.delete("/final-prosimos-stats/")
def reset_final_stats():
    """Reset the final Prosimos stats to None."""
    global final_prosimos_stats
    final_prosimos_stats = None
    return {"message": "Final Prosimos stats have been reset."}
  
class BpmnPath(BaseModel):
    path: str
final_bpmn_model_path: Optional[str] = None
@app.post("/final-bpmn-path/")
def receive_final_bpmn_path(data: BpmnPath):
    """Accept and store the path of the final BPMN model."""
    global final_bpmn_model_path
    print(f"\nReceived final BPMN model path: {data.path}\n")
    final_bpmn_model_path = data.path
    return {"message": "Final BPMN path received successfully", "path": data.path}

@app.get("/final-bpmn-path/")
def get_final_bpmn_path():
    """Return the path of the final BPMN model if available."""
    if final_bpmn_model_path is None:
        raise HTTPException(status_code=404, detail="Final BPMN model path not available yet.")
    return JSONResponse(content={"path": final_bpmn_model_path})

@app.delete("/final-bpmn-path/")
def reset_final_bpmn_path():
    """Reset the final BPMN model path to None."""
    global final_bpmn_model_path
    final_bpmn_model_path = None
    return {"message": "Final BPMN model path has been reset."}

# --- pipeline state ---
pipeline_state = {"completed": False}

# --- reset pipeline state ---
@app.post("/pipeline/reset")
def reset_pipeline_state():
    global pipeline_state
    pipeline_state["completed"] = False
    print("🔁 Pipeline state reset to NOT completed.")
    return {"status": "reset", "completed": False}

# --- mark pipeline as completed ---
@app.post("/pipeline/complete")
def mark_pipeline_completed():
    global pipeline_state
    pipeline_state["completed"] = True
    print("✅ Pipeline marked as completed.")
    return {"status": "completed", "completed": True}

# --- inquiry pipeline status ---
@app.get("/pipeline/status")
def get_pipeline_status():
    return {"completed": pipeline_state["completed"]}

# --- download simulation results ---
@app.get("/download-results/")
def download_simulation_results():
    """
    Download the simulation results files from the current iteration's best_result folder.
    Creates a ZIP file containing prosimos_stats.csv, prosimos_log.csv, and any filtered event log JSON files.
    """
    global final_bpmn_model_path
    
    if final_bpmn_model_path is None:
        raise HTTPException(status_code=404, detail="No simulation results available for download.")
    
    try:
        # Extract the best_result directory from the BPMN path
        bpmn_path = Path(final_bpmn_model_path)
        best_result_dir = bpmn_path.parent
        
        # Verify this is a best_result directory
        if best_result_dir.name != "best_result":
            raise HTTPException(status_code=500, detail="Invalid best_result directory structure.")
        
        # Define the files we want to include
        files_to_download = []
        
        # 1. prosimos_stats.csv (renamed from prosimos_stat)
        prosimos_stats_file = best_result_dir / "prosimos_stats.csv"
        if prosimos_stats_file.exists():
            files_to_download.append(("prosimos_stat", prosimos_stats_file))
        
        # 2. prosimos_log.csv (this should be the filtered event log CSV)
        prosimos_log_file = best_result_dir / "prosimos_log.csv"
        if prosimos_log_file.exists():
            # Generate timestamp-based filename similar to the format requested
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            csv_name = f"output_filtered_event_log_{timestamp}.csv"
            files_to_download.append((csv_name, prosimos_log_file))
        
        # 3. Look for JSON log files or simulation parameters
        simulation_json_file = best_result_dir / f"{bpmn_path.stem}.json"
        if simulation_json_file.exists():
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            json_name = f"filtered_event_log_{timestamp}.json"
            files_to_download.append((json_name, simulation_json_file))
        
        # If no files found, return error
        if not files_to_download:
            raise HTTPException(status_code=404, detail="No simulation result files found in best_result directory.")
        
        # Create a temporary ZIP file
        temp_dir = tempfile.mkdtemp()
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        zip_filename = f"simulation_results_{timestamp}.zip"
        zip_path = Path(temp_dir) / zip_filename
        
        with zipfile.ZipFile(zip_path, 'w', zipfile.ZIP_DEFLATED) as zipf:
            for archive_name, file_path in files_to_download:
                zipf.write(file_path, archive_name)
        
        # Return the ZIP file
        return FileResponse(
            path=str(zip_path),
            filename=zip_filename,
            media_type='application/zip',
            headers={"Content-Disposition": f"attachment; filename={zip_filename}"}
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error creating download package: {str(e)}")

if __name__ == "__main__":
    import uvicorn
    
    print("Starting FastAPI server...")
    uvicorn.run(app, host="0.0.0.0", port=8000, log_level="info")