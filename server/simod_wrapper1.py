import os
import sys
import time
import signal
import argparse
import subprocess
from pathlib import Path
import requests
import webbrowser
import threading
import tkinter as tk
from tkinter import filedialog
import yaml


# Define global variables (if any)
########
# Filter the event log before running Simod
def main():
    parser = argparse.ArgumentParser(description="Simod wrapper - with event log filtering")
    parser.add_argument("--configuration", type=str, required=True, help="Simod configuration file")
    parser.add_argument("--event-log", type=str, help="Event log file (overrides the value in configuration)")
    args, unknown = parser.parse_known_args()
    
    # Fix configuration file path
    config_path = args.configuration
    
    # Check if configuration file exists
    if not os.path.isabs(config_path):
        # Possible configuration file locations
        script_dir = os.path.dirname(os.path.abspath(__file__))
        
        # 1. Specified relative path
        path_1 = os.path.abspath(os.path.join(script_dir, config_path))
        
        # 2. Relative path according to BPM_Research_App
        parent_dir = os.path.dirname(script_dir)  # BPM_Research_App directory
        path_2 = os.path.join(parent_dir, "resources", "config", os.path.basename(config_path))
        
        # 3. Relative path according to Simod Project
        grand_parent_dir = os.path.dirname(parent_dir)  # Simod Project directory
        path_3 = os.path.join(grand_parent_dir, "resources", "config", os.path.basename(config_path))
        
        # Check if these paths exist
        for path in [path_1, path_2, path_3]:
            if os.path.exists(path):
                config_path = path
                break
    
    # Configuration file existence
    if not os.path.exists(config_path):
        print(f"ERROR: Configuration file not found: {config_path}")
        sys.exit(1)
    
    print(f"Configuration file: {config_path}")
    

    event_log_path = None
    # Find event log path
    # 1. Highest Priority: Command-line argument
    if args.event_log:
        print(f"INFO: Using event log from command-line argument: {args.event_log}")
        event_log_path = args.event_log
    else:
    # 2. Second Priority: Path from YAML file
        print("No command-line argument for event log. Checking configuration file...")
        extracted_path = extract_event_log_path(config_path)
        # If there is train_log_path: filePath, use it.
        if extracted_path:
            print("Using event log from configuration file : {extracted_path}.")
            event_log_path = extracted_path
        else:
        # 3. Lowest Priority (Fallback): GUI File Dialog
            print("No event log path found in configuration. Opening file dialog...")
            root = tk.Tk()
            root.withdraw()
            
            gui_selected_path = filedialog.askopenfilename(
                title="Select an Event Log CSV File",
                filetypes=(("CSV files", "*.csv *.csv.gz"), ("All files", "*.*"))
            )
            if not gui_selected_path:
                print("No event log file selected. Exiting.")
                sys.exit(0)
            
            event_log_path = gui_selected_path
            print(f"INFO: User selected event log: {event_log_path}")
    
    if not event_log_path :
        print("ERROR: Event log file not found. Please specify with --event-log parameter or define in the configuration file.")
        sys.exit(1)
    
    # Check if event log file exists
    if not os.path.exists(event_log_path):
        print(f"ERROR: Event log file not found: {event_log_path}")
        sys.exit(1)
    
    print(f"Event log file: {event_log_path}")
    
    # Start the FastAPI server
    server_running = check_server_running()
    if not server_running:
        print("FastAPI server is not running. Starting the server...")
        start_server()
        time.sleep(5)
    
    # Clear previous event logs and filtering status
    print("Clearing previous event logs and filtering status...")
    try:
        response = requests.post("http://localhost:8000/api/event-log/clear")
    except Exception as e:
        print(f"API access error: {str(e)}")
    
    # Upload event log to API
    uploaded_path = send_event_log_to_api(event_log_path)
    if not uploaded_path:
        print("ERROR: Event log file could not be uploaded to API.")
        sys.exit(1)
    
    # Open React GUI
    print("Opening GUI...")
    open_gui()
    
    print("\n" + "="*50)
    print("Event log filtering phase")
    print("Please filter from the Event Log page in the web interface.")
    print("Click 'Continue with Filtered Data' button when you complete filtering.")
    print("="*50)
    
    # Wait for filtering
    filtered_path = wait_for_filtering()
    
    # If filtering was done, run with filtered log
    # Otherwise, run with original log
    if filtered_path:
        print(f"Using filtered event log: {filtered_path}")
        # Run Simod without changing the original configuration
        run_simod_with_filtered_log(config_path, filtered_path, unknown)
    else:
        print("Filtering not done. Using original event log.")
        # Run with original configuration
        run_simod_with_original_config(config_path,event_log_path, unknown)


def extract_event_log_path(config_path):
    """Extracts event log path from YAML configuration file"""
    try:
        import yaml
        import os
        
        print(f"Reading configuration file: {config_path}")
        
        # Check configuration file with full path
        if not os.path.exists(config_path):
            print(f"ERROR: Configuration file not found: {config_path}")
            return None
        
        # Read configuration file
        with open(config_path, 'r', encoding='utf-8') as f:
            config = yaml.safe_load(f)
            
        # Print configuration content (for debugging)
        print(f"Configuration content:\n{yaml.dump(config, default_flow_style=False)}")
        
        # Extract event log path according to Simod v5
        event_log_path = config.get('common', {}).get('train_log_path')
        if not event_log_path:
            return None
        
        # Get the directory of configuration file
        config_dir = os.path.dirname(os.path.abspath(config_path))
        print(f"Configuration directory: {config_dir}")
        
        # Convert relative path to absolute path
        if event_log_path.startswith("..") or event_log_path.startswith("./"):
            abs_path = os.path.normpath(os.path.join(config_dir, event_log_path))
            print(f"Created absolute path from relative path: {abs_path}")
        else:
            # Probably it's already an absolute path, but let's check to be sure
            if os.path.isabs(event_log_path):
                abs_path = event_log_path
            else:
                # If it's a simple filename, combine with the configuration file directory
                abs_path = os.path.join(config_dir, event_log_path)
                
            print(f"Calculated absolute path: {abs_path}")
        
        # Check if the file exists
        if os.path.exists(abs_path):
            print(f"Event log file found: {abs_path}")
            return abs_path
        else:
            print(f"ERROR: Event log file not found: {abs_path}")
            
            # Try alternative locations
            # 1. event_logs folder in Simod Project directory
            #simod_project_dir = os.path.dirname(os.path.dirname(config_dir))
            #alt_path = os.path.join(simod_project_dir, "event_logs", os.path.basename(event_log_path))
            # print(f"Trying alternative location: {alt_path}")
            # if os.path.exists(alt_path):
            #     print(f"Event log file found in alternative location: {alt_path}")
            #     return alt_path
                
            # # 2. event_logs folder in BPM_Reserch_App directory
            # bpm_app_dir = os.path.dirname(config_dir)  # BPM_Reserch_App directory
            # alt_path2 = os.path.join(bpm_app_dir, "event_logs", os.path.basename(event_log_path))
            # print(f"Trying second alternative location: {alt_path2}")
            # if os.path.exists(alt_path2):
            #     print(f"Event log file found in second alternative location: {alt_path2}")
            #     return alt_path2
            # 1. event_logs folder relative to config file's parent
            alt_path_1 = Path(config_dir).parent / 'event_logs' / Path(event_log_path).name
            if alt_path_1.exists():
                print(f"Found in alternative location: {alt_path_1}")
                return str(alt_path_1)

            # 2. event_logs folder relative to config file's grandparent
            alt_path_2 = Path(config_dir).parent.parent / 'event_logs' / Path(event_log_path).name
            if alt_path_2.exists():
                print(f"Found in alternative location: {alt_path_2}")
                return str(alt_path_2)

                
            return None
            
    except Exception as e:
        import traceback
        print(f"Error while extracting event log path from configuration file: {str(e)}")
        print(traceback.format_exc())
        return None

def check_server_running():
    """Checks if the FastAPI server is running"""
    try:
        response = requests.get("http://localhost:8000/", timeout=2)
        return response.status_code == 200
    except:
        return False

def start_server():
    """Starts the FastAPI server in the background"""
    server_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "server")
    cmd = [sys.executable, "-m", "uvicorn", "server:app", "--host", "0.0.0.0", "--port", "8000"]
    
    # Start the server in the background
    subprocess.Popen(cmd, cwd=server_path, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    print("Starting FastAPI server...")
    time.sleep(3)

def open_gui():
    """Opens the React GUI in the default browser"""
    try:
        # Check if GUI is running
        gui_running = False
        try:
            response = requests.get("http://localhost:3000/eventlog", timeout=2)
            gui_running = response.status_code == 200
        except:
            gui_running = False
        
        # If GUI is not running, open in browser
        url = "http://localhost:3000/eventlog"
        
        if not gui_running:
            print(f"GUI is not running yet. Please start the React application and open this address: {url}")
        else:
            print("GUI is already running, opening browser...")
            
        # Try to open in default browser (Chrome, Firefox, Edge etc.)
        try:
            # Windows-specific Chrome opening code removed
            webbrowser.open(url)
            print(f"Opened in browser: {url}")
        except Exception as e:
            print(f"Error opening browser: {str(e)}")
            print(f"Please manually open this address: {url}")
            
    except Exception as e:
        print(f"Error opening GUI: {str(e)}")
        print("Please manually open Event Log page: http://localhost:3000/eventlog")

def send_event_log_to_api(log_path):
    """Sends the event log file to the API"""
    try:
        with open(log_path, 'rb') as f:
            files = {'file': (os.path.basename(log_path), f)}
            response = requests.post("http://localhost:8000/api/event-log/upload", files=files)
        
        if response.status_code == 200:
            data = response.json()
            return data.get('file_path')
        else:
            print(f"API response error: {response.status_code}")
            return None
    except Exception as e:
        print(f"Error sending event log to API: {str(e)}")
        return None

def wait_for_filtering():
    """Waits for the user to complete the filtering process"""
    filter_complete = False
    filtered_path = None
    max_wait_minutes = 30
    start_time = time.time()
    
    print(f"Waiting for filtering (maximum {max_wait_minutes} minutes)...")
    print("Press CTRL+C to cancel.")
    
    try:
        wait_count = 0
        while not filter_complete:
            # Notification every 30 seconds
            if wait_count % 3 == 0:
                print(f"Elapsed time: {int((time.time() - start_time) / 60)} minutes - Waiting for filtering...")
                
            # Check filtering status
            try:
                response = requests.get("http://localhost:8000/api/simod/status")
                if response.ok:
                    status_data = response.json()
                    if status_data.get('status') == 'completed_filtering':
                        print("Received signal that filtering is completed.")
                        # Get filtered file path when filtering is completed
                        path_response = requests.get("http://localhost:8000/api/event-log/filtered-path")
                        if path_response.ok:
                            path_data = path_response.json()
                            path = path_data.get('path')
                            
                            if path and os.path.exists(path):
                                # Use absolute path! THIS LINE WAS CHANGED
                                filtered_path = os.path.abspath(path)
                                filter_complete = True
                                print(f"Filtered event log found: {filtered_path}")
                                
                                # File size check
                                file_size_mb = os.path.getsize(filtered_path) / (1024*1024)
                                print(f"File size: {file_size_mb:.2f} MB")
                                
                                # Check file content
                                try:
                                    import pandas as pd
                                    df = pd.read_csv(filtered_path, nrows=5)
                                    print(f"Filtered file has {len(df)} rows (first 5 rows)")
                                    print(f"Columns: {', '.join(df.columns.tolist())}")
                                except Exception as e:
                                    print(f"Error checking file content: {str(e)}")
                                
                                break
                            else:
                                print(f"ERROR: Filtered file not found or not accessible: {path}")
                                # Find by trying alternative locations
                                alternatives = [
                                    # Default location
                                    path,
                                    # uploaded_logs in Server folder
                                    os.path.join(os.path.dirname(os.path.abspath(__file__)), "uploaded_logs", os.path.basename(path)),
                                    # uploaded_logs in project root directory
                                    os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "uploaded_logs", os.path.basename(path))
                                ]
                                
                                # Check alternatives
                                for alt_path in alternatives:
                                    if os.path.exists(alt_path):
                                        filtered_path = alt_path
                                        filter_complete = True
                                        print(f"Filtered event log found in alternative location: {filtered_path}")
                                        break
            except Exception as e:
                pass
            
            # Wait 10 seconds
            time.sleep(10)
            wait_count += 1
            sys.stdout.write(".")
            sys.stdout.flush()
            
            # New line after every 6 dots
            if wait_count % 6 == 0:
                sys.stdout.write("\n")
                sys.stdout.flush()
                
            # Timeout check
            elapsed_minutes = (time.time() - start_time) / 60
            if elapsed_minutes > max_wait_minutes:
                print(f"Maximum waiting time ({max_wait_minutes} minutes) exceeded.")
                break
    
    except KeyboardInterrupt:
        print("\nCancelled by user.")
    
    if filtered_path:
        # Make absolutely sure the filtered file exists
        if not os.path.exists(filtered_path):
            print(f"WARNING: Filtered file not found: {filtered_path}")
            return None
        
        print(f"Filtering completed. Filtered file: {filtered_path}")
    
    return filtered_path

def run_simod_with_filtered_log(config_path, event_log_path, additional_args):
    """Runs Simod with filtered event log"""
    print("\n" + "="*50)
    print(f"Running Simod...")
    print(f"Configuration file: {config_path}")
    print(f"Event log file: {event_log_path}")
    print("="*50 + "\n")
    
    if not os.path.exists(event_log_path):
        print(f"ERROR: Event log file not found: {event_log_path}")
        sys.exit(1)
    
    # Temporarily modify the YAML configuration file
    temp_config_path = create_temp_config(config_path, event_log_path)
    if not temp_config_path or not os.path.exists(temp_config_path):
        print("FATAL ERROR: Could not create a temporary configuration file. Aborting.")
        sys.exit(1)
    
    # CORRECTION: Run Simod's CLI module
    # Find and use the correct command
    python_exe = sys.executable
    
    # Try 3 different possible methods
    commands_to_try = [
        # Method 1: Run simod.cli module
        [python_exe, "-m", "simod.cli", "--configuration", temp_config_path],
        
        # Method 2: Run simod.exe directly
        [os.path.join(os.path.dirname(python_exe), "simod.exe"), "--configuration", temp_config_path],
        
        # Method 3: Run simod with subprocess
        ["simod", "--configuration", temp_config_path]
    ]
    
    # Add additional parameters (except --event-log)
    if additional_args:
        
        for cmd in commands_to_try:
            # Filter out --event-log parameter
            filtered_args = [arg for arg in additional_args if "--event-log" not in arg]
            cmd.extend(filtered_args)
    
    # Try all commands sequentially
    for i, cmd in enumerate(commands_to_try):
        try:
            print(f"Trying method {i+1}: {' '.join(cmd)}")
            exit_code = subprocess.call(cmd)
            
            print("\n" + "="*50)
            print(f"Simod execution completed. Exit code: {exit_code}")
            print("="*50)
            
            if exit_code == 0:
                print("Successfully completed!")
                # Clean up temporary configuration file
                cleanup_temp_config(temp_config_path)
                return exit_code
            else:
                print(f"Method {i+1} failed, exit code: {exit_code}")
                continue
                
        except Exception as e:
            print(f"Method {i+1} gave an error: {str(e)}")
            continue
    
    # Clean up temporary configuration file
    cleanup_temp_config(temp_config_path)
    
    print("WARNING: All execution methods failed.")
    return 1


def run_simod_with_original_config(config_path, event_log_path, additional_args):
    """Runs Simod with original configuration file"""
    print("\n" + "="*50)
    print(f"Running Simod with original configuration...")
    print(f"Configuration file: {config_path}")
    print(f"Event Log for this run: {event_log_path}")
    print("="*50 + "\n")
    
    # Find and use the correct command
    python_exe = sys.executable
    
    # Try 3 different possible methods
    commands_to_try = [
        # Method 1: Run simod.cli module
        [python_exe, "-m", "simod.cli", "--configuration", config_path],
        
        # Method 2: Run simod.exe directly
        [os.path.join(os.path.dirname(python_exe), "simod.exe"), "--configuration", config_path],
        
        # Method 3: Run simod with subprocess
        ["simod", "--configuration", config_path]
    ]
    
    # Add additional parameters
    if additional_args:
        for cmd in commands_to_try:
            cmd.extend(additional_args)
    
    # Try all commands sequentially
    for i, cmd in enumerate(commands_to_try):
        try:
            print(f"Trying method {i+1}: {' '.join(cmd)}")
            exit_code = subprocess.call(cmd)
            
            print("\n" + "="*50)
            print(f"Simod execution completed. Exit code: {exit_code}")
            print("="*50)
            
            if exit_code == 0:
                print("Successfully completed!")
                return exit_code
            else:
                print(f"Method {i+1} failed, exit code: {exit_code}")
                continue
                
        except Exception as e:
            print(f"Method {i+1} gave an error: {str(e)}")
            continue
    
    print("WARNING: All execution methods failed.")
    return 1


def create_temp_config(config_path, event_log_path):
    """
    Creates a copy of the given configuration file and
    inserts event_log_path into the configuration
    """
    try:
        import yaml
        import os
        import tempfile
        from datetime import datetime
        
        # Create temporary file path
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        temp_dir = os.path.dirname(config_path)
        temp_filename = f"temp_config_{timestamp}.yml"
        temp_config_path = os.path.join(temp_dir, temp_filename)
        
        # Read original configuration
        with open(config_path, 'r', encoding='utf-8') as f:
            config = yaml.safe_load(f)
        
        # Use absolute path - CHANGED THESE LINES
        absolute_event_log_path = os.path.abspath(event_log_path)
        print(f"Absolute file path: {absolute_event_log_path}")
        
        # Update event log path
        if 'common' in config:
            config['common']['train_log_path'] = absolute_event_log_path
            print(f"Path written to config: {config['common']['train_log_path']}")
        
        # Save updated configuration
        with open(temp_config_path, 'w', encoding='utf-8') as f:
            yaml.dump(config, f)
        
        print(f"Temporary configuration file created: {temp_config_path}")
        
        # Check configuration file
        with open(temp_config_path, 'r', encoding='utf-8') as f:
            updated_config = yaml.safe_load(f)
            print(f"Configuration content check: {updated_config['common']['train_log_path']}")
        
        return temp_config_path
    
    except Exception as e:
        import traceback
        print(f"Error creating temporary configuration file: {str(e)}")
        print(traceback.format_exc())
        # Use original configuration in case of error
        return config_path


def cleanup_temp_config(temp_config_path):
    """Deletes the temporary configuration file"""
    try:
        if os.path.exists(temp_config_path) and "temp_config_" in temp_config_path:
            os.remove(temp_config_path)
            print(f"Temporary configuration file deleted: {temp_config_path}")
    except Exception as e:
        print(f"Error deleting temporary file: {str(e)}")

# Add at the bottom of the file
if __name__ == "__main__":
    main()