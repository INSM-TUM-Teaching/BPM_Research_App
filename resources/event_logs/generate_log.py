import pandas as pd
from datetime import datetime, timedelta
import random

# Configuration
num_cases = 100
common_activity = "Submit Application"
other_activities = [
    "Verify Documents", "Check Credit Score",
    "Approve Application", "Reject Application",
    "Disburse Loan", "Notify Applicant"
]
resources = ['Agent_A', 'Officer_B', 'Bot_X', 'Manager_Y']

def generate_case(case_id):
    start_time = datetime.now() - timedelta(days=random.randint(1, 30))
    events = []

    # 1. Common activity first
    enabled = start_time
    start = enabled + timedelta(seconds=5)
    end = start + timedelta(seconds=random.randint(10, 60))
    events.append({
        "case_id": case_id,
        "activity": common_activity,
        "resource": random.choice(resources),
        "enabled_time": enabled.strftime('%Y-%m-%d %H:%M:%S'),
        "start_time": start.strftime('%Y-%m-%d %H:%M:%S'),
        "end_time": end.strftime('%Y-%m-%d %H:%M:%S')
    })

    # 2. Sample other activities (1 to 4 random ones)
    sampled_activities = random.sample(other_activities, k=random.randint(1, 4))
    for act in sampled_activities:
        enabled = end + timedelta(minutes=1)
        start = enabled + timedelta(seconds=5)
        end = start + timedelta(seconds=random.randint(10, 60))
        events.append({
            "case_id": case_id,
            "activity": act,
            "resource": random.choice(resources),
            "enabled_time": enabled.strftime('%Y-%m-%d %H:%M:%S'),
            "start_time": start.strftime('%Y-%m-%d %H:%M:%S'),
            "end_time": end.strftime('%Y-%m-%d %H:%M:%S')
        })

    return events

# Generate all cases
event_log = []
for cid in range(num_cases):
    event_log.extend(generate_case(cid))

# Save to CSV and GZIP
df = pd.DataFrame(event_log)
df.to_csv("event_log_with_common_activity.csv", index=False)
df.to_csv("event_log_with_common_activity.csv.gz", index=False, compression="gzip")

print("✅ event_log_with_common_activity.csv and .csv.gz generated.")
