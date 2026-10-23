#!/usr/bin/env python3
"""汇合有限最终证据，按真实source/入口保留历史与复用边界；不运行产品。"""
import hashlib
import json
from pathlib import Path
import statistics

HERE = Path(__file__).resolve().parent
FINAL = Path('/tmp/unify-record-operations-final-phase-opt-20261023')
METRICS = ['wallMs', 'userMs', 'systemMs', 'maxRssKiB', 'stdoutBytes', 'stderrBytes']

def read(path):
    return json.loads(Path(path).read_text())

def grouped(samples):
    result = []
    for key in sorted({(s['domain'], s['scenario'], s['mode']) for s in samples}):
        values = [s for s in samples if (s['domain'], s['scenario'], s['mode']) == key]
        result.append(dict(zip(['domain', 'scenario', 'mode'], key), n=len(values),
                           **{metric: {'median': statistics.median(s[metric] for s in values), 'min': min(s[metric] for s in values), 'max': max(s[metric] for s in values)} for metric in METRICS},
                           sampleIds=[s['sampleId'] for s in values]))
    return result

def main():
    provenance = []
    def load(path, collection=None, label=None):
        path = Path(path)
        content = path.read_bytes()
        data = json.loads(content)
        provenance.append({'path': str(path.resolve()), 'sha256': hashlib.sha256(content).hexdigest(), 'collection': collection})
        values = data[collection] if collection else data
        result = []
        for i, sample in enumerate(values):
            assert sample['exit'] == 0 and 'verificationFailure' not in sample and sample.get('postverify'), (path, sample['key'])
            result.append({**sample, 'sampleId': f'{label or path.parent.name}:{i + 1}:{sample["key"]}', 'rawDataset': str(path.resolve()), 'rawDatasetSha256': provenance[-1]['sha256']})
        return result
    baseline = load(HERE / 'baseline-results.json', 'samples', 'baseline65')
    stage = load(HERE / 'after-0-3-results.json', 'samples', 'stage03')
    middle = load(HERE / 'mode-fixed-attempt-results.json', 'normalObserved', 'mode-fixed')
    source = load(HERE / 'source-opt-attempt-results.json', 'normalObserved', 'source-opt')
    strict = load(HERE / 'strict-opt-attempt-results.json', 'normalObserved', 'strict-opt')
    latest = []
    for name in ['normal-strict', 'normal-ir-discard', 'cli-final-dr', 'cli-final-ir', 'cli-baseline-dr']:
        latest.extend(load(FINAL / name / 'results.json'))
    current = [s for s in latest if s['argv'][2 if s['mode'] == 'api' else 1].startswith(str(FINAL / 'source'))]
    baseline_extra = [s for s in latest if s not in current]
    assert len(current) == 6 and len(baseline_extra) == 2
    reused = [s for s in source if s['scenario'] not in {'rename', 'discard'}]
    assert len(reused) == 23
    reused += [s for s in stage if s['scenario'] in {'list', 'relations', 'show'}]
    metadata = [s for s in middle if s['scenario'] == 'metadata' and '/unify-record-operations-final-mode-fixed-' in s['argv'][2]]
    assert len(metadata) == 4
    reused += metadata
    reused += [s for s in strict if s['scenario'] == 'discard' and s['domain'] == 'dr' or s['scenario'] == 'content' and '/unify-record-operations-final-strict-opt-' in s['argv'][2]]
    for s in current:
        s['reuseBoundary'] = 'Direct latest frozen-source normal measurement'
    for s in reused:
        s['reuseBoundary'] = 'Business/default-path evidence reused by final-runtime-reuse-proof.json + final-phase-reuse-proof.json; lifecycle RSS/startup retains actual source provenance, not byte-identical final import evidence'
    effective = reused + current
    assert len(effective) == 42
    baseline_reps = baseline + [s for s in baseline_extra if s['mode'] == 'cli']
    assert len(baseline_reps) == 67
    counts = load(FINAL / 'counts-strict/results.json')
    assert len(counts) == 1
    for s in counts:
        assert s['counts']
    historical_counts = []
    initial_counts = read(HERE / 'work-counts.json')
    for item in initial_counts['sets']:
        historical_counts.extend(load(item['rawPath'], label=item['label']))
    historical_counts.extend(load(HERE / 'mode-fixed-attempt-results.json', 'instrumentedObserved', 'mode-fixed-counts'))
    historical_counts.extend(load(HERE / 'source-opt-attempt-results.json', 'instrumentedObserved', 'source-opt-counts'))
    historical_counts.extend(load(HERE / 'strict-opt-attempt-results.json', 'instrumentedObserved', 'strict-opt-counts'))
    assert len(historical_counts) + len(counts) == 25
    rejected_path = HERE / 'final-attempt-mode-boundary.json'
    rejected_bytes = rejected_path.read_bytes()
    provenance.append({'path': str(rejected_path.resolve()), 'sha256': hashlib.sha256(rejected_bytes).hexdigest()})
    data = {
        'status': 'Finite measurement complete; product/native/Gate acceptance remains root responsibility',
        'sourceManifest': read(HERE / 'final-phase-opt-manifest.json'),
        'runtimeReuseProof': ['final-runtime-reuse-proof.json', 'final-phase-reuse-proof.json'],
        'baselinePrimary': baseline_reps,
        'effectiveFinalRepresentatives': effective,
        'latestDirectNormal': current,
        'latestBaselineReverseContent': [s for s in strict if s['scenario'] == 'content' and '/unify-record-operations-baseline/source' in s['argv'][2]],
        'strictCountsSeparate': counts,
        'allHistoricalCountsSeparate': historical_counts,
        'preModeRejectedAttempt': json.loads(rejected_bytes),
        'baselineRejectedSamples': read(HERE / 'baseline-results.json')['rejectedSamples'],
        'historicalNormalCohorts': {'baseline65': baseline, 'stage03_30': stage, 'modeFixed16': middle, 'sourceOpt27': source, 'strictOpt7': strict},
        'historicalDiagnosticArtifacts': ['work-counts.json', 'mode-fixed-attempt-results.json', 'source-opt-attempt-results.json', 'strict-opt-attempt-results.json'],
        'rejectedAttemptArtifacts': ['baseline-results.json:rejectedSamples', 'final-attempt-mode-boundary.json'],
        'physicalNormalCount': len(baseline) + len(stage) + len(middle) + len(source) + len(strict) + len(latest),
        'effectiveFinalCount': len(effective),
        'latestDirectNormalCount': len(current),
        'additionalBaselineCount': len(baseline_extra),
        'newOutsideFullChecks': 0,
        'physicalDiagnosticCount': 25,
        'readPolicy': 'After policy change zero extra full checks. Before policy change mode-fixed four completed; older per-scene checks retain historical raw provenance. No repeated measured check, no check diagnostic counts.',
        'measuredChecks': 'One each domain already in source-opt cohort, reused unchanged default-branch proof; no repeated check, no check instrumentation',
        'posterior': 'Every accepted sample exit0, exact input HEAD/domain digest and independent bytes/mode/entries/revision/identity/coverage/count posterior retained. Reused values retain original posterior/source; no synthetic latest hash validation claimed.',
        'provenance': provenance,
        'baselineSummary': grouped(baseline_reps),
        'effectiveFinalSummary': grouped(effective)
    }
    assert data['physicalNormalCount'] == 153
    (HERE / 'final-results.json').write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n')
    rows = ['| 域 | 场景 | 入口 | old n / wall 中位ms | after n / wall 中位[min,max]ms | user/system中位ms | RSS KiB中位* | stdout/stderr bytes中位 | 来源 |', '| --- | --- | --- | ---: | ---: | ---: | ---: | ---: | --- |']
    before = {(s['domain'], s['scenario'], s['mode']): s for s in data['baselineSummary']}
    byid = {s['sampleId']: s for s in effective}
    for s in data['effectiveFinalSummary']:
        key = (s['domain'], s['scenario'], s['mode'])
        old = before.get(key)
        wall = s['wallMs']
        origin = 'latest' if all(byid[x] in current for x in s['sampleIds']) else '业务复用/原snapshot RSS'
        oldtext = f'{old["n"]}/{old["wallMs"]["median"]:.1f}' if old else '未测'
        rows.append(f'| {s["domain"]} | {s["scenario"]} | {s["mode"]} | {oldtext} | {s["n"]}/{wall["median"]:.1f}[{wall["min"]:.1f},{wall["max"]:.1f}] | {s["userMs"]["median"]:.1f}/{s["systemMs"]["median"]:.1f} | {s["maxRssKiB"]["median"]:.0f} | {s["stdoutBytes"]["median"]:.0f}/{s["stderrBytes"]["median"]:.0f} | {origin} |')
    rows += ['', '* RSS/启动不由业务分支复用推导最终字节闭包等价；数值保持各样本实际snapshot标签。API/CLI、两域API封套均不混算。metadata为已取得两轮交错各2个after，不与旧阶段三次强行合池。']
    (HERE / 'final-table.md').write_text('\n'.join(rows) + '\n')
    for sample in counts:
        c = sample['counts']
        phases = sorted({k.split(':')[1] for k in c if k.startswith('stage:')})
        print(sample['domain'], [(phase, {key: c.get(f'stage:{phase}:{key}', 0) for key in ['readRecordText', 'readRecordTextSnapshot', 'readRecordFileSnapshot', 'requireRecordTextSnapshot', 'parseDecisionMarkdown', 'parseInvestigationReport', 'fs.open.read.formalSource']}) for phase in phases])

if __name__ == '__main__':
    main()
