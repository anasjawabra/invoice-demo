#!/usr/bin/env python3
"""Build a LOCAL, git-ignored subset of the six Furas exports: N contract numbers and ONLY the rows that belong to them.
Everything outside the whitelist of non-personal columns is blanked (header kept); bill numbers are replaced by a placeholder that keeps the «filled» pattern.
The originals are never modified or deleted. Usage: python3 scripts/make-furas-subset.py [source dir] [output dir] [N=100]
The output directory should be a git-ignored name (default: furas-subset.local) — the script refuses to write anywhere Git tracks."""
import glob, json, os, random, subprocess, sys
import pandas as pd

SRC = sys.argv[1] if len(sys.argv) > 1 else (open('furas-exports.local', encoding='utf-8').read().strip() if os.path.exists('furas-exports.local') else '')
OUT = sys.argv[2] if len(sys.argv) > 2 else 'furas-subset.local'
N = int(sys.argv[3]) if len(sys.argv) > 3 else 100
if not SRC or not os.path.isdir(SRC): sys.exit('source directory not found')
if subprocess.run(['git', 'check-ignore', '-q', OUT]).returncode != 0: sys.exit(f'{OUT} is not git-ignored: refusing to write data there')
KEEP = json.loads(subprocess.check_output(['node', '-e', "import('./server/furasData.js').then(m=>console.log(JSON.stringify(m.FURAS_KEEP)))"], text=True))
FILES = {v: sorted(glob.glob(os.path.join(SRC, f'ads_furas_schema_{v}_df_*.csv')))[-1] for v in KEEP}
def load(v): return pd.read_csv(FILES[v], dtype=str, keep_default_na=False, na_values=[''], low_memory=False, encoding='utf-8-sig')
V = {v: load(v) for v in KEEP}
C, P = V['contract'], V['payment']

# ---------- choose N contract numbers that contain EVERY scenario the data shows (greedy set cover, seeded and reproducible), then fill with a spread
rng = random.Random(20261102)
size = C.groupby('contractnumber').size(); numbers = list(size.index); EXTRACT = '2026-10-25'
def year(s): return pd.to_numeric(s.str[:4], errors='coerce')
def dnorm(s): return s.where(~s.fillna('').str.fullmatch(r'\d{8}'), s.str[:4] + '-' + s.str[4:6] + '-' + s.str[6:8]).str[:10]
sc = {}   # scenario → set of contract numbers that show it
def S_(name, nums): sc[name] = set(n for n in nums if isinstance(n, str))
for col, label in [('contracttype', 'service type'), ('opportunitystatus', 'status'), ('municipalityid', 'Amanah code'), ('rentalstatus', 'rental status'), ('renewalstatus', 'renewal status')]:
    for val in sorted(C[col].dropna().unique()): S_(f'{label} = {val}', C.loc[C[col] == val, 'contractnumber'])
def nuniq(col, numeric=False):
    x = pd.to_numeric(C[col], errors='coerce').round(2) if numeric else C[col]
    return x.groupby(C['contractnumber']).nunique(dropna=True)
for col, label, num in [('opportunitystatus', 'status', False), ('contractvalue', 'contract value', True), ('annualcontractvalue', 'annual value', True), ('contracttype', 'service type', False), ('enddate', 'end date', False), ('municipalityid', 'Amanah', False), ('investorid', 'investor', False), ('opportunitynumber', 'opportunity', False)]:
    n = nuniq(col, num); S_(f'repeated number with different {label}', n[(n > 1)].index)
_nv = nuniq('contractvalue', True); S_('repeated number, records agree on value', [x for x in size[size > 1].index if _nv.get(x, 0) == 1])
nv = nuniq('contractvalue', True); S_('number without a contract value', nv[nv == 0].index); S_('number with one consistent value', nv[nv == 1].index)
S_('single record', size[size == 1].index); S_('several records', size[size > 1].index); S_('largest record count', size[size == size.max()].index); S_('13+ records', size[size >= 13].index)
S_('start date filled', C.loc[C['startdate'].notna(), 'contractnumber']); S_('end date missing', C.loc[C['enddate'].isna(), 'contractnumber']); S_('end date filled', C.loc[C['enddate'].notna(), 'contractnumber'])
S_('investor id not in the Investor view', C.loc[C['investorid'].notna() & ~C['investorid'].isin(set(V['investor']['investorid'])), 'contractnumber'])
pzn = dict(zip(C['pzinskey'], C['contractnumber'])); rl = C.dropna(subset=['renewedcontractid'])
S_('renewal link to itself', rl.loc[rl['pzinskey'] == rl['renewedcontractid'], 'contractnumber']); S_('renewal link inside the same number', [a for a, b in zip(rl['contractnumber'], rl['renewedcontractid']) if pzn.get(b) == a and True])
pair_target = {a: pzn.get(b) for a, b in zip(rl['contractnumber'], rl['renewedcontractid']) if pzn.get(b) and pzn.get(b) != a}; S_('renewal link to another number (both included)', pair_target.keys())
# payment extract
pay_nos = set(P['contractid'].dropna()); S_('number without payment rows', [n for n in numbers if n not in pay_nos]); S_('number with payment rows', pay_nos)
for col, label in [('batchstatus', 'payment status'), ('paymenttype', 'payment type'), ('methodofcollectingpayments', 'collection frequency')]:
    for val in sorted(P[col].dropna().unique()): S_(f'{label} = {val}', P.loc[P[col] == val, 'contractid'])
    S_(f'{label} empty', P.loc[P[col].isna(), 'contractid'])
Pd = {c: P[c].fillna('') for c in ['paymentduedate', 'invoicedate', 'paymentdate']}
yd = {c: year(Pd[c]) for c in Pd}
S_('due date year 1970', P.loc[yd['paymentduedate'] == 1970, 'contractid']); S_('due date after 2100', P.loc[yd['paymentduedate'] > 2100, 'contractid']); S_('future due date (legitimate)', P.loc[(yd['paymentduedate'] > 2026) & (yd['paymentduedate'] <= 2100), 'contractid'])
S_('invoice date after the extract date', P.loc[(yd['invoicedate'] >= 1900) & (yd['invoicedate'] <= 2100) & (Pd['invoicedate'].str[:10] > EXTRACT), 'contractid']); S_('invoice date Hijri-like year', P.loc[yd['invoicedate'].between(1300, 1500), 'contractid'])
S_('payment date after the extract date', P.loc[(yd['paymentdate'] >= 1900) & (yd['paymentdate'] <= 2100) & (Pd['paymentdate'].str[:10] > EXTRACT), 'contractid']); S_('payment date Hijri-like year', P.loc[yd['paymentdate'].between(1300, 1500), 'contractid']); S_('payment date year 1970', P.loc[yd['paymentdate'] == 1970, 'contractid'])
S_('paid without a payment date', P.loc[(P['batchstatus'] == 'Paid') & P['paymentdate'].isna(), 'contractid']); S_('paid with a payment date', P.loc[(P['batchstatus'] == 'Paid') & P['paymentdate'].notna(), 'contractid'])
amt = pd.to_numeric(P['paymentamount'], errors='coerce'); S_('zero scheduled amount', P.loc[amt == 0, 'contractid']); S_('invoice date filled', P.loc[P['invoicedate'].notna(), 'contractid']); S_('invoice date missing', P.loc[P['invoicedate'].isna(), 'contractid'])
S_('payment rows on a repeated number', [n for n in pay_nos if size.get(n, 0) > 1]); S_('payment rows on a single-record number', [n for n in pay_nos if size.get(n, 0) == 1])
recopp = C.groupby('contractnumber')['opportunitynumber'].agg(set); S_('payment row whose opportunity matches no record', [r for r, o in zip(P['contractid'], P['opportunitynumber']) if isinstance(r, str) and o not in recopp.get(r, set())])
per = P['contractid'].value_counts(); S_('one payment row', per[per == 1].index); S_('2 payment rows', per[per == 2].index); S_('3+ payment rows', per[per >= 3].index); S_('5+ payment rows', per[per >= 5].index)
cont = []; ncont = []
for n in per[per >= 3].index:
    b = pd.to_numeric(P.loc[P['contractid'] == n, 'batchnumber'], errors='coerce').dropna().astype(int)
    (cont if len(b) == per[n] and b.is_unique and b.max() - b.min() + 1 == len(b) else ncont).append(n)
S_('3+ rows with contiguous batch numbers', cont); S_('3+ rows with gaps in batch numbers', ncont[:2000])
# case / workflow rows
M = V['contractmanagement']; opp2no = C.dropna(subset=['opportunitynumber']).groupby('opportunitynumber')['contractnumber'].agg(list)
S_('case rows named by contract number', M.loc[M['contractnumber'].isin(set(numbers)), 'contractnumber']); S_('case rows via opportunity number', [n for o in M['opportunitynumber'].dropna().unique() for n in opp2no.get(o, [])])
for v, lab in (('entitymanagement', 'entity case rows'), ('imsfw_work', 'workflow case rows')):
    X = V[v]; S_(lab, list(X.loc[X['contractnumber'].isin(set(numbers)), 'contractnumber']) + [n for o in X['opportunitynumber'].dropna().unique() for n in opp2no.get(o, [])])
for lab in M['pylabel'].dropna().unique()[:12]: S_(f'case label = {lab}', [n for o in M.loc[M['pylabel'] == lab, 'opportunitynumber'].dropna().unique() for n in opp2no.get(o, [])] + list(M.loc[(M['pylabel'] == lab) & M['contractnumber'].notna(), 'contractnumber']))
sc = {k: v for k, v in sc.items() if v}
chosen = []; chosen_set = set()
def add(n):
    if n and n not in chosen_set and len(chosen) < N: chosen.append(n); chosen_set.add(n)
# greedy cover: always take the number that shows the most scenarios not yet shown (ties: seeded random)
uncovered = set(sc); universe = sorted(set().union(*sc.values()))
index = {}
for k, v in sc.items():
    for n in v: index.setdefault(n, set()).add(k)
while uncovered and len(chosen) < N:
    best = max(index, key=lambda n: (len(index[n] & uncovered), rng.random()) if n not in chosen_set else (-1, 0))
    gain = index[best] & uncovered
    if not gain: break
    add(best); uncovered -= index[best]
    for k in list(gain):
        if k == 'renewal link to another number (both included)' and best in pair_target: add(pair_target[best])
covered_n = len(sc) - len(uncovered)
# fill the rest with a spread: repeated numbers and single records, with and without payment rows
rest = [n for n in numbers if n not in chosen_set]; rng.shuffle(rest); rest.sort(key=lambda n: (-(int(size[n] > 1) + int(n in pay_nos)), rng.random()))
for n in rest[: max(0, N - len(chosen))]: add(n)
print(f'scenarios: {covered_n}/{len(sc)} covered by {len(chosen)} contract numbers' + (f'; NOT covered: {sorted(uncovered)}' if uncovered else ''))
S = set(chosen)

# ---------- rows that belong to them
Cs = C[C['contractnumber'].isin(S)].copy(); Ps = P[P['contractid'].isin(S)].copy()
opps = set(Cs['opportunitynumber'].dropna()) | set(Ps['opportunitynumber'].dropna())
def related(df): return df[df['contractnumber'].isin(S) | df['opportunitynumber'].isin(opps)]
sub = {'contract': Cs, 'payment': Ps}
for v in ('contractmanagement', 'entitymanagement', 'imsfw_work'): sub[v] = related(V[v]).copy()
inv = set(Cs['investorid'].dropna()) | set(Ps['investorid'].dropna()) | set(sub['contractmanagement']['investorid'].dropna())
sub['investor'] = V['investor'][V['investor']['investorid'].isin(inv)].copy()
pz = set(Cs['pzinskey']); Cs.loc[~Cs['renewedcontractid'].isin(pz), 'renewedcontractid'] = pd.NA   # a renewal link whose target is outside the subset would dangle

# ---------- blank everything outside the whitelist; bill numbers keep only their «filled» pattern
os.makedirs(OUT, exist_ok=True)
rows = {}
for v, df in sub.items():
    cols = list(V[v].columns); out = df.copy()
    for c in cols:
        if c.lower() not in KEEP[v]: out[c] = pd.NA
    if 'sadadbillnumber' in out.columns:
        out['sadadbillnumber'] = V[v].loc[out.index, 'sadadbillnumber'].map(lambda x: '00-00-000000' if isinstance(x, str) else pd.NA)
    out.to_csv(os.path.join(OUT, os.path.basename(FILES[v])), index=False, encoding='utf-8-sig', lineterminator='\r\n')
    rows[v] = int(len(out))
json.dump({'kind': 'subset', 'contracts': len(S), 'rows': rows, 'selection': 'seeded greedy cover of every scenario the exports show (service types, statuses, Amanah codes, payment statuses, repeated numbers and their conflicts, date anomalies, schedules with and without gaps, renewal links, case rows), then a spread of repeated and single records',
           'scenarios': {'total': len(sc), 'covered': covered_n, 'notCovered': sorted(uncovered)},
           'blanked': 'every column outside the non-personal whitelist; bill numbers replaced by a placeholder', 'danglingRenewalLinksCleared': True}, open(os.path.join(OUT, 'subset.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
print(f'subset of {len(S)} contract numbers written to {OUT}:', rows)
