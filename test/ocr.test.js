global.LT=require('../www/js/games.js'); const O=require('../www/js/ocr.js'); const assert=require('assert'); let n=0;
const eq=(a,b,m)=>{assert.deepStrictEqual(a,b,m);n++;};
let r=O.parseTicket(`中国福利彩票\n双色球\n26124期  2026/10/29 开奖\n单式票\n① 04 05 20 21 26 30-12\n② 01 03 11 22 26 31-11\n倍数:1 合计:4元`);
eq([r.game,r.issue,r.mult,r.lines.length],['ssq','2026124',1,2]); eq(r.lines[0],{fd:[],f:[4,5,20,21,26,30],bd:[],b:[12]});
r=O.parseTicket(`超级大乐透\n第26124期 2026年10月31日开奖\n① 13 18 19 20 28 + 09 11\n② 01 02 03 04 05 + 06 07\n追加投注 倍:2 合计:12元`);
eq([r.game,r.issue,r.mult,r.add,r.lines.length],['dlt','2026124',2,true,2]); eq(r.lines[1],{fd:[],f:[1,2,3,4,5],bd:[],b:[6,7]});
r=O.parseTicket(`双色球 复式\n2026124期\n红球: 01 02 03 04 05 06 07\n蓝球: 08 09`);
eq(r.lines,[{fd:[],f:[1,2,3,4,5,6,7],bd:[],b:[8,9]}]); eq(LT.lineBets('ssq',r.lines[0]),14);
r=O.parseTicket(`双色球 胆拖\n第2026124期\n红胆: 01 02\n红拖: 03 04 05 06 07\n蓝球: 08`);
eq(r.lines,[{fd:[1,2],f:[3,4,5,6,7],bd:[],b:[8]}]); eq(LT.lineBets('ssq',r.lines[0]),5);
r=O.parseTicket(`双色球\n26124期\n① 0405202126 30-12`); eq(r.lines[0].f,[4,5,20,21,26,30]);
r=O.parseTicket(`快乐8 选五\n第2026288期\n① 01 05 18 33 77\n② 02 09 40 51 66`); eq([r.game,r.issue,r.lines.length,r.lines[0].k],['kl8','2026288',2,5]);
r=O.parseTicket(`福彩3D 直选\n第2026288期\n① 1 5 4\n② 3 3 7`); eq(r.lines,[{play:'zx',pos:[[1],[5],[4]]},{play:'zx',pos:[[3],[3],[7]]}]);
r=O.parseTicket(`福彩3D 组选6\n2026288期\n① 1 4 5`); eq(r.lines,[{play:'z6',f:[1,4,5]}]);
r=O.parseTicket(`福彩3D 组三\n2026288期\n① 3 3 7`); eq(r.lines,[{play:'z3',d:[3,3,7]}]);
r=O.parseTicket(`体育彩票 排列3 直选\n26288期\n① 154`); eq([r.game,r.issue,r.lines],['pl3','2026288',[{play:'zx',pos:[[1],[5],[4]]}]]);
r=O.parseTicket(`排列5\n第26288期\n① 1 2 3 4 5`); eq(r.lines,[{play:'zx',pos:[[1],[2],[3],[4],[5]]}]);
r=O.parseTicket(`7星彩\n26124期\n① 1 2 3 4 5 6 + 14\n② 9 8 7 6 5 4 + 03`); eq([r.game,r.lines.length],['qxc',2]); eq(r.lines[0],{pos:[[1],[2],[3],[4],[5],[6]],b:[14]}); eq(r.lines[1].b,[3]);
r=O.parseTicket(`七乐彩\n第2026124期\n① 01 05 08 12 18 22 30`); eq(r.lines,[{fd:[],f:[1,5,8,12,18,22,30]}]);
r=O.parseTicket(`随便一张纸`); eq(r.ok,false);
// 大乐透 logo 没认出来、"+"认成"十"
r=O.parseTicket(`中国体育彩票\n第26124期 2026/10/31开奖\n单式票 倍数:3 合计:6元\n① 06 13 22 27 31 十 05 08`);
eq([r.ok,r.game,r.issue,r.mult],[true,'dlt','2026124',3]); eq(r.lines,[{fd:[],f:[6,13,22,27,31],bd:[],b:[5,8]}]);
// 连体彩字样也没有，只靠号码：前区、后区各自从小到大，只有大乐透说得通
r=O.parseTicket(`第26124期\n倍数:3 合计:6元\n① 06 13 22 27 31 05 08`);
eq([r.game,r.how],['dlt','guess']); eq(r.lines[0].b,[5,8]);
// 双色球同理
r=O.parseTicket(`中国福利彩票\n2026125期\n① 04 05 20 21 26 30 12`); eq([r.game,r.how],['ssq','hint']); eq(r.lines[0].b,[12]);
r=O.parseTicket(`2026125期\n① 04 05 20 21 26 30 + 12`); eq(r.game,'ssq');
// 艺术字只认出半截
r=O.parseTicket(`超级大乐通\n第26124期\n① 06 13 22 27 31 + 05 08`); eq([r.game,r.how],['dlt','name']);
// 用户点了彩种：按点的彩种读
r=O.parseTicket(`第26124期\n① 06 13 22 27 31 05 08`, 'ssq'); eq([r.game,r.how,r.lines[0].b],['ssq','user',[8]]);
// 只有 3 位数字又没有体彩/福彩字样：分不出 3D 和排列3，让用户选
r=O.parseTicket(`26288期\n① 1 5 4`); eq([r.ok,r.needGame],[false,true]);
r=O.parseTicket(`中国体育彩票\n26288期\n① 1 5 4`); eq(r.game,'pl3');
// "选十"里的"十"不能被当成加号
r=O.parseTicket(`快乐8 选十\n第2026288期\n① 01 05 18 33 77 02 09 40 51 66`); eq([r.game,r.lines[0].k,r.lines[0].f.length],['kl8',10,10]);
// 用户的真实双色球票（2026-10-29）
const SSQ_REAL=`中国福利彩票\nCHINA WELFARE LOTTERY\n6E6F-7E56-9EE9-026F-DC0E-AB0E-000B\n站 号:33185220 流水号:100060 倍数:5\n销售期:2026124 开奖期:2026124\n金 额:10.00元 销售时间:2026/10/29-17:50:29\n① 03 08 15 22 24 28+13\n②\n③\n④\n⑤\n开奖日期:2026/10/29 玩法:双色球 单式\n验票码:3A441C44-C741B0B5-21EB2C6F-F2F7D2AA\n感谢您为公益事业贡献3.60元\n浙江省福利彩票发行中心承销`;
r=O.parseTicket(SSQ_REAL);
eq([r.ok,r.game,r.how,r.issue,r.mult,r.drawDate,r.amount,r.lines.length],[true,'ssq','name','2026124',5,'2026-10-29',10,1]);
eq(r.lines[0],{fd:[],f:[3,8,15,22,24,28],bd:[],b:[13]}); eq(LT.ticketCost({game:'ssq',lines:r.lines,mult:r.mult}),10);
// 同一张票：①认成"1"、分栏被拆成单独的行、"+"认成"十"
r=O.parseTicket(`中国福利彩票\n站 号:33185220\n流水号:100060\n倍数:5\n销售期:2026124\n开奖期:2026124\n金 额:10.00元\n销售时间:2026/10/29-17:50:29\n1 03 08 15 22 24 28十13\n开奖日期:2026/10/29\n玩法:双色球 单式`);
eq([r.game,r.issue,r.mult,r.drawDate,r.lines],['ssq','2026124',5,'2026-10-29',[{fd:[],f:[3,8,15,22,24,28],bd:[],b:[13]}]]);
// 玩法那一行没认出来，也能靠"福利彩票"和号码判断
r=O.parseTicket(`中国福利彩票\n开奖期:2026124\n① 03 08 15 22 24 28+13\n开奖日期:2026/10/29`); eq([r.game,r.how],['ssq','hint']);
console.log('ocr tests passed:',n);
