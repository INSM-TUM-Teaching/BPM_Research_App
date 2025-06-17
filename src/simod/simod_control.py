import json
import shutil
from pathlib import Path
from typing import Optional
import pickle
import pandas as pd
from pix_framework.discovery.case_arrival import discover_case_arrival_model
from pix_framework.discovery.gateway_probabilities import compute_gateway_probabilities
from pix_framework.discovery.resource_calendar_and_performance.calendar_discovery_parameters import (
    CalendarDiscoveryParameters,
)
from pix_framework.discovery.resource_model import discover_resource_model
from pix_framework.filesystem.file_manager import create_folder, get_random_folder_id, remove_asset
from pix_framework.io.bpm_graph import BPMNGraph
from pix_framework.io.bpmn import get_activities_names_from_bpmn

from simod.batching.discovery import discover_batching_rules
from simod.branch_rules.discovery import discover_branch_rules, map_branch_rules_to_flows
from simod.cli_formatter import print_section, print_subsection
from simod.control_flow.discovery import discover_process_model, add_bpmn_diagram_to_model
from simod.control_flow.optimizer import ControlFlowOptimizer
from simod.control_flow.settings import HyperoptIterationParams as ControlFlowHyperoptIterationParams
from simod.data_attributes.discovery import discover_data_attributes
from simod.event_log.event_log import EventLog
from simod.extraneous_delays.optimizer import ExtraneousDelaysOptimizer
from simod.extraneous_delays.types import ExtraneousDelay
from simod.extraneous_delays.utilities import add_timers_to_bpmn_model
from simod.prioritization.discovery import discover_prioritization_rules
from simod.resource_model.optimizer import ResourceModelOptimizer
from simod.resource_model.repair import repair_with_missing_activities
from simod.resource_model.settings import HyperoptIterationParams as ResourceModelHyperoptIterationParams
from simod.runtime_meter import RuntimeMeter
from simod.settings.control_flow_settings import ProcessModelDiscoveryAlgorithm
from simod.settings.simod_settings import SimodSettings
from simod.simulation.parameters.BPS_model import BPSModel
from simod.simulation.prosimos import simulate_and_evaluate
from simod.utilities import get_process_model_path, get_simulation_parameters_path

# --- Constants for state management between scripts ---
INTERMEDIATE_BPMN_FILENAME = "intermediate_bpmn.bpmn"
INTERMEDIATE_BPS_MODEL_FILENAME = "intermediate_bps_model.json"
BEST_CF_PARAMS_FILENAME = "best_control_flow_params.json"
MODEL_ACTIVITIES_FILENAME = "model_activities.pickle"
EVENT_LOG_FILENAME = "event_log.pickle"
SETTINGS_FILENAME = "simod_settings.yml"
RUNTIMES_FILENAME = "runtimes_part1.pickle"

class SimodControl:
    """
    Class to run the full pipeline of SIMOD in order to discover a BPS model from an event log.

    Attributes
    ----------
        settings : :class:`~simod.settings.simod_settings.SimodSettings`
            Configuration to run SIMOD and all its stages.
        event_log : :class:`~simod.event_log.event_log.EventLog`
            EventLog class storing the preprocessed training, validation, and (optionally) test partitions.
        output_dir : :class:`~pathlib.Path`
            Path to the folder where to write all the SIMOD outputs.
        final_bps_model : :class:`~simod.simulation.parameters.BPS_model.BPSModel`
            Instance of the best BPS model discovered by SIMOD.
    """

    # Event log with the train, validation and test logs.
    _event_log: EventLog
    # Settings for all SIMOD optimization and discovery processes
    _settings: SimodSettings
    # Best BPS model obtained from the discovery processes
    _best_bps_model: BPSModel
    # Directory to write all the files
    _output_dir: Path
    
    # Optimizer for the Control-Flow and Gateway Probabilities
    _control_flow_optimizer: Optional[ControlFlowOptimizer]

    def __init__(
        self,
        settings: SimodSettings,
        event_log: EventLog,
        output_dir: Optional[Path] = None,
    ):
        self._settings = settings
        self._event_log = event_log
        self._best_bps_model = BPSModel(process_model=self._settings.common.process_model_path)
        if output_dir is None:
            self._output_dir = Path.cwd() / "outputs" / get_random_folder_id()
        else:
            self._output_dir = output_dir
        create_folder(self._output_dir)
        self._control_flow_dir = self._output_dir / "control-flow"
        create_folder(self._control_flow_dir)

    def run(self, runtimes: Optional[RuntimeMeter] = None) -> Path:
       
        runtimes = RuntimeMeter() if runtimes is None else runtimes
        runtimes.start(RuntimeMeter.TOTAL)

        # Model activities might be different from event log activities if the model has been provided,
        # because we split the event log into train, test, and validation partitions.
        # We use model_activities to repair resource_model later after its discovery from a reduced event log.
        model_activities: Optional[list[str]] = None
        if self._settings.common.process_model_path is not None:
            model_activities = get_activities_names_from_bpmn(self._settings.common.process_model_path)

       # --- Discover Default Case Arrival and Resource Allocation models --- #
        print_section("Discovering initial BPS Model")
        runtimes.start(RuntimeMeter.INITIAL_MODEL)
        self._best_bps_model.case_arrival_model = discover_case_arrival_model(
            self._event_log.train_validation_partition,  # No optimization process here, use train + validation
            self._event_log.log_ids,
            use_observed_arrival_distribution=self._settings.common.use_observed_arrival_distribution,
        )
        calendar_discovery_parameters = CalendarDiscoveryParameters()
        self._best_bps_model.resource_model = discover_resource_model(
            self._event_log.train_partition,  # Only train to not discover tasks that won't exist for control-flow opt.
            self._event_log.log_ids,
            calendar_discovery_parameters,
        )
        self._best_bps_model.calendar_granularity = calendar_discovery_parameters.granularity
        if model_activities is not None:
            repair_with_missing_activities(
                resource_model=self._best_bps_model.resource_model,
                model_activities=model_activities,
                event_log=self._event_log.train_validation_partition,
                log_ids=self._event_log.log_ids,
            )
        runtimes.stop(RuntimeMeter.INITIAL_MODEL)

        # --- Control-Flow Optimization --- #
        print_section("Optimizing control-flow parameters")
        runtimes.start(RuntimeMeter.CONTROL_FLOW_MODEL)
        best_control_flow_params = self._optimize_control_flow()
        print("\nBEST CONTROL-FLOW PARAMETERS FOUND:")
        print(best_control_flow_params.to_dict())
        print("\n")
        self._best_bps_model.process_model = self._control_flow_optimizer.best_bps_model.process_model
        self._best_bps_model.gateway_probabilities = self._control_flow_optimizer.best_bps_model.gateway_probabilities
        self._best_bps_model.branch_rules = self._control_flow_optimizer.best_bps_model.branch_rules
        runtimes.stop(RuntimeMeter.CONTROL_FLOW_MODEL)
        
        # --- Save state for the next stage ---
        print_section(f"Saving intermediate results to {self._output_dir}")
        self._save_state_for_resume(best_control_flow_params, model_activities, runtimes)
        
        print("Control-flow discovery stage complete.")
        return self._output_dir

    def _optimize_control_flow(self) -> ControlFlowHyperoptIterationParams:
        self._control_flow_optimizer = ControlFlowOptimizer(
            event_log=self._event_log,
            bps_model=self._best_bps_model,
            settings=self._settings.control_flow,
            base_directory=self._control_flow_dir,
        )
        return self._control_flow_optimizer.run()

    def _save_state_for_resume(self, best_cf_params, model_activities, runtimes):
        """Saves all necessary objects to disk for the next script to continue."""
        # Save BPMN model to a defined filename
        intermediate_bpmn_path = self._output_dir /  "control-flow" / INTERMEDIATE_BPMN_FILENAME
        if self._best_bps_model.process_model:
            shutil.copy(self._best_bps_model.process_model, intermediate_bpmn_path)
            self._best_bps_model.process_model = intermediate_bpmn_path  # Update path in model
        
        with (self._output_dir / "control-flow" / INTERMEDIATE_BPS_MODEL_FILENAME).open("w") as f:
            json.dump(self._best_bps_model.to_prosimos_format(), f, indent=4)

        # Save best control-flow hyperparameters to JSON
        with (self._output_dir / "control-flow" / BEST_CF_PARAMS_FILENAME).open("w") as f:
            json.dump(best_cf_params.to_dict(), f, indent=4)

        # Pickle objects that are complex or have no simple JSON representation
        with (self._output_dir / "control-flow" / MODEL_ACTIVITIES_FILENAME).open("wb") as f:
            pickle.dump(model_activities, f)
        with (self._output_dir / "control-flow" / EVENT_LOG_FILENAME).open("wb") as f:
            pickle.dump(self._event_log, f)
        with (self._output_dir / "control-flow" / RUNTIMES_FILENAME).open("wb") as f:
            pickle.dump(runtimes, f)

        #Save the full settings file
        settings_path = self._output_dir / "control-flow" / SETTINGS_FILENAME
        self._settings.to_yaml(settings_path)
        file_content = settings_path.read_text()
        cleaned_content = file_content.replace("!!python/tuple", "")
        settings_path.write_text(cleaned_content)

    def _optimize_control_flow(self) -> ControlFlowHyperoptIterationParams:
        """
        Control-flow and Gateway Probabilities discovery.
        """
        self._control_flow_optimizer = ControlFlowOptimizer(
            event_log=self._event_log,
            bps_model=self._best_bps_model,
            settings=self._settings.control_flow,
            base_directory=self._control_flow_dir,
        )
        best_control_flow_params = self._control_flow_optimizer.run()
        return best_control_flow_params