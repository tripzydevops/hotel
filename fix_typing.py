import os

API_DIR = 'backend/api'

for root, _, files in os.walk(API_DIR):
    for file in files:
        if file.endswith('.py'):
            filepath = os.path.join(root, file)
            with open(filepath, 'r', encoding='utf-8') as f:
                content = f.read()

            if ('Dict[' in content or 'List[' in content or 'Any' in content) and 'from typing import' not in content:
                content = 'from typing import Dict, List, Any, Optional\n' + content
                with open(filepath, 'w', encoding='utf-8') as f:
                    f.write(content)
                print('Fixed missing typing in', filepath)
            elif 'from typing import' in content:
                # Replace existing typing import
                lines = content.split('\n')
                for i, line in enumerate(lines):
                    if line.startswith('from typing import'):
                        # Ensure Dict, List, Any are in it
                        imports = line.replace('from typing import ', '').split(',')
                        imports = [x.strip() for x in imports]
                        for req in ['Dict', 'List', 'Any', 'Optional']:
                            if req not in imports:
                                imports.append(req)
                        lines[i] = 'from typing import ' + ', '.join(imports)
                        break
                new_content = '\n'.join(lines)
                if new_content != content:
                    with open(filepath, 'w', encoding='utf-8') as f:
                        f.write(new_content)
                    print('Updated typing in', filepath)
