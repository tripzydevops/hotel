
const fs = require('fs');

function extract_dict_keys_ts(filepath) {
    const content = fs.readFileSync(filepath, 'utf-8');
    const keys = new Set();
    const path_stack = [];

    const cleanContent = content.replace(/^export\s+(?:const|default)\s+\w+\s*=\s*/m, '');

    for (const line of cleanContent.split('\n')) {
        const stripped = line.trim();
        if (!stripped || stripped.startsWith('//') || stripped.startsWith('/*')) continue;

        const openMatch = stripped.match(/^(\w+)\s*:\s*\{/);
        if (openMatch) {
            path_stack.push(openMatch[1]);
            continue;
        }

        const leafMatch = stripped.match(/^(\w+)\s*:/);
        if (leafMatch && !stripped.endsWith('{')) {
            const keyName = leafMatch[1];
            keys.add([...path_stack, keyName].join('.'));
            continue;
        }

        if (stripped.startsWith('}')) {
            path_stack.pop();
            continue;
        }
    }
    return keys;
}

const enKeys = extract_dict_keys_ts('dictionaries/en.ts');
const trKeys = extract_dict_keys_ts('dictionaries/tr.ts');

console.log('--- EN KEYS (Simulated) ---');
enKeys.forEach(k => { if (k.startsWith('landing')) console.log(k); });
console.log('--- TR KEYS (Simulated) ---');
trKeys.forEach(k => { if (k.startsWith('landing')) console.log(k); });
