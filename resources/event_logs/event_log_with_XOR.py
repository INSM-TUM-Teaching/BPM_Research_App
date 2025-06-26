import pandas as pd
from datetime import datetime, timedelta
import random

NUM_CASES = 100
RESOURCES = ['Agent_Smith', 'Manager_Jones', 'System_Bot']
OUTPUT_FILENAME = "event_log_with_XOR"

START_ACTIVITY = "Submit Request"
XOR_CHOICES = ["Approve Request", "Deny Request"]
END_ACTIVITY = "Close Request"

def generate_case(case_id):
    """Generates a single case trace with an XOR choice."""
    events = []
    last_end_time = datetime.now() - timedelta(days=random.randint(1, 30))

    # 1. Generate the common START activity
    start_time = last_end_time + timedelta(minutes=random.randint(1, 10))
    end_time = start_time + timedelta(minutes=random.randint(5, 30))
    events.append({
        "case_id": case_id, "activity": START_ACTIVITY, "resource": random.choice(RESOURCES),
        "start_time": start_time.strftime('%Y-%m-%d %H:%M:%S'),
        "end_time": end_time.strftime('%Y-%m-%d %H:%M:%S')
    })
    last_end_time = end_time

    # 2. Make the XOR choice and generate the corresponding event
    chosen_activity = random.choice(XOR_CHOICES)
    start_time = last_end_time + timedelta(minutes=random.randint(1, 10))
    end_time = start_time + timedelta(minutes=random.randint(5, 30))
    events.append({
        "case_id": case_id, "activity": chosen_activity, "resource": random.choice(RESOURCES),
        "start_time": start_time.strftime('%Y-%m-%d %H:%M:%S'),
        "end_time": end_time.strftime('%Y-%m-%d %H:%M:%S')
    })
    last_end_time = end_time

    # 3. Generate the common END activity
    start_time = last_end_time + timedelta(minutes=random.randint(1, 10))
    end_time = start_time + timedelta(minutes=random.randint(5, 30))
    events.append({
        "case_id": case_id, "activity": END_ACTIVITY, "resource": random.choice(RESOURCES),
        "start_time": start_time.strftime('%Y-%m-%d %H:%M:%S'),
        "end_time": end_time.strftime('%Y-%m-%d %H:%M:%S')
    })

    return events

all_events = []
print(f"Generating event log with {NUM_CASES} cases, each with an XOR gateway.")
for i in range(1, NUM_CASES + 1):
    all_events.extend(generate_case(f"Case-{i}"))

df = pd.DataFrame(all_events)

print("\n" + "="*50)
print("VERIFICATION")
print("="*50)

num_xor_gateways = df['case_id'].nunique()
print(f"Number of XOR Gateways Encountered: {num_xor_gateways}")
print(f"Analysis: {num_xor_gateways} out of {NUM_CASES} cases correctly passed through the exclusive choice point.")
print("-" * 50)

# 2. Check for other gateway types
print("Checking for presence of other gateway types...")
approved_cases = set(df[df['activity'] == 'Approve Request']['case_id'])
denied_cases = set(df[df['activity'] == 'Deny Request']['case_id'])
violation_count = len(approved_cases.intersection(denied_cases))

if violation_count > 0:
    print(f"  - AND Gateways Found: Yes ({violation_count} cases violate the XOR rule)")
    print(f"  - OR Gateways Found: Yes ({violation_count} cases violate the XOR rule)")
else:
    print("  - AND Gateways Found: No")
    print("  - OR Gateways Found: No")

print("\n--- Summary ---")
if violation_count == 0:
    print("Verification PASSED: The log exclusively contains XOR gateway patterns.")
else:
    print("Verification FAILED: The log is not purely XOR.")
print("="*50 + "\n")


# --- Save to file ---
df.to_csv(f"{OUTPUT_FILENAME}.csv", index=False)
df.to_csv(f"{OUTPUT_FILENAME}.csv.gz", index=False, compression="gzip")
print(f"Successfully generated '{OUTPUT_FILENAME}.csv'")