"""把多个来源的双色球/大乐透历史合并成 App 内置数据：www/data/{ssq,dlt}.json
每行：[期号, 日期, 前区..., 后区..., 奖池(亿), 销售额(元), 一等奖注数, 一等奖单注, 二等奖注数, 二等奖单注]"""
import json, glob, datetime, sys
import os
# 数据来源仓库和下载文件所在目录，用环境变量指定
R=os.environ.get('SRC_REPOS','sources/repos/')+'/'; D=os.environ.get('SRC_DL','sources/downloads/')+'/'
def norm(c): c=str(c); return c if len(c)==7 else '20'+c
out={}
for g,nf,nb in (('ssq',6,1),('dlt',5,2)):
    rows={}; src={}
    def put(code,date,a,b,tag,extra=None):
        code=norm(code); a=sorted(a); b=sorted(b)
        if len(a)!=nf or len(b)!=nb: return
        r=rows.get(code)
        if r is None:
            rows[code]={'d':date,'a':a,'b':b,'x':extra or {}}; src[code]={tag}
        else:
            if r['a']!=a or r['b']!=b: print('CONFLICT',g,code,r['a'],r['b'],a,b,tag,src[code]); return
            src[code].add(tag)
            if extra: r['x'].update({k:v for k,v in extra.items() if v is not None})
    gz=json.load(open(R+f'GuofengZ_lotto-trend/data/{g}.json'))
    for r in gz['rows']:
        put(r['code'],r['date'],r['reds'],r['blues'],'gz',{'pool':r.get('pool'),'sales':r.get('sales'),'p1c':r.get('p1c'),'p1m':r.get('p1m'),'p2c':r.get('p2c'),'p2m':r.get('p2m')})
    if g=='ssq':
        for fn in sorted(glob.glob(R+'wangdaodao_DoubleColorBall/data/20*.json')):
            for r in json.load(open(fn))['data']: put(r['code'],r['date'],r['red'],[r['blue']],'wd')
        for r in json.load(open(D+'jy_ssq.json')): put(r['issueNumber'],r['drawDate'],r['redBalls'],[r['blueBall']],'jy')
    else:
        for r in json.load(open(D+'jy_dlt.json')): put(r['issueNumber'],r['drawDate'],r['frontBalls'],r['backBalls'],'jy')
    for r in json.load(open(D+f'dp_{g}.json'))['results']: put(r['issue'],r['date'],r['mains'],r['specials'],'dp')
    # 手工核实过的（网易彩票 + 用户截图）
    if g=='dlt': put('2026123','2026-10-28',[13,18,19,20,28],[9,11],'verified',{'pool':None})
    if g=='dlt': put('2026122','2026-10-26',[2,14,21,22,24],[2,12],'verified',{'pool':7.73e8})
    fixdates={'2004080':'2004-09-23','2004113':'2004-12-09','2004114':'2004-12-12','2005017':'2005-02-08','2005064':'2005-06-05','2006050':'2006-05-02','2006084':'2006-07-20'}
    codes=sorted(rows)
    lst=[]
    for c in codes:
        r=rows[c]; x=r['x']; d=fixdates.get(c,r['d']) if g=='ssq' else r['d']
        pool=x.get('pool'); pool=round(pool/1e8,2) if isinstance(pool,(int,float)) else None
        lst.append([c,d]+r['a']+r['b']+[pool,x.get('sales'),x.get('p1c'),x.get('p1m'),x.get('p2c'),x.get('p2m')])
    single=[c for c in codes if len(src[c])==1]
    print(g,len(lst),lst[0][:2],lst[-1][:2+nf+nb+1],'single-source:',len(single),single[-5:])
    json.dump({'game':g,'built':datetime.date.today().isoformat(),'rows':lst},open(f'www/data/{g}.json','w'),separators=(',',':'),ensure_ascii=False)
