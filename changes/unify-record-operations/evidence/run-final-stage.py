#!/usr/bin/env python3
"""已批准有限清单；分阶段串行，失败即停，不重写已有输出。"""
import argparse
from pathlib import Path
import subprocess
import sys

HERE = Path(__file__).resolve().parent
BASE = Path('/tmp/unify-record-operations-baseline')
FINAL = Path('/tmp/unify-record-operations-final-source-opt-20261023')


def run(group, domains, scenarios, *, repetitions=None, mode='api', version='final', counts=False, variant=False):
    source = FINAL / ('instrumented' if counts else 'source') if version == 'final' else BASE / ('instrumented-candidates' if counts else 'source')
    proof = HERE / ('source-opt-shared-check-proof.json' if version == 'final' else 'baseline-shared-check-proof.json')
    argv = [sys.executable, str(HERE / 'measure.py'), '--source', str(source), '--fixture',
            str(BASE / ('fixture-ir-content-100' if variant else 'fixture-v3')), '--output', str(FINAL / group),
            '--domains', domains, '--scenarios', scenarios, '--modes', mode, '--full-check-proof', str(proof)]
    if repetitions is not None:
        argv += ['--repetitions', str(repetitions)]
    if counts:
        argv += ['--counts']
    subprocess.run(argv, check=True)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--stage', choices=['sync', 'candidates', 'transactions', 'content', 'cli', 'counts'], required=True)
    args = parser.parse_args()
    if args.stage == 'sync':
        run('normal-dr-full', 'dr', 'sync-full')
        for number in [2, 3]:
            run(f'normal-dr-selected-{number}', 'dr', 'sync-selected', repetitions=1)
        run('normal-ir-sync', 'ir', 'sync-full,sync-selected')
    elif args.stage == 'candidates':
        run('normal-candidates', 'dr,ir', 'new,readiness')
    elif args.stage == 'transactions':
        run('normal-transactions', 'dr,ir', 'publish,publish-batch,set-relations,rename,discard,check')
    elif args.stage == 'content':
        run('normal-ir-content-100', 'ir', 'content', variant=True)
        # 第一轮AB已取得；此处只做必要反序BA，不追加第三轮。
        run('content-reverse-final', 'dr', 'content', repetitions=1)
        run('content-reverse-baseline', 'dr', 'content', repetitions=1, version='baseline')
    elif args.stage == 'cli':
        run('cli-final-dr', 'dr', 'new,sync-selected', repetitions=1, mode='cli')
        run('cli-final-ir', 'ir', 'metadata', repetitions=1, mode='cli')
        run('cli-baseline-dr', 'dr', 'new,sync-selected', repetitions=1, mode='cli', version='baseline')
    elif args.stage == 'counts':
        run('counts-dr-full', 'dr', 'sync-full', counts=True)
        run('counts-ir-sync', 'ir', 'sync-full,sync-selected', counts=True)
        run('counts-candidate-create', 'dr,ir', 'new', counts=True)
        run('counts-dr-transactions', 'dr', 'publish,check', counts=True)
        run('counts-ir-transactions', 'ir', 'publish,check', counts=True)
        run('counts-content-final', 'dr', 'content', counts=True)
        run('counts-content-baseline', 'dr', 'content', counts=True, version='baseline')


if __name__ == '__main__':
    main()
