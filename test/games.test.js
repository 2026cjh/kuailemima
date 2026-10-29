const LT=require('../www/js/games.js'); const assert=require('assert');
let pass=0; const ok=(c,m)=>{assert.ok(c,m);pass++;}; const eq=(a,b,m)=>{assert.deepStrictEqual(a,b,m);pass++;};
// ---- 双色球
const d1={code:'2026052',n:[1,3,11,22,26,31],s:[11]};
let r=LT.checkTicket({game:'ssq',lines:[{f:[1,3,11,22,26,31],b:[11]},{f:[1,3,11,22,26,30],b:[11]},{f:[1,3,11,2,4,5],b:[1]},{f:[1,3,11,22,4,5],b:[11]}],mult:2},d1,{special:true});
eq(r.tally,{'一等奖':1,'三等奖':1,'福运奖':1,'四等奖':1}); eq(r.fixed,(3000+5+200)*2); eq(r.floating,['一等奖']);
// 复式 7+2 : 一等1 二等1 三等6 四等6
r=LT.checkTicket({game:'ssq',lines:[{f:[1,3,11,22,26,31,33],b:[11,16]}]},d1,{special:false});
eq(r.tally,{'一等奖':1,'二等奖':1,'三等奖':6,'四等奖':6}); eq(LT.ticketCost({game:'ssq',lines:[{f:[1,3,11,22,26,31,33],b:[11,16]}]}),28);
// 暴力展开对照复式
function combos(a,k){const res=[];(function rec(s,c){if(c.length===k){res.push(c.slice());return;}for(let i=s;i<a.length;i++){c.push(a[i]);rec(i+1,c);c.pop();}})(0,[]);return res;}
function brute(g,L,draw,ctx){const G=LT.GAMES[g];const out={};const F=combos(L.f,G.main.n-(L.fd||[]).length).map(c=>(L.fd||[]).concat(c));const B=G.sub?combos(L.b,G.sub.n-(L.bd||[]).length).map(c=>(L.bd||[]).concat(c)):[[]];
  F.forEach(f=>B.forEach(b=>{const x=LT.evalLine(g,{f,b},draw,ctx);for(const k in x)out[k]=(out[k]||0)+x[k];}));return out;}
for(let t=0;t<200;t++){ for(const g of ['ssq','dlt','qlc']){ const G=LT.GAMES[g]; const R=Math.random;
  const pool=LT.range(G.main.min,G.main.max); const drawN=[];while(drawN.length<G.main.n){const x=pool[Math.floor(R()*pool.length)];if(!drawN.includes(x))drawN.push(x);}
  let drawS=[]; if(G.sub){while(drawS.length<G.sub.n){const x=1+Math.floor(R()*G.sub.max);if(!drawS.includes(x))drawS.push(x);}} else {let x;do{x=1+Math.floor(R()*G.main.max);}while(drawN.includes(x));drawS=[x];}
  const draw={code:'2026100',n:drawN,s:drawS};
  const nd=Math.floor(R()*3); const fd=[];while(fd.length<nd){const x=pool[Math.floor(R()*pool.length)];if(!fd.includes(x))fd.push(x);}
  const f=[];const nf=G.main.n-nd+Math.floor(R()*3);while(f.length<nf){const x=pool[Math.floor(R()*pool.length)];if(!f.includes(x)&&!fd.includes(x))f.push(x);}
  // 让部分号码命中
  const L={fd,f}; if(G.sub){const nb=G.sub.n+Math.floor(R()*2);const b=[];while(b.length<nb){const x=1+Math.floor(R()*G.sub.max);if(!b.includes(x))b.push(x);}L.b=b;L.bd=[];}
  if(R()<0.5){L.f=LT.uniq(L.f.slice(0,2).concat(drawN.filter(x=>!fd.includes(x)).slice(0,3)).concat(f)).filter(x=>!fd.includes(x));}
  const ctx={special:true,boost:false}; eq(LT.evalLine(g,L,draw,ctx),brute(g,L,draw,ctx),g+' combo '+JSON.stringify(L)); } }
// ---- 大乐透（26068: 03 11 12 21 22 + 06 10）
const d2={code:'2026068',n:[3,11,12,21,22],s:[6,10]};
r=LT.checkTicket({game:'dlt',add:true,lines:[{f:[3,11,12,21,22],b:[6,10]},{f:[1,3,11,12,21],b:[6,10]},{f:[1,2,3,11,12],b:[6,10]},{f:[1,2,3,4,5],b:[6,10]},{f:[1,2,4,5,7],b:[6,10]}]},d2,{boost:false});
eq(r.tally,{'一等奖':1,'三等奖':1,'五等奖':1,'七等奖':2}); eq(r.fixed,5000+150+10);
r=LT.checkTicket({game:'dlt',lines:[{f:[1,3,11,12,21],b:[6,10]}]},d2,{boost:true}); eq(r.fixed,6666);
r=LT.checkTicket({game:'dlt',lines:[{f:[1,3,11,12,21],b:[6,10]}]},d2,{boost:null}); eq([r.fixed,r.fixedAlt],[5000,6666]);
eq(LT.ticketCost({game:'dlt',add:true,lines:[{f:[1,2,3,4,5],b:[1,2]}],mult:2}),6);
// ---- 七乐彩 2026123：06 08 12 18 20 29 30 特 21
const d3={code:'2026123',n:[6,8,12,18,20,29,30],s:[21]};
eq(LT.checkTicket({game:'qlc',lines:[{f:[6,8,12,18,20,29,30]}]},d3,{}).tally,{'一等奖':1});
eq(LT.checkTicket({game:'qlc',lines:[{f:[6,8,12,18,20,29,21]}]},d3,{}).tally,{'二等奖':1});
eq(LT.checkTicket({game:'qlc',lines:[{f:[6,8,12,18,20,29,1]}]},d3,{}).tally,{'三等奖':1});
let q=LT.checkTicket({game:'qlc',lines:[{f:[6,8,12,18,20,21,1]},{f:[6,8,12,18,20,1,2]},{f:[6,8,12,18,21,1,2]},{f:[6,8,12,18,1,2,3]},{f:[6,8,12,21,1,2,3]}]},d3,{});
eq(q.tally,{'四等奖':1,'五等奖':1,'六等奖':1,'七等奖':1}); eq(q.fixed,200+50+10+5);
// ---- 快乐8 2026277
const d4={code:'2026277',n:[1,9,11,16,17,23,25,30,32,37,39,48,49,53,55,60,66,67,70,74],s:[]};
eq(LT.checkTicket({game:'kl8',lines:[{k:1,f:[1]}]},d4,{}).fixed,4.5);
eq(LT.checkTicket({game:'kl8',lines:[{k:5,f:[1,9,11,16,17]}]},d4,{}).fixed,1000);
eq(LT.checkTicket({game:'kl8',lines:[{k:10,f:[2,3,4,5,6,7,8,10,12,13]}]},d4,{}).tally,{'选十中0':1});
eq(LT.checkTicket({game:'kl8',lines:[{k:10,f:[1,9,11,16,17,23,25,30,32,37]}]},d4,{}).floating,['选十中10']);
eq(LT.checkTicket({game:'kl8',lines:[{k:3,f:[1,9,2,3]}]},d4,{}).tally,{'选三中2':2}); // 复式4选3：2注中2
eq(LT.checkTicket({game:'kl8',lines:[{k:3,f:[1,9,2,3]}]},d4,{}).fixed,6);
eq(LT.checkTicket({game:'kl8',lines:[{k:2,fd:[1],f:[9,2,3]}]},d4,{}).tally,{'选二中2':1});
// ---- 3D / 排列3 / 排列5
const d5={code:'2026287',n:[1,5,4],s:[]}, d6={code:'2026288',n:[3,3,7],s:[]};
eq(LT.checkTicket({game:'pl3',lines:[{play:'zx',pos:[[1],[5],[4]]}]},d5,{}).fixed,1040);
eq(LT.checkTicket({game:'pl3',lines:[{play:'zx',pos:[[1,2],[5,6],[4]]}]},d5,{}).tally,{'直选':1});
eq(LT.lineBets('pl3',{play:'zx',pos:[[1,2],[5,6],[4]]}),4);
eq(LT.checkTicket({game:'fc3d',lines:[{play:'z6',f:[1,4,5]}]},d5,{}).fixed,173);
eq(LT.checkTicket({game:'fc3d',lines:[{play:'z6',f:[1,4,5,8]}]},d5,{}).fixed,173); eq(LT.lineBets('fc3d',{play:'z6',f:[1,4,5,8]}),4);
eq(LT.checkTicket({game:'fc3d',lines:[{play:'z3',d:[3,3,7]}]},d6,{}).fixed,346);
eq(LT.checkTicket({game:'fc3d',lines:[{play:'z3',d:[3,7,7]}]},d6,{}).fixed,0);
eq(LT.checkTicket({game:'fc3d',lines:[{play:'z3',f:[3,7,9]}]},d6,{}).fixed,346); eq(LT.lineBets('fc3d',{play:'z3',f:[3,7,9]}),6);
eq(LT.checkTicket({game:'fc3d',lines:[{play:'z6',f:[3,7,9]}]},d6,{}).fixed,0);
eq(LT.checkTicket({game:'pl5',lines:[{play:'zx',pos:[[1],[2],[3],[4],[5]]}]},{n:[1,2,3,4,5],s:[]},{}).fixed,100000);
// ---- 七星彩
const d7={code:'2026100',n:[1,2,3,4,5,6],s:[9]};
const qx=(ds,b)=>LT.checkTicket({game:'qxc',lines:[{pos:ds.map(x=>[x]),b:[b]}]},d7,{});
eq(qx([1,2,3,4,5,6],9).floating,['一等奖']); eq(qx([1,2,3,4,5,6],0).floating,['二等奖']);
eq(qx([1,2,3,4,5,0],9).fixed,3000); eq(qx([1,2,3,4,5,0],0).fixed,500); eq(qx([1,2,3,4,0,0],9).fixed,500);
eq(qx([1,2,3,4,0,0],0).fixed,30); eq(qx([1,2,3,0,0,0],9).fixed,30); eq(qx([1,2,3,0,0,0],0).fixed,5);
eq(qx([1,2,0,0,0,0],9).fixed,5); eq(qx([1,0,0,0,0,0],9).fixed,5); eq(qx([0,0,0,0,0,0],9).fixed,5); eq(qx([1,2,0,0,0,0],0).fixed,0);
// qxc 复式对照暴力
const Lq={pos:[[1,2],[2],[3,0],[4],[5,7],[6,1]],b:[9,3]}; let br={};
for(const a of Lq.pos[0])for(const b of Lq.pos[1])for(const c of Lq.pos[2])for(const d of Lq.pos[3])for(const e of Lq.pos[4])for(const f of Lq.pos[5])for(const z of Lq.b){const x=LT.evalLine('qxc',{pos:[[a],[b],[c],[d],[e],[f]],b:[z]},d7,{});for(const k in x)br[k]=(br[k]||0)+x[k];}
eq(LT.evalLine('qxc',Lq,d7,{}),br); eq(LT.lineBets('qxc',Lq),32);
// ---- 选号生成合法性
const fakeDraws=(g,n)=>{const G=LT.GAMES[g];const out=[];for(let i=0;i<n;i++){let N,S=[];
  if(G.kind==='lotto'||G.kind==='keno'){N=LT.asc(LT.range(G.main.min,G.main.max).sort(()=>Math.random()-0.5).slice(0,G.main.n));S=G.sub?LT.range(G.sub.min,G.sub.max).sort(()=>Math.random()-0.5).slice(0,G.sub.n):(G.special?[1]:[]);}
  else {N=LT.range(1,G.len).map(()=>Math.floor(Math.random()*10)); if(G.kind==='qxc')S=[Math.floor(Math.random()*15)];}
  out.push({code:String(2026001+i),date:'2026-01-01',n:N,s:S});} return out;};
const people=[{y:1985,m:6,d:15},{y:1996,m:3,d:9}]; let bad=0;
for(const g of LT.ORDER){ const G=LT.GAMES[g]; const dr=fakeDraws(g,120); const st=LT.stats(g,dr,50);
  for(const m of LT.METHODS){ for(let i=0;i<40;i++){
    const o={method:m.id,st,draws:dr,birthdays:people,zodiac:'双子座',bz:LT.bazi(1985,6,15,10),words:'全家平安'+i,avoid:true,k:1+(i%10),play:G.plays?G.plays[i%G.plays.length]:undefined};
    if(G.kind==='lotto'&&i%3===0)o.lock={f:[G.main.min+1],b:G.sub?[G.sub.min]:[]};
    if((G.kind==='digit'||G.kind==='qxc')&&i%4===0)o.lock={pos:[7]};
    const list=LT.generate(g,o,3);
    for(const L of list){ const n=LT.lineBets(g,L); if(n!==1||LT.lineIssues(g,L)){bad++; if(bad<6)console.log('BAD',g,m.id,JSON.stringify(L),n,LT.lineIssues(g,L));}
      if(G.kind==='lotto'){ if(L.f.some(x=>x<G.main.min||x>G.main.max)||LT.uniq(L.f).length!==G.main.n)bad++; if(o.lock&&!L.f.includes(o.lock.f[0]))bad++; }
      if(G.kind==='keno'){ if(L.f.length!==o.k||LT.uniq(L.f).length!==o.k||L.f.some(x=>x<1||x>80))bad++; }
      if((G.kind==='digit'&&L.play==='zx')||G.kind==='qxc'){ if(o.lock&&L.pos[0][0]!==7)bad++; if(L.pos.some(a=>a[0]<0||a[0]>9))bad++; }
      if(G.kind==='qxc'&&(L.b[0]<0||L.b[0]>14))bad++;
    } } } }
eq(bad,0,'invalid generated');
eq(JSON.stringify(LT.generate('ssq',{method:'words',words:'测试'},2)),JSON.stringify(LT.generate('ssq',{method:'words',words:'测试'},2)));
// ---- 期号/日期
const sd=[{code:'2026123',date:'2026-10-27',n:[],s:[]}];
eq(LT.nextIssue('ssq',sd,new Date('2026-10-29T04:00:00Z')),{code:'2026124',date:'2026-10-29'});
eq(LT.nextIssue('ssq',sd,new Date('2026-10-29T13:00:00Z')),{code:'2026125',date:'2026-11-01'});
eq(LT.nextIssue('pl3',[{code:'2026287',date:'2026-10-28'}],new Date('2026-10-29T04:00:00Z')),{code:'2026288',date:'2026-10-29'});
eq(LT.nextIssue('qxc',[{code:'2026123',date:'2026-10-27'}],new Date('2026-10-28T04:00:00Z')),{code:'2026124',date:'2026-10-30'});
eq(LT.lastDueDate('ssq',new Date('2026-10-29T04:00:00Z')),'2026-10-27');
eq(LT.lastDueDate('ssq',new Date('2026-10-29T13:40:00Z')),'2026-10-29');
eq(LT.lastDueDate('kl8',new Date('2026-10-29T13:40:00Z')),'2026-10-28');
eq(LT.drawsToday(new Date('2026-10-29T04:00:00Z')),['ssq','fc3d','kl8','pl3','pl5']);
eq(LT.bazi(1949,10,1,15).pillars,['己丑','癸酉','甲子','壬申']);
eq(LT.sortLevels(['四等奖','福运奖','一等奖']),['一等奖','四等奖','福运奖']);
eq(LT.sortLevels(['选十中5','选十中0','选十中9']),['选十中9','选十中5','选十中0']);
console.log('games tests passed:',pass);
