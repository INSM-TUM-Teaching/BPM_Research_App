# Topic 3: Augmenting an Automated ML-based Simulation Discovery Tool with Human Expertise

![Simod](https://github.com/AutomatedProcessImprovement/Simod/actions/workflows/simod.yml/badge.svg)
![version](https://img.shields.io/github/v/tag/AutomatedProcessImprovement/simod)
[![Documentation Status](https://readthedocs.org/projects/simod/badge/?version=latest)](https://simod.readthedocs.io/en/latest/)

SIMOD combines process mining and machine learning techniques to automate the discovery and tuning of Business Process
Simulation models from event logs extracted from enterprise information systems (ERPs, CRM, case management systems,
etc.).
SIMOD takes as input an event log in CSV format, a configuration file, and (optionally) a BPMN process model, and
discovers a business process simulation model that can be simulated using
the [Prosimos](https://github.com/AutomatedProcessImprovement/Prosimos) simulator, which is embedded in Simod.

## Dependencies

### Required

| Dependency | Version | Notes                                                                                                                                 |
| ---------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| Python     | 3.9     | For Windows, [Python 3.9.13](https://www.python.org/downloads/release/python-3913/) is the last distribution with Windows installers. |
| Java       | 1.8     | For example, use [Amazon Corretto 8](https://docs.aws.amazon.com/corretto/latest/corretto-8-ug/downloads-list.html).                  |
| Node.js    | 16+     | Required for the React GUI frontend. Download from [nodejs.org](https://nodejs.org/).                                                 |

## Project Structure

This project contains several key components:

- **`src/simod/`** - Core Simod library and algorithms
- **`src/simod/gui/`** - React.js frontend for web-based GUI
- **`src/simod/server/`** - FastAPI backend server and wrapper scripts
- **`resources/`** - Sample configurations and event logs
- **`tests/`** - Unit and integration tests
- **`docs/`** - Documentation source files

## Getting Started

### Simod with GUI

This project includes a modern web-based graphical user interface for easier interaction with Simod.

#### Prerequisites

❗️Make sure the following are installed:

- `java -version` returns `1.8`
- `python` 3.9+ is installed with `pip`
- `node.js` and `npm` are installed for the React frontend

#### Quick Start with GUI

1. **Install all Python dependencies** (including Simod):

   ```shell
   pip install -r requirements.txt
   ```

2. **Install React dependencies**:

   ```shell
   cd src/simod/gui
   npm install
   cd ../../..
   ```

3. **Start the full application** (backend + frontend):

   ```shell
   # On Linux/macOS
   ./start_all.sh

   # On Windows (manually start both components)
   # Terminal 1: Start the React frontend
   cd src/simod/gui
   npm start

   # Terminal 2: Start the Python backend
   cd src/simod/server
   python simod_wrapper.py --configuration configuration_test.yml
   ```

4. **Access the Web Interface**:

   - The React frontend will be available at `http://localhost:3000`
   - The FastAPI backend will be available at `http://localhost:8000`

5. **Using the GUI**:
   - Upload your event log CSV file through the web interface
   - Filter and configure your data interactively
   - View BPMN models and simulation results in the browser

#### Manual Setup

If you prefer to start components separately:

**Frontend (React GUI):**

```shell
cd src/simod/gui
npm install        # Install dependencies
npm start          # Start development server (http://localhost:3000)
```

**Backend (FastAPI Server):**

```shell
# First install dependencies
pip install -r requirements.txt

# Then start the server
cd src/simod/server
python server.py             # Start API server (http://localhost:8000)
# OR
python simod_wrapper.py --configuration path/to/config.yml
```

## Configuration file

A set of example configurations can be found in the
[resources](https://github.com/AutomatedProcessImprovement/Simod/tree/master/resources) folder along with a description
of each element:

- Basic configuration to discover the full BPS
  model ([here](https://github.com/AutomatedProcessImprovement/Simod/blob/master/resources/config/configuration_example.yml)).
- Basic configuration to discover the full BPS model using fuzzy (probabilistic) resource
  calendars ([here](https://github.com/AutomatedProcessImprovement/Simod/blob/master/resources/config/configuration_example_fuzzy.yml)).
- Basic configuration to discover the full BPS model with data-aware branching rules
  ([here](https://github.com/AutomatedProcessImprovement/Simod/blob/master/resources/config/configuration_example_data_aware.yml)).
- Basic configuration to discover the full BPS model, and evaluate it with a specified event
  log ([here](https://github.com/AutomatedProcessImprovement/Simod/blob/master/resources/config/configuration_example_with_evaluation.yml)).
- Basic configuration to discover a BPS model with a provided BPMN process model as starting
  point ([here](https://github.com/AutomatedProcessImprovement/Simod/blob/master/resources/config/configuration_example_with_provided_process_model.yml)).
- Basic configuration to discover a BPS model with no optimization process (one-shot) ([here](https://github.com/AutomatedProcessImprovement/Simod/blob/master/resources/config/configuration_one_shot.yml)).
- Complete configuration example with all the possible
  parameters ([here](https://github.com/AutomatedProcessImprovement/Simod/blob/master/resources/config/complete_configuration.yml)).

## For developers

To install all dependencies for development:

```shell
pip install -r requirements.txt
```

To install package in editable mode:

```shell
pip install -e .
```

To start the web GUI development environment:

```shell
cd src/simod/gui
npm install
npm start
```

To start the API server:

```shell
cd src/simod/server
python server.py
```
