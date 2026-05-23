import re
import os

FILES_TO_FIX = [
    'components/analytics/SentimentRadar.tsx',
    'components/features/analysis/AnalysisFilters.tsx',
    'components/ui/sentiment/sentimentUIHelpers.tsx',
    'components/ui/FallbackImage.tsx'
]

for filepath in FILES_TO_FIX:
    if not os.path.exists(filepath):
        continue
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
        
    if 'FallbackImage.tsx' in filepath:
        # FallbackImage.tsx doesn't actually use the Hotel interface, it uses the Hotel icon from lucide-react.
        # My script injected `import { Hotel } from '../../lib/types';` which conflicted.
        # Let's just remove my injected import.
        content = re.sub(r"import \{ Hotel \} from '\.\./\.\./lib/types';\n", "", content)
    else:
        # Fix the broken multiline imports
        # For example:
        # import {
        # import { Hotel } from '../../lib/types';
        #   Radar,
        
        # 1. Extract the injected line (it looks like `import { ... } from '...lib/types';`)
        match = re.search(r"import \{.*?\} from '.*?lib/types';\n", content)
        if match:
            injected_line = match.group(0)
            content = content.replace(injected_line, '')
            
            # 2. Inject it safely at the very top, after the first import or just at the top
            content = injected_line + content

    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)
    print('Fixed', filepath)
