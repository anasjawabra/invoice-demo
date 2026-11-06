#!/usr/bin/env python3
"""Independent check of the Furas dataset mode: recompute every displayed count and supported total from the local CSV exports with pandas
and compare it with what the data service answers (/api/furas/*). Prints PASS/FAIL per check and aggregates only — never a row value.
Usage: python3 scripts/verify-furas.py [export dir] [http://localhost:3000]   (the dir may also come from FURAS_EXPORT_DIR / furas-exports.local)"""
import glob, json, os, random, re, sys, urllib.request
import pandas as pd

def export_dir():
    if len(sys.argv) > 1 and os.path.isdir(sys.argv[1]): return sys.argv[1]
    d = os.environ.get('FURAS_EXPORT_DIR')
    if not d and os.path.exists('furas-exports.local'): d = open('furas-exports.local', encoding='utf-8').read().strip()
    if not d or not os.path.isdir(d): sys.exit('no export directory (argument, FURAS_EXPORT_DIR or furas-exports.local)')
    return d
BASE = sys.argv[2] if len(sys.argv) > 2 else 'http://localhost:3000'
D = export_dir()
def load(view, cols=None):
    f = sorted(glob.glob(os.path.join(D, f'ads_furas_schema_{view}_df_*.csv')))[-1]
    return pd.read_csv(f, dtype=str, keep_default_na=False, na_values=[''], low_memory=False, encoding='utf-8-sig', usecols=cols)
def api(path, body=None):
    req = urllib.request.Request(BASE + '/api' + path, data=json.dumps(body or {}).encode(), headers={'Content-Type': 'application/json'}, method='POST')
    return json.load(urllib.request.urlopen(req, timeout=300))

fails = 0
def check(name, got, want, tol=0):
    global fails
    ok = (abs(got - want) <= tol) if isinstance(want, (int, float)) and isinstance(got, (int, float)) else got == want
    fails += 0 if ok else 1
    print(('PASS ' if ok else 'FAIL ') + name + ('' if ok else f'  (service {got} vs files {want})'))

S = api('/furas/summary'); c = S['contracts']; p = S['payments']
C = load('contract'); P = load('payment'); M = load('contractmanagement', ['contractnumber', 'opportunitynumber', 'sadadbillnumber']); I = load('investor', ['investorid'])
EM = load('entitymanagement', ['contractnumber', 'opportunitynumber', 'sadadbillnumber']); IW = load('imsfw_work', ['contractnumber', 'opportunitynumber', 'sadadbillnumber'])
M = load('contractmanagement', ['contractnumber', 'opportunitynumber', 'sadadbillnumber'])
# SCOPE (same rule as server/furasData.js): approved contracts only; payment and case rows are dropped only when they belong to OTHER contracts (a row that matches no contract stays)
STATUS = os.environ.get('FURAS_STATUS_SCOPE', 'Contract-Approved')
if STATUS not in ('', 'all'):
    allNo, allOpp = set(C['contractnumber'].dropna()), set(C['opportunitynumber'].dropna())
    ap = C[C['opportunitystatus'] == STATUS]; apNo, apOpp = set(ap['contractnumber'].dropna()), set(ap['opportunitynumber'].dropna())
    P = P[~P['contractid'].isin(allNo - apNo)]
    def keep_cases(df):
        mine = df['contractnumber'].isin(apNo) | df['opportunitynumber'].isin(apOpp); other = ~mine & (df['contractnumber'].isin(allNo) | df['opportunitynumber'].isin(allOpp)); return df[~other]
    M, EM, IW = keep_cases(M), keep_cases(EM), keep_cases(IW); C = ap
    print(f'SCOPE: approved contracts only ({STATUS}) — {len(C)} contract records in scope')
no = C['contractnumber']; g = C.groupby('contractnumber'); size = g.size(); rep = size[size > 1]
check('Contract rows', c['records'], len(C)); check('Payment rows', p['rows'], len(P))
check('Contract record keys unique', c['recordKeyUnique'], C['pzinskey'].is_unique)
check('Distinct contract numbers', c['distinctNumbers'], int(no.nunique())); check('Records without a number', c['recordsWithoutNumber'], int(no.isna().sum()))
check('Numbers with several records', c['numbersWithSeveralRecords'], int(len(rep))); check('Records in repeated numbers', c['recordsInRepeatedNumbers'], int(rep.sum())); check('Max records on one number', c['maxRecordsPerNumber'], int(size.max()))
def nconf(col, numeric=False):
    s = pd.to_numeric(C[col], errors='coerce').round(2) if numeric else C[col]
    return int((s.groupby(C['contractnumber']).nunique(dropna=True).reindex(rep.index) > 1).sum())
for k, col, num in [('status', 'opportunitystatus', False), ('type', 'contracttype', False), ('value', 'contractvalue', True), ('annual', 'annualcontractvalue', True), ('municipality', 'municipalityid', False)]:
    check(f'Repeated numbers with conflicting {k}', c['conflictsAmongRepeated'][k], nconf(col, num))
check('Repeated numbers with different end dates', c['conflictsAmongRepeated']['endDate'], nconf('enddate'))
for key, col in [('byType', 'contracttype'), ('byStatus', 'opportunitystatus')]:
    rec = C[col].value_counts(); nums = C.dropna(subset=[col]).drop_duplicates(['contractnumber', col]).groupby(col).size()
    check(f'{key}: values', sorted(x['value'] for x in c[key]), sorted(rec.index)); check(f'{key}: records', {x['value']: x['records'] for x in c[key]}, rec.to_dict()); check(f'{key}: numbers', {x['value']: x['numbers'] for x in c[key]}, nums.to_dict())
mr = C['municipalityid'].value_counts(); check('Amanah codes', sorted(x['code'] for x in c['byMunicipality']), sorted(mr.index)); check('Amanah records', {x['code']: x['records'] for x in c['byMunicipality']}, mr.to_dict())
check('Amanah source names', {x['code']: x['sourceName'] for x in c['byMunicipality']}, C.dropna(subset=['municipalityid', 'municipality']).groupby('municipalityid')['municipality'].agg(lambda s: s.value_counts().index[0]).to_dict())
v = pd.to_numeric(C['contractvalue'], errors='coerce').round(2); nv = v.groupby(C['contractnumber']).nunique(dropna=True)
single = nv[nv == 1].index; sv = v.groupby(C['contractnumber']).max().reindex(single)
check('Numbers with one consistent value', c['values']['numbersWithSingleValue'], int(len(single))); check('Sum of those values (each number once)', c['values']['sumOfSingleValues'], float(sv.sum()), tol=1)
check('Numbers with conflicting values', c['values']['numbersWithConflictingValues'], int((nv > 1).sum())); check('Numbers without a value', c['values']['numbersWithoutValue'], int((nv == 0).sum()))
check('Start dates filled', c['dates']['startFilled'], int(C['startdate'].notna().sum())); check('End dates filled', c['dates']['endFilled'], int(C['enddate'].notna().sum()))
pz = set(C['pzinskey']); rl = C.dropna(subset=['renewedcontractid']); tgt = rl['renewedcontractid'].isin(pz)
check('Renewal links / resolved', [c['renewal']['links'], c['renewal']['resolved']], [len(rl), int(tgt.sum())]); check('Renewal self-references', c['renewal']['selfReference'], int((rl['pzinskey'] == rl['renewedcontractid']).sum()))
inv = set(I['investorid']); check('Contract investor ids found in Investor', c['investorIdFound'], int(C['investorid'].dropna().isin(inv).sum()))
# payments: the join must never multiply amounts
pn = P['contractid']; cnt = no.value_counts(); per_row = pn.map(cnt).fillna(0).astype(int)
check('Payment contract numbers', p['distinctNumbers'], int(pn.nunique())); check('…found in Contract', p['numbersFoundInContract'], int(pd.Series(pn.dropna().unique()).isin(set(no.dropna())).sum()))
check('Unmatched payment rows', p['rowsNotFound'], int((per_row == 0).sum())); check('Rows matching 2+ records', p['rowsMatchingSeveralRecords'], int((per_row > 1).sum())); check('Rows an amount join would produce', p['rowsAfterNumberJoin'], int(per_row.sum()))
check('Duplicate payment rows', p['duplicateRows'], int(P.duplicated(['contractid', 'batchyear', 'batchnumber']).sum()))
amt = pd.to_numeric(P['paymentamount'], errors='coerce'); check('Scheduled amount total (one amount per row)', p['scheduledAmount']['total'], float(amt.sum()), tol=1)
check('Zero amounts', p['scheduledAmount']['zeroRows'], int((amt == 0).sum()))
st = P.assign(a=amt).groupby('batchstatus').agg(rows=('a', 'size'), amount=('a', 'sum')); check('Payment status rows', {x['value']: x['rows'] for x in p['byStatus']}, st['rows'].to_dict())
check('Payment status amounts', {x['value']: round(x['scheduledAmount']) for x in p['byStatus']}, {k: round(x) for k, x in st['amount'].items()})
cnts = pn.value_counts(); big = cnts[cnts >= 3].index; cont = 0
for n in big:
    b = pd.to_numeric(P.loc[pn == n, 'batchnumber'], errors='coerce').dropna().astype(int)
    if len(b) == int(cnts[n]) and b.is_unique and b.max() - b.min() + 1 == len(b): cont += 1
check('Contracts with 3+ rows / contiguous', [p['contractsWithThreePlusRows'], p['contractsWithContiguousBatches']], [len(big), cont])
check('Collected-amount field filled', p['collectedFieldFilled'], int(P['batchamountpaid'].notna().sum()))
check('SADAD-like numbers filled on cases (CM/EM/IW)', [S['cases']['sadadBillNumberFilled'][k] for k in ('contractManagement', 'entityManagement', 'imsfwWork')], [int(M['sadadbillnumber'].notna().sum()), int(EM['sadadbillnumber'].notna().sum()), int(IW['sadadbillnumber'].notna().sum())])
check('Case rows with contract number found', S['cases']['contractNumberFound'], int(M['contractnumber'].dropna().isin(set(no.dropna())).sum())); check('Case rows with opportunity number found', S['cases']['opportunityNumberFound'], int(M['opportunitynumber'].dropna().isin(set(C['opportunitynumber'].dropna())).sum()))
# a sample of contract numbers: list rows and detail pages
random.seed(7); pick = lambda pool, k: random.sample(sorted(pool), min(k, len(pool)))   # a scoped subset can hold fewer than k
sample = pick(rep.index, 15) + pick(set(pn.dropna()), 15) + pick(size[size == 1].index, 10)
bad = 0
for n in sample:
    d = api('/furas/contract', {'no': n}); pr = P[P['contractid'] == n]; rc = C[C['contractnumber'] == n]
    okk = d['recordCount'] == len(rc) and d['payments']['rowsInExtract'] == len(pr) and sorted(x['status'] or '' for x in d['records']) == sorted(rc['opportunitystatus'].fillna('')) and \
        sorted(x['payable'] for x in d['payments']['rows'] if x['payable'] is not None) == sorted(pd.to_numeric(pr['paymentamount']).dropna()) and d['currentRecordDetermined'] is False
    bad += 0 if okk else 1
check(f'Contract detail pages (sample of {len(sample)}): records, payment rows, statuses, amounts', bad, 0)
L = api('/furas/contracts', {'pageSize': 1}); check('List total = distinct numbers', L['total'], int(no.nunique()))
L = api('/furas/contracts', {'pageSize': 1, 'filter': {'severalRecords': True}}); check('List filter: several records', L['total'], int(len(rep)))
L = api('/furas/contracts', {'pageSize': 1, 'filter': {'inPaymentExtract': True}}); check('List filter: has payment rows', L['total'], int(pn.nunique()))
print('\nFAILED CHECKS:', fails); sys.exit(1 if fails else 0)
