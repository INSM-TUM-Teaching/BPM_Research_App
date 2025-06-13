import json
import pickle
import shutil
from pathlib import Path
from typing import Optional

from pix_framework.discovery.case_arrival import discover_case_arrival_model
from pix_framework.discovery.resource_calendar_and_performance.calendar_discovery_parameters import (
    CalendarDiscoveryParameters,
)
from pix_framework.discovery.resource_model import discover_resource_model
from pix_framework.filesystem.file_manager import create_folder, get_random_folder_id
from pix_framework.io.bpmn import get_activities_names_from_bpmn

from simod.cli_formatter import print_section
from simod.control_flow.optimizer import ControlFlowOptimizer
from simod.control_flow.settings import HyperoptIterationParams as ControlFlowHyperoptIterationParams
from simod.event_log.event_log import EventLog
from simod.resource_model.repair import repair_with_missing_activities
from simod.runtime_meter import RuntimeMeter
from simod.settings.simod_settings import SimodSettings
from simod.simulation.parameters.BPS_model import BPSModel

# --- Constants for state management between scripts ---
INTERMEDIATE_BPMN_FILENAME = "intermediate_bpmn.bpmn"
INTERMEDIATE_BPS_MODEL_FILENAME = "intermediate_bps_model.json"
BEST_CF_PARAMS_FILENAME = "best_control_flow_params.json"
MODEL_ACTIVITIES_FILENAME = "model_activities.pickle"
EVENT_LOG_FILENAME = "event_log.pickle"
# --- FIX: Changed filename to match the output of the to_yaml() method ---
SETTINGS_FILENAME = "simod_settings.yml"
RUNTIMES_FILENAME = "runtimes_part1.pickle"

class SimodControl:
    """
    Runs the Control-Flow discovery stage of the SIMOD pipeline.
    It discovers an initial model and optimizes the control-flow, then saves its state for the next stage.
    """

    _event_log: EventLog
    _settings: SimodSettings
    _best_bps_model: BPSModel
    _output_dir: Path
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
        """
        Executes the control-flow discovery stage and saves the state.
        Returns the path to the output directory for the next stage to use.
        """
        runtimes = runtimes or RuntimeMeter()
        runtimes.start(RuntimeMeter.TOTAL)

        model_activities: Optional[list[str]] = None
        if self._settings.common.process_model_path is not None:
            model_activities = get_activities_names_from_bpmn(self._settings.common.process_model_path)

        # --- Discover Initial Models ---
        print_section("Discovering initial BPS Model")
        runtimes.start(RuntimeMeter.INITIAL_MODEL)
        self._best_bps_model.case_arrival_model = discover_case_arrival_model(
            self._event_log.train_validation_partition, self._event_log.log_ids
        )
        initial_resource_params = CalendarDiscoveryParameters()
        self._best_bps_model.resource_model = discover_resource_model(
            self._event_log.train_partition, self._event_log.log_ids, initial_resource_params
        )
        self._best_bps_model.calendar_granularity = initial_resource_params.granularity
        if model_activities:
            repair_with_missing_activities(
                self._best_bps_model.resource_model, model_activities,
                self._event_log.train_validation_partition, self._event_log.log_ids
            )
        runtimes.stop(RuntimeMeter.INITIAL_MODEL)

        # --- Control-Flow Optimization ---
        print_section("Optimizing control-flow parameters")
        runtimes.start(RuntimeMeter.CONTROL_FLOW_MODEL)
        best_control_flow_params = self._optimize_control_flow()
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
        shutil.copy(self._best_bps_model.process_model, intermediate_bpmn_path)
        self._best_bps_model.process_model = intermediate_bpmn_path  # Update path in model

        # Save BPS model parameters to JSON
        
        prosimos_params = self._best_bps_model.to_prosimos_format()
        if self._best_bps_model.case_arrival_model is not None:
            print("DEBUG (Stage 1): Found a valid CaseArrivalModel. Injecting it into the JSON.")
            arrival_model_dict = self._best_bps_model.case_arrival_model.to_dict()
            prosimos_params["arrival_time_distribution"] = arrival_model_dict
        
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

        # Save the full settings file
        settings_path = self._output_dir / "control-flow" / SETTINGS_FILENAME
        self._settings.to_yaml(settings_path)
