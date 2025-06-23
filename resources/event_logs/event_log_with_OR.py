import pandas as pd
from datetime import datetime, timedelta
import random

NUM_CASES = 100
RESOURCES = ['Editor_A', 'Legal_B', 'Bot_C', 'Manager_D']
OUTPUT_FILENAME = "event_log_with_OR"

START_ACTIVITY = "Review Document"
OR_CHOICES = ["Check for Plagiarism", "Verify Sources", "Consult Legal Team"]
END_ACTIVITY = "Finalize Document"

def generate_case(case_id):
    """Generates a single case trace with an OR gateway."""
    events = []
    last_end_time = datetime.now() - timedelta(days=random.randint(1, 30))

    # 1. Generate the common START activity
    start_time = last_end_time + timedelta(minutes=random.randint(1, 10))
    end_time = start_time + timedelta(minutes=random.randint(10, 60))
    events.append({
        "case_id": case_id, "activity": START_ACTIVITY, "resource": random.choice(RESOURCES),
        "start_time": start_time.strftime('%Y-%m-%d %H:%M:%S'),
        "end_time": end_time.strftime('%Y-%m-%d %H:%M:%S')
    })
    last_end_time = end_time

    # 2. OR Gateway (Split): Choose 1 or more activities from the list
    num_to_choose = random.randint(1, len(OR_CHOICES)) # The core of the OR logic
    chosen_activities = random.sample(OR_CHOICES, k=num_to_choose)
    
    or_enabled_time = last_end_time
    or_end_times = []
    
    for activity in chosen_activities:
        start_time = or_enabled_time + timedelta(seconds=random.randint(5, 60))
        end_time = start_time + timedelta(minutes=random.randint(15, 75))
        events.append({
            "case_id": case_id, "activity": activity, "resource": random.choice(RESOURCES),
            "start_time": start_time.strftime('%Y-%m-%d %H:%M:%S'),
            "end_time": end_time.strftime('%Y-%m-%d %H:%M:%S')
        })
        or_end_times.append(end_time)

    # 3. OR Gateway (Join): Wait for all CHOSEN activities to finish
    last_end_time = max(or_end_times)

    # 4. Generate the common END activity
    start_time = last_end_time + timedelta(minutes=random.randint(1, 10))
    end_time = start_time + timedelta(minutes=random.randint(5, 20))
    events.append({
        "case_id": case_id, "activity": END_ACTIVITY, "resource": random.choice(RESOURCES),
        "start_time": start_time.strftime('%Y-%m-%d %H:%M:%S'),
        "end_time": end_time.strftime('%Y-%m-%d %H:%M:%S')
    })
    
    return events

all_events = []
print(f"Generating event log with {NUM_CASES} cases, each with an OR gateway.")
for i in range(1, NUM_CASES + 1):
    all_events.extend(generate_case(f"Case-{i}"))

df = pd.DataFrame(all_events)
df['start_time'] = pd.to_datetime(df['start_time'])
df = df.sort_values(by=['case_id', 'start_time']).reset_index(drop=True)
df['start_time'] = df['start_time'].dt.strftime('%Y-%m-%d %H:%M:%S')


# --- Verification ---
print("\n" + "="*50)
print("VERIFICATION")
print("="*50)

# 1. Count OR Gateways
# An OR gateway is any case that has at least one of the choice activities.
cases_with_or_choice = df[df['activity'].isin(OR_CHOICES)]['case_id'].nunique()
print(f"Number of OR Gateways Encountered: {cases_with_or_choice}")
print(f"Analysis: {cases_with_or_choice} out of {NUM_CASES} cases contain at least one optional activity.")
print("-" * 50)

# 2. Check for other gateway types by analyzing the choices made
print("Analyzing the nature of the choices to confirm OR behavior...")
# Check for pure AND behavior (all choices taken every time)
cases_with_all_choices = df.groupby('case_id')['activity'].apply(lambda acts: set(OR_CHOICES).issubset(set(acts))).sum()
print(f"  - Cases with pure AND behavior (all 3 choices): {cases_with_all_choices}")
# Check for pure XOR behavior (exactly one choice taken every time)
choice_counts_per_case = df[df['activity'].isin(OR_CHOICES)].groupby('case_id')['activity'].count()
cases_with_one_choice = (choice_counts_per_case == 1).sum()
print(f"  - Cases with pure XOR behavior (exactly 1 choice): {cases_with_one_choice}")

print("\n--- Summary ---")
# The verification passes if not all cases are pure AND and not all cases are pure XOR.
if cases_with_or_choice == NUM_CASES and cases_with_all_choices < NUM_CASES and cases_with_one_choice < NUM_CASES:
    print("Verification PASSED: The log correctly exhibits OR gateway patterns.")
else:
    print("Verification FAILED: The log does not show true OR behavior.")
print("="*50 + "\n")

# --- Save to file ---
df.to_csv(f"{OUTPUT_FILENAME}.csv", index=False)
df.to_csv(f"{OUTPUT_FILENAME}.csv.gz", index=False, compression="gzip")
print(f"Successfully generated '{OUTPUT_FILENAME}.csv'")