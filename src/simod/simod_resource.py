import json
import pickle
import shutil
import dataclasses
from pathlib import Path
from typing import List, Optional

import pandas as pd
from pix_framework.discovery.case_arrival import CaseArrivalModel
from pix_framework.discovery.gateway_probabilities import (
    GatewayProbabilities,
    GatewayProbabilitiesDiscoveryMethod,
    PathProbability,
    compute_gateway_probabilities,
)
from pix_framework.discovery.resource_model import discover_resource_model
from pix_framework.filesystem.file_manager import create_folder, remove_asset
from pix_framework.io.bpm_graph import BPMNGraph

from simod.batching.discovery import discover_batching_rules
from simod.branch_rules.types import BranchRules
from simod.branch_rules.discovery import discover_branch_rules, map_branch_rules_to_flows
from simod.cli_formatter import print_section, print_subsection
from simod.control_flow.discovery import add_bpmn_diagram_to_model, discover_process_model
from simod.control_flow.settings import HyperoptIterationParams as ControlFlowHyperoptIterationParams
from simod.settings.control_flow_settings import ProcessModelDiscoveryAlgorithm
from simod.data_attributes.discovery import discover_data_attributes
from simod.event_log.event_log import EventLog
from simod.extraneous_delays.optimizer import ExtraneousDelaysOptimizer
from simod.extraneous_delays.types import ExtraneousDelay
from simod.extraneous_delays.utilities import add_timers_to_bpmn_model
from simod.metrics import Metric
from simod.prioritization.discovery import discover_prioritization_rules
from simod.resource_model.optimizer import ResourceModelOptimizer
from simod.resource_model.repair import repair_with_missing_activities
from simod.settings.control_flow_settings import ProcessModelDiscoveryAlgorithm
from simod.resource_model.settings import HyperoptIterationParams as ResourceModelHyperoptIterationParams
from simod.runtime_meter import RuntimeMeter
from simod.settings.simod_settings import SimodSettings
from simod.simulation.parameters.BPS_model import BPSModel
from simod.simulation.prosimos import simulate_and_evaluate
from simod.utilities import get_process_model_path, get_simulation_parameters_path

from simod.simod_control import (
    INTERMEDIATE_BPMN_FILENAME,
    INTERMEDIATE_BPS_MODEL_FILENAME,
    BEST_CF_PARAMS_FILENAME,
    MODEL_ACTIVITIES_FILENAME,
    EVENT_LOG_FILENAME,
    SETTINGS_FILENAME,
    RUNTIMES_FILENAME
)

class SimodResource:
    _event_log: EventLog
    _settings: SimodSettings
    _runtimes: RuntimeMeter
    _model_activities: Optional[list[str]]
    _best_control_flow_params: ControlFlowHyperoptIterationParams
    _best_bps_model: BPSModel

    final_bps_model: Optional[BPSModel]
    _output_dir: Path
    _resource_model_optimizer: Optional[ResourceModelOptimizer]
    _extraneous_delays_optimizer: Optional[ExtraneousDelaysOptimizer]

    def __init__(self, resume_dir: Path):
        if not resume_dir.exists():
            raise FileNotFoundError(f"Resume directory not found at {resume_dir}")

        print_section(f"Resuming SIMOD pipeline from directory: {resume_dir}")
        self._output_dir = resume_dir
        self._control_flow_files_dir = self._output_dir / "control-flow"

        self._load_state_from_files()

        self._resource_model_dir = self._output_dir / "resource_model"
        create_folder(self._resource_model_dir)
        if self._settings.extraneous_activity_delays is not None:
            self._extraneous_delays_dir = self._output_dir / "extraneous-delay-timers"
            create_folder(self._extraneous_delays_dir)
        self._best_result_dir = self._output_dir / "best_result"
        create_folder(self._best_result_dir)

    def _load_state_from_files(self):
        """Loads all state objects from the files saved by SimodControl."""
        print_subsection("Loading state from previous stage")
        self._settings = SimodSettings.from_path(self._control_flow_files_dir / SETTINGS_FILENAME)
        with (self._control_flow_files_dir / EVENT_LOG_FILENAME).open("rb") as f:
            self._event_log = pickle.load(f)
        with (self._control_flow_files_dir / RUNTIMES_FILENAME).open("rb") as f:
            self._runtimes = pickle.load(f)
        with (self._control_flow_files_dir / MODEL_ACTIVITIES_FILENAME).open("rb") as f:
            self._model_activities = pickle.load(f)
        
        with (self._control_flow_files_dir / BEST_CF_PARAMS_FILENAME).open("r") as f:
            raw_params = json.load(f)
            constructor_params = {}
            for key in ['epsilon', 'eta', 'f_score', 'project_name']:
                if key in raw_params:
                    constructor_params[key] = raw_params[key]
            for key in ['replace_or_joins', 'prioritize_parallelism']:
                 if key in raw_params:
                    constructor_params[key] = str(raw_params[key]).lower() == 'true'
            if 'mining_algorithm' in raw_params:
                algo_str = raw_params['mining_algorithm']
                if algo_str == 'Split Miner v1':
                    constructor_params['mining_algorithm'] = ProcessModelDiscoveryAlgorithm.SPLIT_MINER_V1
                else:
                    constructor_params['mining_algorithm'] = ProcessModelDiscoveryAlgorithm(algo_str)
            if 'optimization_metric' in raw_params:
                metric_name_str = raw_params['optimization_metric']
                metric_value_str = metric_name_str.lower()
                constructor_params['optimization_metric'] = Metric(metric_value_str)
            if 'gateway_probabilities' in raw_params:
                method_str = raw_params['gateway_probabilities']
                constructor_params['gateway_probabilities_method'] = GatewayProbabilitiesDiscoveryMethod(method_str)
            constructor_params.setdefault('output_dir', self._control_flow_files_dir)
            constructor_params.setdefault('provided_model_path', self._settings.common.process_model_path)
            valid_keys = {f.name for f in dataclasses.fields(ControlFlowHyperoptIterationParams)}
            final_params = {k: v for k, v in constructor_params.items() if k in valid_keys}
            self._best_control_flow_params = ControlFlowHyperoptIterationParams(**final_params)

        # --- Reconstruct the BPSModel from all intermediate parts ---
        self._best_bps_model = BPSModel()
        with (self._control_flow_files_dir / INTERMEDIATE_BPS_MODEL_FILENAME).open("r") as f:
            params = json.load(f)

            arrival_dist = params.get("arrival_time_distribution")
            arrival_cal = params.get("arrival_time_calendar")
            if arrival_dist:
                self._best_bps_model.case_arrival_model = CaseArrivalModel.from_dict(
                    {
                    "arrival_time_distribution": arrival_dist,
                    "arrival_time_calendar": arrival_cal,
                    }
                )

            raw_gateway_probs = params.get("gateway_branching_probabilities")
            if raw_gateway_probs:
                reconstructed_probs = []
                for p_dict in raw_gateway_probs:
                    path_prob_list = [
                        PathProbability(
                            path_id=path_data["path_id"],
                            probability=path_data["value"],
                            condition_id=path_data.get("condition_id")
                        )
                    for path_data in p_dict['probabilities']]
                    reconstructed_probs.append(GatewayProbabilities(
                        gateway_id=p_dict['gateway_id'], outgoing_paths=path_prob_list
                    ))
                self._best_bps_model.gateway_probabilities = reconstructed_probs
        
        # --- Use the BPMN from the control-flow stage directly ---
        self._best_bps_model.process_model = self._control_flow_files_dir / INTERMEDIATE_BPMN_FILENAME
        print(f"Loaded BPMN model: {self._best_bps_model.process_model}")
        print("State loaded successfully.")

    def run(self):
        """
        Executes the remaining stages of the SIMOD pipeline, building upon the initial model.
        """
        # --- Data Attributes --- #
        if (self._settings.common.discover_data_attributes or
                self._settings.resource_model.discover_prioritization_rules):
            print_section("Discovering data attributes")
            self._runtimes.start(RuntimeMeter.DATA_ATTRIBUTES_MODEL)
            global_attributes, case_attributes, event_attributes = discover_data_attributes(
                self._event_log.train_validation_partition,
                self._event_log.log_ids,
            )
            self._best_bps_model.global_attributes = global_attributes
            self._best_bps_model.case_attributes = case_attributes
            self._best_bps_model.event_attributes = event_attributes
            self._runtimes.stop(RuntimeMeter.DATA_ATTRIBUTES_MODEL)
        
        # --- Resource Model Discovery --- #
        print_section("Optimizing resource model parameters")
        self._runtimes.start(RuntimeMeter.RESOURCE_MODEL)
        best_resource_model_params = self._optimize_resource_model()
        if self._resource_model_optimizer and self._resource_model_optimizer.best_bps_model:
            best_opt_rm_model = self._resource_model_optimizer.best_bps_model
            self._best_bps_model.resource_model = best_opt_rm_model.resource_model
            self._best_bps_model.calendar_granularity = best_opt_rm_model.calendar_granularity
            self._best_bps_model.prioritization_rules = best_opt_rm_model.prioritization_rules
            self._best_bps_model.batching_rules = best_opt_rm_model.batching_rules
        self._runtimes.stop(RuntimeMeter.RESOURCE_MODEL)

        # --- Extraneous Delays Discovery --- #
        if self._settings.extraneous_activity_delays is not None:
            print_section("Discovering extraneous delays")
            self._runtimes.start(RuntimeMeter.EXTRANEOUS_DELAYS)
            timers = self._optimize_extraneous_activity_delays()
            self._best_bps_model.extraneous_delays = timers
            add_timers_to_bpmn_model(self._best_bps_model.process_model, timers)  # Update BPMN model on disk
            self._runtimes.stop(RuntimeMeter.EXTRANEOUS_DELAYS)

        # --- Discover final BPS model --- #
        print_section("Discovering final BPS model")
        self._runtimes.start(RuntimeMeter.FINAL_MODEL)
        self.final_bps_model = BPSModel( 
            process_model=get_process_model_path(self._best_result_dir, self._event_log.process_name),
            case_arrival_model=self._best_bps_model.case_arrival_model,
            case_attributes=self._best_bps_model.case_attributes,
            global_attributes=self._best_bps_model.global_attributes,
            event_attributes=self._best_bps_model.event_attributes,
        )
        best_control_flow_params = self._best_control_flow_params

        # Process model
        if self._settings.common.process_model_path is None:
            # Discover process model with best control-flow parameters
            print_subsection(
                f"Discovering process model with best control-flow settings: {best_control_flow_params.to_dict()}"
            )
            # Instantiate event log to discover the process model with
            xes_log_path = self._best_result_dir / f"{self._event_log.process_name}_train_val.xes"
            if best_control_flow_params.mining_algorithm is ProcessModelDiscoveryAlgorithm.SPLIT_MINER_V1:
                self._event_log.train_validation_to_xes(xes_log_path, only_complete_events=True)
            else:
                self._event_log.train_validation_to_xes(xes_log_path)
            
            # Discover the process model
            discover_process_model(
                log_path=xes_log_path,
                output_model_path=self.final_bps_model.process_model,
                params=best_control_flow_params,
            )
        else:
            # Copy provided process model to best result folder
            print_subsection("Using provided process model")
            shutil.copy(self._settings.common.process_model_path, self.final_bps_model.process_model)
        
        
        # Gateway probabilities
        print_subsection("Discovering gateway probabilities")
        best_bpmn_graph = BPMNGraph.from_bpmn_path(self.final_bps_model.process_model)
        self.final_bps_model.gateway_probabilities = compute_gateway_probabilities(
            event_log=self._event_log.train_validation_partition,
            log_ids=self._event_log.log_ids,
            bpmn_graph=best_bpmn_graph,
            discovery_method=best_control_flow_params.gateway_probabilities_method,
        )
        #  Branch Rules
        if self._settings.control_flow.discover_branch_rules:
            print_section("Discovering branch conditions")
            self.final_bps_model.branch_rules = discover_branch_rules(
                best_bpmn_graph,
                self._event_log.train_validation_partition,
                self._event_log.log_ids,
                f_score=best_control_flow_params.f_score
            )
            self.final_bps_model.gateway_probabilities = \
                map_branch_rules_to_flows(self.final_bps_model.gateway_probabilities, self.final_bps_model.branch_rules)
        # Resource model
        print_subsection("Discovering best resource model")
        self.final_bps_model.resource_model = discover_resource_model(
            event_log=self._event_log.train_validation_partition,
            log_ids=self._event_log.log_ids,
            params=best_resource_model_params.calendar_discovery_params,
        )
        self.final_bps_model.calendar_granularity = best_resource_model_params.calendar_discovery_params.granularity
        if self._model_activities is not None:
            repair_with_missing_activities(
                self.final_bps_model.resource_model,
                self._model_activities,
                self._event_log.train_validation_partition,
                self._event_log.log_ids,
            )

        # Prioritization
        if best_resource_model_params.discover_prioritization_rules:
            print_subsection("Discovering prioritization rules")
            self.final_bps_model.prioritization_rules = discover_prioritization_rules(
                self._event_log.train_validation_partition,
                self._event_log.log_ids,
                self._best_bps_model.case_attributes,
            )
        # Batching
        if best_resource_model_params.discover_batching_rules:
            print_subsection("Discovering batching rules")
            self.final_bps_model.batching_rules = discover_batching_rules(
                self._event_log.train_validation_partition, self._event_log.log_ids
            )
        # Extraneous delays
        if self._best_bps_model.extraneous_delays is not None:
            # Add discovered delays and update BPMN model on disk
            self.final_bps_model.extraneous_delays = self._best_bps_model.extraneous_delays
            add_timers_to_bpmn_model(self.final_bps_model.process_model, self._best_bps_model.extraneous_delays)
        self.final_bps_model.replace_activity_names_with_ids()
        self._runtimes.stop(RuntimeMeter.FINAL_MODEL)
        self._runtimes.stop(RuntimeMeter.TOTAL)

        # Write JSON parameters to file
        json_parameters_path = get_simulation_parameters_path(self._best_result_dir, self._event_log.process_name)
        with json_parameters_path.open("w") as f:
            json.dump(self.final_bps_model.to_prosimos_format(), f)

        # --- Evaluate final BPS model --- #
        if self._settings.common.perform_final_evaluation:
            print_subsection("Evaluate")
            self._runtimes.start(RuntimeMeter.EVALUATION)
            simulation_dir = self._best_result_dir / "evaluation"
            simulation_dir.mkdir(parents=True, exist_ok=True)
            self._evaluate_model(self.final_bps_model.process_model, json_parameters_path, simulation_dir)
            self._runtimes.stop(RuntimeMeter.EVALUATION)

        # --- Export settings and clean temporal files --- #
        print_section(f"Exporting canonical model, runtimes, settings and cleaning up intermediate files")
        canonical_model_path = self._best_result_dir / "canonical_model.json"
        _export_canonical_model(canonical_model_path, best_control_flow_params, best_resource_model_params)
        runtimes_model_path = self._best_result_dir / "runtimes.json"
        _export_runtimes(self._best_result_dir / "runtimes.json", self._runtimes)
        if self._settings.common.clean_intermediate_files:
            self._clean_up()
        self._settings.to_yaml(self._best_result_dir/ SETTINGS_FILENAME)

        # --- Add BPMN diagram to the model --- #
        add_bpmn_diagram_to_model(self.final_bps_model.process_model)


    def _optimize_resource_model(
        self, model_activities: Optional[list[str]] = None
    ) -> ResourceModelHyperoptIterationParams:
        """
        Resource Model (resource profiles, calendars an activity performances) discovery.
        """
        self._resource_model_optimizer = ResourceModelOptimizer(
            event_log=self._event_log,
            bps_model=self._best_bps_model,
            settings=self._settings.resource_model,
            base_directory=self._resource_model_dir,
            model_activities=model_activities,
        )
        best_resource_model_params = self._resource_model_optimizer.run()
        return best_resource_model_params

    def _optimize_extraneous_activity_delays(self) -> List[ExtraneousDelay]:
        settings = self._settings.extraneous_activity_delays
        self._extraneous_delays_optimizer = ExtraneousDelaysOptimizer(
            event_log=self._event_log,
            bps_model=self._best_bps_model,
            settings=settings,
            base_directory=self._extraneous_delays_dir,
        )
        timers = self._extraneous_delays_optimizer.run()
        return timers

    def _evaluate_model(self, process_model: Path, json_parameters: Path, output_dir: Path):
        simulation_cases = self._event_log.test_partition[self._settings.common.log_ids.case].nunique()
        simulation_start_time = self._event_log.test_partition[self._settings.common.log_ids.start_time].min()

        metrics = (
            self._settings.common.evaluation_metrics
            if isinstance(self._settings.common.evaluation_metrics, list)
            else [self._settings.common.evaluation_metrics]
        )

        self._event_log.test_partition.to_csv(output_dir / "test_log.csv", index=False)

        measurements = simulate_and_evaluate(
            process_model_path=process_model,
            parameters_path=json_parameters,
            output_dir=output_dir,
            simulation_cases=simulation_cases,
            simulation_start_time=simulation_start_time,
            validation_log=self._event_log.test_partition,
            validation_log_ids=self._event_log.log_ids,
            num_simulations=self._settings.common.num_final_evaluations,
            metrics=metrics,
        )

        measurements_path = output_dir / "evaluation_metrics.csv"
        measurements_df = pd.DataFrame.from_records(measurements)
        measurements_df.to_csv(measurements_path, index=False)

    def _clean_up(self):
        print_section("Removing intermediate files")
        self._resource_model_optimizer.cleanup()
        if self._settings.extraneous_activity_delays is not None:
            self._extraneous_delays_optimizer.cleanup()
        if self._settings.common.process_model_path is None:
            final_xes_log_path = self._best_result_dir / f"{self._event_log.process_name}_train_val.xes"
            remove_asset(final_xes_log_path)


def _export_canonical_model(
    file_path: Path,
    control_flow_settings: ControlFlowHyperoptIterationParams,
    calendar_settings: ResourceModelHyperoptIterationParams,
):
    canon = {
        "control_flow": control_flow_settings.to_dict(),
        "calendars": calendar_settings.to_dict(),
    }
    with open(file_path, "w") as f:
        json.dump(canon, f)


def _export_runtimes(file_path: Path,
        runtimes: Optional[RuntimeMeter]):
        with file_path.open ("w") as file:
            json.dump(runtimes.runtimes | {'explanation': f"Add '{RuntimeMeter.PREPROCESSING}' with '{RuntimeMeter.TOTAL}' "
                                                f"for the runtime of the entire SIMOD pipeline and preprocessing "
                                                f"stage. '{RuntimeMeter.EVALUATION}', if reported, should be left out "
                                                f"as it measures the quality assessment of the final BPS model (i.e., "
                                                f"it is not part of the discovery process."},
            file
        )