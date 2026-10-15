with open('backend/main.py', 'r', encoding='utf-8') as f:
    text = f.read()

keywords = ['repository', 'repositories', 'rerun', 'integrations', 'alert', 'jira', 'finding', 'remediation', 'milestone', 'schedule']
for kw in keywords:
    print(f'Count of "{kw}" in backend/main.py: {text.count(kw)}')

import re
routes = re.findall(r'@app\.(?:get|post|put|delete|patch)\([\'"]([^\'"]+)[\'"]', text)
print("\nAPI Routes in backend/main.py:")
for r in routes:
    print(" ", r)
