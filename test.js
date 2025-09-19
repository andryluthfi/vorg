const { spawn } = require('child_process');
const path = require('path');

console.log('Testing Media Auto Renamer...');

// Test data
const testInputs = [
    'I:\\Drop\\Test', // scan path
    'C:\\Temp\\Movies', // movie path
    'C:\\Temp\\TV', // tv path
    'Current directory', // save location
    'n' // don't proceed (for preview test)
];

let inputIndex = 0;

const child = spawn('bun', ['src/index.ts'], {
    stdio: ['pipe', 'inherit', 'inherit'],
    cwd: process.cwd()
});

child.stdin.write(testInputs[inputIndex++] + '\n');

child.on('data', (data) => {
    console.log('Output:', data.toString());
});

child.on('close', (code) => {
    console.log(`Test completed with code ${code}`);
});

setTimeout(() => {
    child.kill();
}, 10000); // Kill after 10 seconds if still running