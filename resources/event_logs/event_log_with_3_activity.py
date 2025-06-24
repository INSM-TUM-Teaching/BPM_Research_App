import pandas as pd
from datetime import datetime, timedelta
import random

NUM_CASES = 50
ACTIVITIES = ["Receive Order", "Pack Order", "Ship Order"]
RESOURCES = ['Alice', 'Bob', 'System']
OUTPUT_FILENAME = "event_log_with_3_activity"

all_events = []
print(f"Generating a simple event log with {NUM_CASES} cases...")
print(f"Process Path for every case: {' -> '.join(ACTIVITIES)}")

for case_id in range(1, NUM_CASES + 1):
    
    last_event_end_time = datetime.now() - timedelta(days=random.randint(1, 30))

    for activity_name in ACTIVITIES:
        
        start_time = last_event_end_time + timedelta(minutes=random.randint(5, 60))
        
        end_time = start_time + timedelta(minutes=random.randint(10, 120))

        # Create the event dictionary
        event = {
            "case_id": f"Order-{case_id}",
            "activity": activity_name,
            "resource": random.choice(RESOURCES),
            "start_time": start_time.strftime('%Y-%m-%d %H:%M:%S'),
            "end_time": end_time.strftime('%Y-%m-%d %H:%M:%S')
        }
        all_events.append(event)
    
        last_event_end_time = end_time

df = pd.DataFrame(all_events)

# --- Simple Verification ---
print("\n" + "-"*30)
print("Verification: Number of Activities")
activity_counts = df['activity'].value_counts()
print(activity_counts)
print("-" * 30 + "\n")


# --- Save to CSV and GZIP ---
df.to_csv(f"{OUTPUT_FILENAME}.csv", index=False)
df.to_csv(f"{OUTPUT_FILENAME}.csv.gz", index=False, compression="gzip")

print(f"Successfully generated '{OUTPUT_FILENAME}.csv' and '.csv.gz'")