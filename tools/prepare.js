// 构建前准备：复制 Capacitor 核心脚本，拼出后台对奖脚本 www/runner.js
const fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..');
fs.copyFileSync(path.join(root, 'node_modules/@capacitor/core/dist/capacitor.js'), path.join(root, 'www/capacitor.js'));
const parts = ['www/js/games.js', 'www/js/parse.js', 'runner/runner-src.js'].map(f => fs.readFileSync(path.join(root, f), 'utf8'));
fs.writeFileSync(path.join(root, 'www/runner.js'), '/* 自动生成：tools/prepare.js，请改 runner/runner-src.js */\n' + parts.join('\n;\n'));
fs.writeFileSync(path.join(root, 'www/version.js'), "window.APP_VERSION = '1.0." + (process.env.GITHUB_RUN_NUMBER || 'dev') + "';\n");
console.log('prepared www/capacitor.js and www/runner.js');
