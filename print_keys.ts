
import { tr } from './dictionaries/tr.ts';
import { en } from './dictionaries/en.ts';

function printKeys(obj, prefix = '') {
  for (let key in obj) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (typeof obj[key] === 'object' && obj[key] !== null) {
      printKeys(obj[key], path);
    } else {
      console.log(path);
    }
  }
}

console.log('--- TR KEYS ---');
printKeys(tr);
console.log('--- EN KEYS ---');
printKeys(en);
