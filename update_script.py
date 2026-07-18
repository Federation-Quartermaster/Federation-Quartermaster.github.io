import sys
import json
import os

# Get the body of the issue passed from the workflow
issue_body = sys.argv[1] 
db_path = 'MedalDatabase/datastore.json'

try:
    # Assuming your issue body is just the raw JSON string
    new_data = json.loads(issue_body.strip())
    uid = new_data['uid']
    aid = new_data['aid']

    with open(db_path, 'r+') as f:
        data = json.load(f)
        data[uid] = aid
        f.seek(0)
        json.dump(data, f, indent=4)
        
except Exception as e:
    print(f"Error updating JSON: {e}")
    sys.exit(1)
