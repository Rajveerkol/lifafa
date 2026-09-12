import fs from 'node:fs';
import readline from 'node:readline';

const stream = fs.createReadStream('C:\\Users\\HP\\.gemini\\antigravity\\brain\\e68cc24f-7ae8-47a7-bd5c-35f97585bb4a\\.system_generated\\logs\\transcript_full.jsonl');
const rl = readline.createInterface({ input: stream });

rl.on('line', (line) => {
  if (line.includes('Player A (User ID:') && line.includes('WINNER:')) {
    const obj = JSON.parse(line);
    console.log(obj.content);
  }
});
