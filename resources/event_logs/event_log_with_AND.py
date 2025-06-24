import pandas as pd
from datetime import datetime, timedelta
import random

NUM_CASES = 100
RESOURCES = ['Clerk_A', 'FinanceBot', 'Warehouse_Bot', 'System']
OUTPUT_FILENAME = "event_log_with_AND"

START_ACTIVITY = "Receive Order"
PARALLEL_ACTIVITIES = ["Check Inventory", "Verify Payment"]
END_ACTIVITY = "Ship Order"

def generate_case(case_id):
    """Generates a single case trace with an AND gateway."""
    events = []
    last_end_time = datetime.now() - timedelta(days=random.randint(1, 30))

    # 1. Generate the common START activity
    start_time = last_end_time + timedelta(minutes=random.randint(1, 10))
    end_time = start_time + timedelta(minutes=random.randint(5, 20))
    events.append({
        "case_id": case_id, "activity": START_ACTIVITY, "resource": random.choice(RESOURCES),
        "start_time": start_time.strftime('%Y-%m-%d %H:%M:%S'),
        "end_time": end_time.strftime('%Y-%m-%d %H:%M:%S')
    })
    last_end_time = end_time
    
    # 2. AND Gateway (Split): Generate events for ALL parallel activities
    parallel_enabled_time = last_end_time
    parallel_end_times = []

    for activity in PARALLEL_ACTIVITIES:
        start_time = parallel_enabled_time + timedelta(seconds=random.randint(5, 60))
        end_time = start_time + timedelta(minutes=random.randint(10, 45))
        events.append({
            "case_id": case_id, "activity": activity, "resource": random.choice(RESOURCES),
            "start_time": start_time.strftime('%Y-%m-%d %H:%M:%S'),
            "end_time": end_time.strftime('%Y-%m-%d %H:%M:%S')
        })
        parallel_end_times.append(end_time)

    # 3. AND Gateway (Join): The next step starts only after the LAST parallel activity is finished.
    last_end_time = max(parallel_end_times)

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
print(f"Generating event log with {NUM_CASES} cases, each with an AND gateway.")
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

# Count cases that have BOTH parallel activities.
cases_with_both = df.groupby('case_id')['activity'].apply(lambda acts: set(PARALLEL_ACTIVITIES).issubset(set(acts)))
num_and_gateways = cases_with_both.sum()

print(f"Number of AND Gateways Encountered: {num_and_gateways}")
print(f"Analysis: {num_and_gateways} out of {NUM_CASES} cases correctly contain all parallel activities.")
print("-" * 50)

# Check for XOR behavior (as a contrast)
print("Checking for XOR behavior (i.e., cases with only ONE parallel activity)...")
cases_with_only_one = len(df[df['activity'].isin(PARALLEL_ACTIVITIES)].groupby('case_id').filter(lambda x: len(x) == 1))
if cases_with_only_one > 0:
    print(f"  - Found {cases_with_only_one} cases that followed an XOR-like path (violates AND logic).")
else:
    print("  - No cases with XOR-like behavior found.")


print("\n--- Summary ---")
if num_and_gateways == NUM_CASES and cases_with_only_one == 0:
    print("Verification PASSED: The log exclusively contains AND gateway patterns.")
else:
    print("Verification FAILED: The log is not a pure AND gateway process.")
print("="*50 + "\n")


# --- Save to file ---
df.to_csv(f"{OUTPUT_FILENAME}.csv", index=False)
df.to_csv(f"{OUTPUT_FILENAME}.csv.gz", index=False, compression="gzip")
print(f"Successfully generated '{OUTPUT_FILENAME}.csv'")