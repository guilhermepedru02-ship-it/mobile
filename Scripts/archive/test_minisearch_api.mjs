// Testar MiniSearch v7 API
import MiniSearch from 'minisearch';
console.log('Static methods:', Object.getOwnPropertyNames(MiniSearch).filter(k => !k.startsWith('_')));
console.log('loadJSON:', typeof MiniSearch.loadJSON);
console.log('loadJSONAsync:', typeof MiniSearch.loadJSONAsync);
// Testar instancia
const ms = new MiniSearch({ fields: ['text'], storeFields: ['file', 'text'] });
console.log('Instance methods:', Object.getOwnPropertyNames(Object.getPrototypeOf(ms)).filter(k => !k.startsWith('_')));
