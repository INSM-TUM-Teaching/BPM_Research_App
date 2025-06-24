import pandas as pd
from datetime import datetime, timedelta
import random

num_cases = 100
rare_activity = "Special High-Value Review"
num_cases_with_rare_activity = 3

# All other possible activities
other_activities = [
    "Submit Application", "Verify Documents", "Check Credit Score",
    "Approve Application", "Reject Application", "Disburse Loan", "Notify Applicant"
]
resources = ['Agent_A', 'Officer_B', 'Bot_X', 'Manager_Y']
total_activities_per_case = 5


case_ids_with_rare_activity = set(random.sample(range(num_cases), k=num_cases_with_rare_activity))

print(f"The following {num_cases_with_rare_activity} cases will have the rare activity '{rare_activity}': {sorted(list(case_ids_with_rare_activity))}\n")


def generate_case(case_id):
    """Generates events for a single case, ensuring exactly 5 activities."""
    start_time = datetime.now() - timedelta(days=random.randint(1, 30))
    events = []

    activities_for_this_case = []
    if case_id in case_ids_with_rare_activity:
        activities_for_this_case.append(rare_activity)
        activities_for_this_case.extend(random.sample(other_activities, k=total_activities_per_case - 1))
    else:
        activities_for_this_case = random.sample(other_activities, k=total_activities_per_case)
    random.shuffle(activities_for_this_case)

    current_time = start_time
    for act in activities_for_this_case:
        enabled = current_time + timedelta(minutes=random.randint(1, 10))
        start = enabled + timedelta(seconds=random.randint(1, 15))
        end = start + timedelta(seconds=random.randint(20, 120))
        
        events.append({
            "case_id": case_id,
            "activity": act,
            "resource": random.choice(resources),
            "enabled_time": enabled.strftime('%Y-%m-%d %H:%M:%S'),
            "start_time": start.strftime('%Y-%m-%d %H:%M:%S'),
            "end_time": end.strftime('%Y-%m-%d %H:%M:%S')
        })

        current_time = end

    return events

event_log = []
for cid in range(num_cases):
    event_log.extend(generate_case(cid))

df = pd.DataFrame(event_log)

# --- Verification Step ---
cases_with_rare_act = df[df['activity'] == rare_activity]['case_id'].unique()
print(f"\nVerification:")
print(f"The activity '{rare_activity}' appears in {len(cases_with_rare_act)} cases.")
print(f"Case IDs containing the rare activity: {sorted(list(cases_with_rare_act))}")
print("-" * 40)


# Save to CSV and GZIP
output_filename = "event_log_with_rare_activity"
df.to_csv(f"{output_filename}.csv", index=False)
df.to_csv(f"{output_filename}.csv.gz", index=False, compression="gzip")
print(f"{output_filename}.csv and .csv.gz generated.")