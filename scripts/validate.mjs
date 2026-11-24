import { lstatSync, readFileSync } from 'node:fs';
import { parseStats } from './stats-validation.mjs';

const stats = new URL('../stats.json', import.meta.url);
if (!lstatSync(stats).isFile()) throw new Error('Expected a regular stats.json file');
let data;
try {
  data = JSON.parse(readFileSync(stats, 'utf8'));
} catch {
  throw new Error('Invalid stats.json: expected JSON');
}
parseStats(data);
console.log('Validated stats.json');
