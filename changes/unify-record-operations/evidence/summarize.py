#!/usr/bin/env python3
"""汇合已成功且后验通过的逐样本数据，保留原样本，不只选择最快值。"""
import argparse
import hashlib
import json
from pathlib import Path
import statistics
import subprocess
import sys
sys.dont_write_bytecode = True
from generate import safe_env



def audit_inputs(samples):
    cache = {}
    for sample in samples:
        argv = sample['argv']
        root = Path(argv[4] if sample['mode'] == 'api' else argv[argv.index('--root') + 1])
        domain = sample['domain']
        key = (str(root), domain, sample['scenario'] in {'sync-full', 'sync-selected'})
        if key not in cache:
            fixture = json.loads((root / 'fixture-manifest.json').read_text())
            frozen = json.loads((root / 'tree-manifest.json').read_text())
            assert hashlib.sha256(json.dumps(frozen, sort_keys=True, separators=(',', ':')).encode()).hexdigest() == fixture['treeSha256']
            prefix = 'docs/decisions/' if domain == 'dr' else 'docs/investigations/'
            expected = {k: dict(v) for k, v in frozen.items() if k.startswith(prefix)}
            if key[2]:
                source_path = prefix + '261001-record-10000.md'
                original = subprocess.check_output(['git', '-c', 'core.hooksPath=/dev/null', '-C', str(root), 'show', 'HEAD:' + source_path], env=safe_env())
                assert hashlib.sha256(original).hexdigest() == frozen[source_path]['sha256']
                edited = original.replace(b'benchmark 261001-record-10000', b'benchmark edited-record-10000', 1)
                expected[source_path].update(sha256=hashlib.sha256(edited).hexdigest(), bytes=len(edited))
            cache[key] = (fixture['fixtureHead'], hashlib.sha256(json.dumps(expected, sort_keys=True, separators=(',', ':')).encode()).hexdigest())
        head, digest = cache[key]
        assert sample['fixtureHead'] == head and sample['inputDomainSha256'] == digest, ('input mismatch', sample['key'])
        sample['inputAudit'] = 'exact frozen HEAD bytes/mode manifest, plus only declared title edit for sync'


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--results', type=Path, nargs='+', required=True)
    parser.add_argument('--output', type=Path, required=True)
    parser.add_argument('--label', required=True)
    args = parser.parse_args()
    samples = []
    rejected = []
    provenance = []
    for file in args.results:
        data = file.read_bytes()
        provenance.append({'path': str(file.resolve()), 'sha256': hashlib.sha256(data).hexdigest()})
        for sample in json.loads(data):
            if sample['exit'] != 0:
                rejected.append(sample)
                continue
            assert 'verificationFailure' not in sample and 'postverify' in sample
            samples.append(sample)
    audit_inputs(samples)
    assert len({sample['key'] for sample in samples}) == len(samples), '重复证据不得重复计数'
    grouped = {}
    for sample in samples:
        group = (sample['domain'], sample['scenario'], sample['mode'])
        grouped.setdefault(group, []).append(sample)
    summary = []
    for (domain, scenario, mode), group in sorted(grouped.items()):
        summary.append({'domain': domain, 'scenario': scenario, 'mode': mode, 'n': len(group),
                        **{metric: {'median': statistics.median(item[metric] for item in group),
                                    'min': min(item[metric] for item in group), 'max': max(item[metric] for item in group)}
                           for metric in ['wallMs', 'userMs', 'systemMs', 'maxRssKiB', 'stdoutBytes', 'stderrBytes']}})
    args.output.write_text(json.dumps({'label': args.label, 'provenance': provenance, 'samples': samples, 'rejectedSamples': rejected, 'summary': summary}, ensure_ascii=False, indent=2))
    print('| domain | scenario | entry | n | wall ms median [min,max] | user/system ms median | RSS KiB median | stdout/stderr bytes median |')
    print('| --- | --- | --- | ---: | ---: | ---: | ---: | ---: |')
    for group in summary:
        values = group['wallMs']
        print(f'| {group["domain"]} | {group["scenario"]} | {group["mode"]} | {group["n"]} | {values["median"]:.1f} [{values["min"]:.1f},{values["max"]:.1f}] | {group["userMs"]["median"]:.1f}/{group["systemMs"]["median"]:.1f} | {group["maxRssKiB"]["median"]:.0f} | {group["stdoutBytes"]["median"]:.0f}/{group["stderrBytes"]["median"]:.0f} |')


if __name__ == '__main__':
    main()
