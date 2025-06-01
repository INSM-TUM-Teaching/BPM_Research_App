import matplotlib.pyplot as plt
import matplotlib.dates as mdates
from datetime import datetime, timedelta

# Define tasks and their durations
tasks = [
    {"Task": "Get familiar with Simod", "Start": "2025-05-05", "Duration": 10},
    {"Task": "Understand possible human interaction areas", "Start": "2025-05-15", "Duration": 5},
    {"Task": "Track BPMN from Control Flow Discovery", "Start": "2025-05-20", "Duration": 4},
    {"Task": "Visualize the BPMN of process discovery", "Start": "2025-05-24", "Duration": 7},
    {"Task": "Prepare Intermediate Presentation", "Start": "2025-06-01", "Duration": 2},
    {"Task": "Identify BPMN model selection point", "Start": "2025-06-03", "Duration": 3},
    {"Task": "Implement expert-selected BPMN version override", "Start": "2025-06-06", "Duration": 4},
    {"Task": "Create GUI for Control Flow Discovery", "Start": "2025-06-10", "Duration": 14},
    {"Task": "Create GUI for Event Log interaction", "Start": "2025-06-24", "Duration": 14},
    {"Task": "Testing & Final Enhancements", "Start": "2025-07-08", "Duration": 14}
]

# Convert string dates to datetime objects
for task in tasks:
    task["Start"] = datetime.strptime(task["Start"], "%Y-%m-%d")
    task["End"] = task["Start"] + timedelta(days=task["Duration"])

# Custom RGB color
custom_color = (56/255, 116/255, 180/255)

# Create the plot
fig, ax = plt.subplots(figsize=(12, 6))

# Plot tasks
for task in tasks:
    ax.barh(task["Task"], task["Duration"], left=task["Start"], color=custom_color)

# Format date axis
ax.xaxis.set_major_locator(mdates.WeekdayLocator(interval=7))
ax.xaxis.set_major_formatter(mdates.DateFormatter("%b %d"))
plt.xticks(rotation=45)

# Set the date range
ax.set_xlim(datetime.strptime("2025-05-05", "%Y-%m-%d"), datetime.strptime("2025-07-20", "%Y-%m-%d"))

# Bold only title and axis labels
ax.set_title("Extend SIMOD with human input ", fontsize=14, fontweight='bold')
ax.set_xlabel("Date", fontsize=14, fontweight='bold')
ax.set_ylabel("Tasks", fontsize=14, fontweight='bold')

# Add vertical line for June 3, 2025 - Presentation Date (light grey)
presentation_date = datetime.strptime("2025-06-03", "%Y-%m-%d")
ax.axvline(presentation_date, color="#0656DFAA", linestyle='--', linewidth=2)
ax.text(presentation_date, -0.12, "", color="#0656DFAA", fontsize=10, fontweight='bold', ha='center')

# Layout and grid
plt.tight_layout()
plt.grid(axis='x')

# Show plot
plt.show()
