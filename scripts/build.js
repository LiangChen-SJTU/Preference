const fs = require('fs');
const path = require('path');

const publicDir = path.join(__dirname, '..', 'public');
const distDir = path.join(__dirname, '..', 'dist');

fs.rmSync(distDir, { recursive: true, force: true });
fs.cpSync(publicDir, distDir, { recursive: true });

console.log('构建完成：public/ → dist/');
