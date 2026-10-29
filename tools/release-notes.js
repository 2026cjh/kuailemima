// 生成 GitHub 发布页的说明：模板在 .github/release-notes.md，本次更新取自这次提交的说明
const fs = require('fs'), path = require('path'), { execSync } = require('child_process');
const ver = process.env.VER || '';
let changes = (process.env.CHANGES || '').trim();
if (!changes) { try { changes = execSync('git log -1 --format=%B').toString().trim(); } catch (e) { changes = ''; } }
// 提交说明里的分号、句号分成一条一条
const items = changes.split(/\n+|；|;/).map(s => s.replace(/^[-*\s]+/, '').trim()).filter(Boolean);
const list = items.length ? items.map(s => '- ' + s).join('\n') : '- 小改进和修复';
const tpl = fs.readFileSync(path.join(__dirname, '..', '.github', 'release-notes.md'), 'utf8');
process.stdout.write(tpl.split('{{VERSION}}').join(ver).replace('{{CHANGES}}', list));
