import re
import json

with open('src/screens/AIRemediation.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Find REMEDIATION_DATABASE
start_idx = content.find('export const REMEDIATION_DATABASE')
end_idx = content.find('export function parseResourceInfo', start_idx)

db_str = content[start_idx:end_idx]
check_ids = re.findall(r"'([A-Z0-9_\-]+)':\s*\{", db_str)
print("Found check IDs:", check_ids)
