#!/usr/bin/env python3
"""冻结四个已疑慢组，最多两轮AB/BA；逐调用共享验收、独立后验。"""
import argparse
import json
from pathlib import Path
import subprocess
import sys

HERE = Path(__file__).resolve().parent
BASE = Path('/tmp/unify-record-operations-baseline')
FINAL = Path('/tmp/unify-record-operations-final-mode-fixed-20261023')
GROUPS = [('dr', 'content'), ('dr', 'metadata'), ('ir', 'metadata'), ('dr', 'sync-selected')]


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--round', type=int, choices=[1, 2], required=True)
    parser.add_argument('--groups', choices=['all', 'metadata'], default='all')
    args = parser.parse_args()
    order = ['baseline', 'final'] if args.round == 1 else ['final', 'baseline']
    manifest = []
    for domain, scenario in GROUPS:
        if args.groups == 'metadata' and scenario != 'metadata':
            continue
        values = {}
        for version in order:
            source = BASE / 'source' if version == 'baseline' else FINAL / 'source'
            output = FINAL / f'interleaved-r{args.round}-{domain}-{scenario}-{version}'
            argv = [sys.executable, str(HERE / 'measure.py'), '--source', str(source),
                    '--fixture', str(BASE / 'fixture-v3'), '--output', str(output),
                    '--modes', 'api', '--domains', domain, '--scenarios', scenario,
                    '--repetitions', '1', '--full-check-proof', str(HERE / f'{version}-shared-check-proof.json')]
            subprocess.run(argv, check=True)
            sample = json.loads((output / 'results.json').read_text())[0]
            values[version] = sample['wallMs']
            manifest.append({'version': version, 'domain': domain, 'scenario': scenario, 'argv': argv, 'rawPath': str(output / 'results.json')})
        print(json.dumps({'round': args.round, 'domain': domain, 'scenario': scenario, 'wallMs': values,
                          'afterOverBefore': values['final'] / values['baseline']}), flush=True)
    (FINAL / f'interleaved-round-{args.round}-{args.groups}.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2))


if __name__ == '__main__':
    main()
