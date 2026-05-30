import { search } from './Scripts/core/vector_db.js';
search('o que decidimos sobre segurança?').then(res => console.log(JSON.stringify(res, null, 2))).catch(err => console.error(err));
