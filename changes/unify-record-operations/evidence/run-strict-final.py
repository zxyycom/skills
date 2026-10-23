#!/usr/bin/env python3
"""已批准有限清单；分阶段串行，失败即停，不重写已有输出。"""
import argparse
from pathlib import Path
import subprocess
import sys

HERE = Path(__file__).resolve().parent
BASE = Path('/tmp/unify-record-operations-baseline')
FINAL = Path('/tmp/unify-record-operations-final-strict-opt-20261023')


def run(group, domains, scenarios, *, repetitions=None, mode='api', version='final', counts=False, variant=False):
    source = FINAL / ('instrumented' if counts else 'source') if version == 'final' else BASE / ('instrumented-candidates' if counts else 'source')
    proof = HERE / ('strict-opt-shared-check-proof.json' if version == 'final' else 'baseline-shared-check-proof.json')
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
    parser.add_argument('--stage', choices=['content', 'cli'], required=True)
    args = parser.parse_args()
    if args.stage == 'content':
        run('normal-ir-content-100', 'ir', 'content', variant=True)
        # 第一轮AB已取得；此处只做必要反序BA，不追加第三轮。
        run('content-reverse-final', 'dr', 'content', repetitions=1)
        run('content-reverse-baseline', 'dr', 'content', repetitions=1, version='baseline')
    elif args.stage == 'cli':
        run('cli-final-dr', 'dr', 'new,sync-selected', repetitions=1, mode='cli')
        run('cli-final-ir', 'ir', 'metadata', repetitions=1, mode='cli')
        run('cli-baseline-dr', 'dr', 'new,sync-selected', repetitions=1, mode='cli', version='baseline')


if __name__ == '__main__':
    main()
