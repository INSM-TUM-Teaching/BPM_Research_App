import pandas as pd
from datetime import datetime, timedelta
import random

# --- Configuration ---
NUM_CASES = 200
RESOURCES = ['Adjuster_A', 'Adjuster_B', 'Investigator_X', 'Manager_Y', 'AutoBot_Z']

# Data-driven thresholds
FAST_TRACK_THRESHOLD = 1500
FRAUD_SCORE_THRESHOLD = 0.7

def generate_event(case_id, activity, resource, enabled_time, case_attributes):
    """Helper function to create a single event, now including case attributes."""
    start_delay = timedelta(minutes=random.randint(5, 60))
    duration = timedelta(minutes=random.randint(10, 180))
    start_time = enabled_time + start_delay
    end_time = start_time + duration
    
    event = {
        "case_id": case_id,
        "activity": activity,
        "resource": resource,
        "enabled_time": enabled_time, # Use datetime object directly
        "start_time": start_time,
        "end_time": end_time
    }
    # Add all case-level data to every event in that case
    event.update(case_attributes)
    return event, end_time


def generate_case(case_id):
    """Generates a case trace where the path is determined by data attributes."""
    events = []
    case_start_time = datetime.now() - timedelta(days=random.randint(5, 90))
    
    case_attributes = {
        'claim_amount': round(random.uniform(500, 25000), 2),
        'policy_type': random.choice(['Standard', 'Premium']),
        'fraud_score': round(random.random(), 2)
    }
    
    event, last_end_time = generate_event(case_id, 'Claim Submitted', random.choice(RESOURCES), case_start_time, case_attributes)
    events.append(event)
    
    if case_attributes['claim_amount'] <= FAST_TRACK_THRESHOLD:
        event, last_end_time = generate_event(case_id, 'Fast-Track Approval', 'AutoBot_Z', last_end_time, case_attributes)
        events.append(event)
        event, _ = generate_event(case_id, 'Close Claim', 'AutoBot_Z', last_end_time, case_attributes)
        events.append(event)
        return events

    event, last_end_time = generate_event(case_id, 'Assign to Adjuster', 'Manager_Y', last_end_time, case_attributes)
    events.append(event)

    and_enabled_time = last_end_time
    and_end_times = []
    for activity in ['Assess Damage', 'Verify Policy Coverage']:
        event, end_time = generate_event(case_id, activity, random.choice(RESOURCES[:2]), and_enabled_time, case_attributes)
        events.append(event)
        and_end_times.append(end_time)
    last_end_time = max(and_end_times)

    if case_attributes['fraud_score'] > FRAUD_SCORE_THRESHOLD:
        event, last_end_time = generate_event(case_id, 'Trigger Fraud Investigation', 'Investigator_X', last_end_time, case_attributes)
        events.append(event)

    is_approved = random.choices([True, False], weights=[0.2, 0.8] if case_attributes['fraud_score'] > FRAUD_SCORE_THRESHOLD else [0.8, 0.2], k=1)[0]
    
    if is_approved:
        event, last_end_time = generate_event(case_id, 'Approve Payment', 'Manager_Y', last_end_time, case_attributes)
        events.append(event)
        
        or_enabled_time = last_end_time
        or_end_times = []
        event, mandatory_end_time = generate_event(case_id, 'Send Payment', 'AutoBot_Z', or_enabled_time, case_attributes)
        events.append(event)
        or_end_times.append(mandatory_end_time)
        
        if case_attributes['policy_type'] == 'Premium':
            event, optional_end_time = generate_event(case_id, 'Schedule Follow-up Call', 'Adjuster_A', or_enabled_time, case_attributes)
            events.append(event)
            or_end_times.append(optional_end_time)
            
        last_end_time = max(or_end_times)
    else:
        event, last_end_time = generate_event(case_id, 'Deny Claim', 'Manager_Y', last_end_time, case_attributes)
        events.append(event)

    event, _ = generate_event(case_id, 'Close Claim', 'AutoBot_Z', last_end_time, case_attributes)
    events.append(event)

    return events


# --- Main Execution ---
print("Generating data-driven event log for Insurance Claim process...")
all_events = []
for i in range(NUM_CASES):
    all_events.extend(generate_case(i))

df = pd.DataFrame(all_events)
df = df.sort_values(by=['case_id', 'start_time']).reset_index(drop=True)
for col in ['enabled_time', 'start_time', 'end_time']:
    df[col] = df[col].dt.strftime('%Y-%m-%d %H:%M:%S')

# --- Verification ---
print("\n" + "="*70)
print("VERIFYING DATA-DRIVEN GATEWAY LOGIC (WITH COUNTS)")
print("="*70)

# Calculate sets needed for all verifications
fast_track_cases = set(df[df['activity'] == 'Fast-Track Approval']['case_id'])
low_value_cases = set(df[df['claim_amount'] <= FAST_TRACK_THRESHOLD]['case_id'])
complex_cases = set(df[df['activity'] == 'Assign to Adjuster']['case_id'])
high_value_cases = set(df[df['claim_amount'] > FAST_TRACK_THRESHOLD]['case_id'])
investigated_cases = set(df[df['activity'] == 'Trigger Fraud Investigation']['case_id'])
potential_fraud_cases = set(df[(df['fraud_score'] > FRAUD_SCORE_THRESHOLD) & (df['case_id'].isin(complex_cases))]['case_id'])
follow_up_call_cases = set(df[df['activity'] == 'Schedule Follow-up Call']['case_id'])
approved_cases = set(df[df['activity'] == 'Approve Payment']['case_id'])
approved_premium_cases = set(df[(df['case_id'].isin(approved_cases)) & (df['policy_type'] == 'Premium')]['case_id'])

# --- Detailed Logic Checks ---
print("--- Detailed Logic Validation ---")
print(f"XOR (Triage) Check: Do fast-track cases match low-value cases? {fast_track_cases == low_value_cases}")
print(f"XOR (Fraud) Check: Do investigated cases match high-fraud cases? {investigated_cases == potential_fraud_cases}")
print(f"OR (Premium Service) Check: Are follow-up calls a subset of approved premium cases? {follow_up_call_cases.issubset(approved_premium_cases)}\n")

# --- NEW: Gateway Encounter Summary ---
print("--- Gateway Encounter Summary ---")

# 1. Triage Gateway (XOR)
# Every case must pass through this initial decision point.
num_triage_gateway = NUM_CASES
print(f"1. Triage Gateway (XOR based on claim_amount):")
print(f"   - {num_triage_gateway} out of {NUM_CASES} cases encountered this gateway.")

# 2. Parallel Assessment Gateway (AND)
# Only complex claims encounter this gateway.
num_and_gateway = len(complex_cases)
print(f"\n2. Parallel Assessment Gateway (AND):")
print(f"   - {num_and_gateway} out of {NUM_CASES} cases encountered this gateway.")

# 3. Fraud Check Gateway (XOR)
# Only complex claims encounter this gateway.
num_fraud_gateway = len(complex_cases)
print(f"\n3. Fraud Check Gateway (XOR based on fraud_score):")
print(f"   - {num_fraud_gateway} out of {NUM_CASES} cases encountered this gateway.")

# 4. Post-Approval Service Gateway (OR)
# Only cases that are approved encounter this gateway.
num_or_gateway = len(approved_cases)
print(f"\n4. Post-Approval Service Gateway (OR based on policy_type):")
print(f"   - {num_or_gateway} out of {NUM_CASES} cases encountered this gateway.")

print("="*70)

# --- Save to file ---
output_filename = "event_log_with_multiple_gateways"
df.to_csv(f"{output_filename}.csv", index=False)
df.to_csv(f"{output_filename}.csv.gz", index=False, compression="gzip")

print(f"\nSuccessfully generated '{output_filename}.csv'")