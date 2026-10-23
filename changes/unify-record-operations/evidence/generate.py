#!/usr/bin/env python3
"""生成受控 /tmp fixture；不写真实仓库、不复用历史调查输入。"""
import argparse
import hashlib
import json
import os
from pathlib import Path
import subprocess

BASE = '5d6a73fb51ef1d9c2b0311e160cbd42a04576f42'
STAMP = '2026-10-01T00:00:00Z'


def identity(i):
    return f'261001-record-{i:05}'


def markdown(domain, i, candidate=False, ir_content_window=0):
    ident = identity(i) if not candidate else f'261001-candidate-{i}'
    target = identity(i - 1000) if not candidate and i > 1000 else None
    fields = {'title': f'benchmark {ident}', 'id': ident}
    if domain == 'dr':
        fields.update(status='candidate' if candidate else 'archived' if i <= 9000 else 'active',
                      alignment=None if candidate else 'aligned' if i % 2 == 0 else 'unaligned',
                      createdAt=None if candidate else STAMP,
                      purpose='固定目的', background='固定背景', decision='固定决定', tags=['benchmark'])
    else:
        fields.update(formedAt=STAMP, question='固定问题', tags=['benchmark', 'content-scope'] if not candidate and i > 10000 - ir_content_window else ['benchmark'])
    # JSON 是 YAML 的合法子集；整个 frontmatter 仍逐字段输出。
    header = '\n'.join((f'{key}:\n' + '\n'.join('  - ' + json.dumps(tag) for tag in value) if key == 'tags' else f'{key}: {json.dumps(value, ensure_ascii=False)}') for key, value in fields.items())
    relations = ('relations: []' if target is None else
                 f'relations:\n  - type: "{"修订" if domain == "dr" else "补充"}"\n    target: "{target}"')
    body = ('## 目的\n固定目的。\n\n## 背景\n固定背景。\n\n## 决策\n- 采用: 固定决定。' if domain == 'dr' else
            '## 形成时背景\n固定背景。\n\n## 调查目的\n固定目的。\n\n## 调查范围与依据\n固定依据。\n\n## 调查结果与边界\n固定结果与边界。')
    if i == 10000 and not candidate:
        body += '\nneedle-perf-unique\n'
    if domain == 'ir' and i == 1 and not candidate:
        body += f'\n\n## 随附资源\n- [证据](./_resources/{ident}/evidence.txt)'
    return f'---\n{header}\n{relations}\n---\n\n{body}\n'


def safe_env():
    env = {k: v for k, v in os.environ.items() if not k.startswith('GIT_')}
    env.update(GIT_CONFIG_NOSYSTEM='1', GIT_CONFIG_GLOBAL='/dev/null', GIT_TERMINAL_PROMPT='0',
               GIT_AUTHOR_DATE=STAMP, GIT_COMMITTER_DATE=STAMP)
    return env


def git(root, *args):
    return subprocess.check_output(['git', '-c', 'core.hooksPath=/dev/null', '-C', str(root), *args], env=safe_env(), stderr=subprocess.STDOUT).decode().strip()


def tree_manifest(root):
    entries = {}
    for file in sorted((root / 'docs').rglob('*')):
        if file.is_file():
            data = file.read_bytes()
            entries[str(file.relative_to(root))] = {'sha256': hashlib.sha256(data).hexdigest(), 'bytes': len(data), 'mode': oct(file.stat().st_mode & 0o777)}
    canonical = json.dumps(entries, sort_keys=True, separators=(',', ':')).encode()
    return entries, hashlib.sha256(canonical).hexdigest()


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--root', type=Path, required=True)
    parser.add_argument('--source', type=Path, required=True)
    parser.add_argument('--ir-content-window', type=int, default=0)
    args = parser.parse_args()
    root = args.root.resolve()
    if not str(root).startswith('/tmp/') or root.exists():
        raise SystemExit('root 必须是尚不存在的 /tmp 目录')
    os.umask(0o002)  # 固定来源/资源 mode=0664；Node 安全新建沿其自身契约。
    root.mkdir(parents=True)
    for domain, directory in [('dr', 'decisions'), ('ir', 'investigations')]:
        collection = root / 'docs' / directory
        collection.mkdir(parents=True)
        if domain == 'dr':
            (collection / 'archive').mkdir()
        for i in range(1, 10001):
            relative = ('archive/' if domain == 'dr' and i <= 9000 else '') + identity(i) + '.md'
            (collection / relative).write_text(markdown(domain, i, ir_content_window=args.ir_content_window), encoding='utf8')
        for i in [1, 2]:
            candidate = f'261001-candidate-{i}'
            relative = candidate + '.md' if domain == 'dr' else '_candidate.' + candidate
            (collection / relative).write_text(markdown(domain, i, True), encoding='utf8')
        if domain == 'ir':
            resource = collection / '_resources' / identity(1) / 'evidence.txt'
            resource.parent.mkdir(parents=True)
            resource.write_bytes(b'constant resource evidence\n')
    # 基线正式索引由冻结公开 CLI 严格同步，再全量 check；生成均在计时外。
    commands = []
    for domain, filename in [('decision-records', 'decision-records'), ('investigation-report', 'check-investigations')]:
        entry = args.source / 'skills' / domain / 'scripts' / (filename + '.ts')
        for command in ['sync-index', 'check']:
            argv = ['node', str(entry), command, '--root', str(root)]
            result = subprocess.run(argv, capture_output=True, env=safe_env())
            (root / f'{domain}-{command}.stdout').write_bytes(result.stdout)
            (root / f'{domain}-{command}.stderr').write_bytes(result.stderr)
            commands.append({'argv': argv, 'exit': result.returncode, 'stdout': result.stdout.decode(), 'stderr': result.stderr.decode()})
            if result.returncode:
                (root / 'generation-failure.json').write_text(json.dumps(commands, ensure_ascii=False, indent=2))
                raise SystemExit(f'严格输入验收失败：{domain}/{command}，现场保留 {root}')
    git(root, 'init', '-q')
    git(root, 'config', 'user.name', 'Record Performance Fixture')
    git(root, 'config', 'user.email', 'fixture@example.invalid')
    git(root, 'config', 'core.hooksPath', '/dev/null')
    git(root, 'config', 'core.autocrlf', 'false')
    git(root, 'add', 'docs')
    git(root, 'commit', '-qm', 'Freeze 1W record-operation fixture')
    entries, digest = tree_manifest(root)
    (root / 'tree-manifest.json').write_text(json.dumps(entries, sort_keys=True))
    manifest = {'sourceCommit': BASE, 'fixtureHead': git(root, 'rev-parse', 'HEAD'),
                'fixtureTree': git(root, 'rev-parse', 'HEAD^{tree}'), 'treeSha256': digest,
                'files': len(entries), 'bytes': sum(v['bytes'] for v in entries.values()),
                'formalPerDomain': 10000, 'relationsPerDomain': 9000, 'candidatesPerDomain': 2,
                'irResources': 1, 'irOwners': 1, 'irContentWindow': args.ir_content_window, 'remotes': git(root, 'remote'), 'commands': commands}
    (root / 'fixture-manifest.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2))
    print(json.dumps(manifest, ensure_ascii=False, indent=2))


if __name__ == '__main__':
    main()
