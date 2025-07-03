import os
import sys
import time
import argparse
import random
import subprocess
from pathlib import Path
import requests
import webbrowser
import yaml

# Filter the event log before running Simod
def main():
    parser = argparse.ArgumentParser(description="Simod wrapper - with event log filtering")
    parser.add_argument("--configuration", type=str, required=True, help="Simod configuration file")
    parser.add_argument("--event-log", type=str, help="Event log file (overrides the value in configuration). If not provided, the user will be prompted to upload via the web UI.")
    args, unknown = parser.parse_known_args()
    
    # Fix configuration file path
    config_path = args.configuration
    
    # Check if configuration file exists
    if not os.path.isabs(config_path):
        # Possible configuration file locations
        script_dir = os.path.dirname(os.path.abspath(__file__))
        print (f"Script directory: {script_dir}")
        
        # 1. Specified relative path
        path_1 = os.path.abspath(os.path.join(script_dir, config_path))
        print(f"Absolute path from script directory: {path_1}")
        
        # 2. Relative path according to BPM_Research_App
        parent_dir = os.path.dirname(script_dir)  # BPM_Research_App directory
        path_2 = os.path.join(parent_dir, "resources", "config", os.path.basename(config_path))
        print(f"Absolute path from parent directory: {path_2}")
        
        # 3. Relative path according to Simod Project
        grand_parent_dir = os.path.dirname(parent_dir)  # Simod Project directory
        path_3 = os.path.join(grand_parent_dir, "resources", "config", os.path.basename(config_path))
        print(f"Absolute path from grandparent directory: {path_3}")
        
        great_grand_parent_dir = os.path.dirname(grand_parent_dir)  # BPM_Research_App/
        path_4 = os.path.join(great_grand_parent_dir, "resources", "config", os.path.basename(config_path))
        print(f"Absolute path from great grandparent directory: {path_4}")

        # Check if these paths exist
        for path in [path_1, path_2, path_3, path_4]:
            if os.path.exists(path):
                config_path = path
                print(f"Using configuration file: {config_path}")
                break
        else:
            print("Checked paths:")
            for path in [path_1, path_2, path_3, path_4]:
                print(f" - {path}: {'FOUND' if os.path.exists(path) else 'NOT FOUND'}")
    
    # Configuration file existence
    if not os.path.exists(config_path):
        print(f"ERROR: Configuration file not found: {config_path}")
        sys.exit(1)
    
    print(f"Configuration file: {config_path}")
    
    # Start the FastAPI server
    if not check_server_running():
        print("FastAPI server is not running. Starting the server...")
        start_server()
        time.sleep(5) # Give server time to start
    
    # Clear previous event logs and filtering status
    print("Clearing previous run state...")
    try:
        requests.post("http://localhost:8000/api/event-log/clear")
    except Exception as e:
        print(f"API access error during clear: {str(e)}")

    # Determine the initial event log path from CLI or config file
    event_log_path = args.event_log or extract_event_log_path(config_path)

    page_to_open = "" 
    if event_log_path:
        # Event Log was provided. Upload it and go to the filtering page.
        if not os.path.exists(event_log_path):
            print(f"ERROR: Event log file specified does not exist: {event_log_path}")
            sys.exit(1)
        
        print(f"Event log file provided: {event_log_path}. Uploading to server...")
        uploaded_path = send_event_log_to_api(event_log_path)
        if not uploaded_path:
            print("ERROR: Event log file could not be uploaded to the API.")
            sys.exit(1)
        
        event_log_path = uploaded_path # Use the path on the server

        print("\n" + "="*50)
        print("Event log successfully uploaded.")
        print("="*50)
        page_to_open = "/eventlog"

    else:
        # No event log provided. Prompt user to upload via the web UI.
        print("\n" + "="*50)
        print("No event log file was specified.")
        print("Please upload an event log from the web interface.")
        print("="*50)
        page_to_open = "/"
    
    open_gui(page=page_to_open)
    if not event_log_path:
        # Wait for the user to complete the upload from the UI
        uploaded_path = wait_for_upload()
        if not uploaded_path:
            print("Upload was cancelled or timed out. Exiting.")
            sys.exit(1)
        
        event_log_path = uploaded_path # The script now knows the path of the uploaded log

    # Both scenarios converge here
    print(f"\nSuccessfully continuing with event log: {event_log_path}")
    print("\n" + "="*50)
    print("Event log filtering phase")
    print("Please filter data from the web interface.")
    print("Click 'Continue with Filtered Data' button when you complete filtering.")
    print("="*50)
    
    # Wait for filtering
    filtered_path = wait_for_filtering()
    
    # If filtering was done, run with filtered log
    # Otherwise, run with original log
    if filtered_path:
        print(f"Using filtered event log: {filtered_path}")
        # Run Simod with changed configuration
        run_simod_with_filtered_log(config_path, filtered_path, unknown)
    else:
        print("Filtering was skipped or cancelled. Using original uploaded event log.")
        # Run with original configuration
        run_simod_with_original_config(config_path, event_log_path, unknown)

def extract_event_log_path(config_path):
    """
    Extracts and resolves the event log path from the YAML configuration file.
    """
    try:
        print(f"Attempting to read event log path from: {config_path}")
        with open(config_path, 'r', encoding='utf-8') as f:
            config = yaml.safe_load(f)
            
        event_log_path_str = config.get('common', {}).get('train_log_path')
        if not event_log_path_str:
            print("INFO: 'train_log_path' not found in the YML configuration.")
            return None
        
        print(f"Found 'train_log_path' in YML: '{event_log_path_str}'")
        
        config_dir = Path(config_path).parent
    
        # This correctly joins the config file's folder with the (potentially relative) path from the YML.
        resolved_path = config_dir.joinpath(event_log_path_str).resolve()
        
        print(f"Attempting to resolve to absolute path: {resolved_path}")

        if resolved_path.exists():
            print(f"SUCCESS: Event log file found at resolved path: {resolved_path}")
            return str(resolved_path)
        else:
            print(f"WARNING: Resolved path does not exist. Trying alternative common locations...")
            alt_path = Path.cwd() / event_log_path_str
            if alt_path.exists():
                print(f"SUCCESS: Event log found relative to current directory: {alt_path}")
                return str(alt_path.resolve())

            print(f"ERROR: Could not find the event log file at '{resolved_path}' or any alternative location.")
            return None
            
    except Exception as e:
        print(f"ERROR: An exception occurred while reading event log path from config: {e}")
        return None

def check_server_running():
    """Checks if the FastAPI server is running."""
    try:
        requests.get("http://localhost:8000/", timeout=2)
        return True
    except requests.exceptions.RequestException:
        return False

def start_server():
    """Starts the FastAPI server in a background process."""
    server_dir = Path(__file__).parent.parent.parent / "server"
    if not server_dir.exists(): 
        server_dir = Path(__file__).parent
        
    cmd = [sys.executable, "-m", "uvicorn", "server:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "1"]
    # Start the server in the background
    subprocess.Popen(cmd, cwd=str(server_dir), stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    print(f"Starting FastAPI server from: {server_dir}...")

def open_gui(page="/"):
    """Opens the React GUI in the default browser to a specific page."""
    try:
        path = page if page.startswith('/') else '/' + page
        url = f"http://localhost:3000{path}"
        
        print(f"Opening browser to: {url}")
        webbrowser.open(url)
            
    except Exception as e:
        print(f"Error opening GUI: {e}")
        print(f"Please manually open this address in your browser: {url}")

def send_event_log_to_api(log_path):
    """Sends the specified event log file to the API."""
    try:
        with open(log_path, 'rb') as f:
            files = {'file': (os.path.basename(log_path), f)}
            response = requests.post("http://localhost:8000/api/event-log/upload", files=files)
        
        if response.ok:
            return response.json().get('file_path')
        else:
            print(f"API upload error: {response.status_code} - {response.text}")
            return None
    except Exception as e:
        print(f"Error sending event log to API: {e}")
        return None

def wait_for_upload():
    """Waits for the user to upload a file via the web interface."""
    max_wait_minutes = 30
    start_time = time.time()
    
    print(f"Waiting for user to upload an event log (maximum {max_wait_minutes} minutes)...")
    print("Press CTRL+C to cancel.")
    
    try:
        while True:
            try:
                response = requests.get("http://localhost:8000/api/event-log/uploaded-path")
                if response.ok:
                    data = response.json()
                    path = data.get('path')
                    print(f"Polling server... Response: {data}")
                    if path:
                        print(f"\nUpload detected! File path: {path}")
                        return path
                else:
                    # Log if the request fails for some reason
                    print(f"Polling server... Error: Status {response.status_code}") 
            except requests.exceptions.RequestException as e:
                # Log connection errors
                print(f"Polling server... Connection error: {e}")
            time.sleep(5)
            sys.stdout.write(".")
            sys.stdout.flush()

            if (time.time() - start_time) / 60 > max_wait_minutes:
                print(f"\nMaximum waiting time exceeded.")
                return None
    except KeyboardInterrupt:
        print("\nCancelled by user.")
        return None

def wait_for_filtering():
    """Waits for the user to complete the filtering process via the UI."""
    max_wait_minutes = 30
    start_time = time.time()
    
    print(f"Waiting for filtering to be completed in the UI (maximum {max_wait_minutes} minutes)...")
    print("Press CTRL+C to skip filtering.")
    
    try:
        while True:
            try:
                response = requests.get("http://localhost:8000/api/simod/status")
                if response.ok and response.json().get('status') == 'completed_filtering':
                    print("\nReceived signal that filtering is completed.")
                    path_response = requests.get("http://localhost:8000/api/event-log/filtered-path")
                    if path_response.ok:
                        path = path_response.json().get('path')
                        if path and os.path.exists(path):
                            return path
            except requests.exceptions.RequestException:
                pass
            
            time.sleep(5)
            sys.stdout.write(".")
            sys.stdout.flush()

            if (time.time() - start_time) / 60 > max_wait_minutes:
                print(f"\nMaximum waiting time exceeded for filtering.")
                return None
    except KeyboardInterrupt:
        print("\nFiltering skipped by user.")
        return None

def run_simod_with_filtered_log(config_path, event_log_path, additional_args):
    """Runs Simod with the filtered event log."""
    print("\n" + "="*50)
    print(f"Running Simod with FILTERED log...")
    _run_simod_process(config_path, event_log_path, additional_args)

def run_simod_with_original_config(config_path, event_log_path, additional_args):
    """Runs Simod with the original (uploaded) event log."""
    print("\n" + "="*50)
    print(f"Running Simod with ORIGINAL log...")
    _run_simod_process(config_path, event_log_path, additional_args)

def _run_simod_process(config_path, event_log_path, additional_args):
    """Internal function to create a temporary config and execute Simod."""
    if not os.path.exists(event_log_path):
        print(f"FATAL ERROR: Event log file for Simod not found: {event_log_path}")
        return
    
    temp_config_path = None
    try:
        temp_config_path = create_temp_config(config_path, event_log_path)
        if not temp_config_path:
            raise RuntimeError("Could not create temporary configuration file.")
        
        cmd = [sys.executable, "-m", "simod.cli", "--configuration", str(temp_config_path)]
        if additional_args:
            cmd.extend([arg for arg in additional_args if not arg.startswith('--event-log')])

        print(f"Executing: {' '.join(cmd)}")
        exit_code = subprocess.call(cmd)
        print(f"\nSimod execution completed with exit code: {exit_code}")

    except Exception as e:
        print(f"An unexpected error occurred while running Simod: {e}")
    finally:
        if temp_config_path:
            cleanup_temp_config(temp_config_path)

def create_temp_config(config_path, event_log_path):
    """Creates a temporary YAML config with the absolute event log path."""
    try:
        with open(config_path, 'r', encoding='utf-8') as f:
            config = yaml.safe_load(f)
        
        config['common']['train_log_path'] = os.path.abspath(event_log_path)
        
        temp_dir = Path(config_path).parent
        timestamp = time.strftime("%Y%m%d_%H%M%S")
        temp_config_path = temp_dir / f"temp_config_{timestamp}.yml"
        
        with open(temp_config_path, 'w', encoding='utf-8') as f:
            yaml.dump(config, f)
        
        print(f"Temporary configuration created: {temp_config_path}")
        return temp_config_path
    
    except Exception as e:
        print(f"Error creating temporary configuration file: {e}")
        return None

def cleanup_temp_config(temp_config_path):
    """Deletes the temporary configuration file."""
    try:
        if "temp_config_" in str(temp_config_path) and os.path.exists(temp_config_path):
            os.remove(temp_config_path)
            print(f"Temporary configuration file deleted: {temp_config_path}")
    except Exception as e:
        print(f"Error deleting temporary file '{temp_config_path}': {e}")

if __name__ == "__main__":
    main()