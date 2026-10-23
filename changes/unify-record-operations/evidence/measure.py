#!/usr/bin/env python3
"""串行、可恢复、正常计时与插桩分离的有限 1W 测量入口。"""
import argparse
import hashlib
import json
import os
from pathlib import Path
import subprocess
import time
import sys
sys.dont_write_bytecode = True
from generate import git, identity, safe_env, tree_manifest

HERE = Path(__file__).resolve().parent
MUTATIONS = {'sync-full', 'sync-selected', 'new', 'publish', 'publish-batch', 'set-relations', 'rename', 'discard'}
HOT = {'sync-full', 'sync-selected', 'metadata'}
SCENARIOS = ['sync-full', 'sync-selected', 'list', 'metadata', 'relations', 'content', 'show', 'new', 'readiness', 'publish', 'publish-batch', 'set-relations', 'rename', 'discard', 'check']


def command(domain, scenario):
    common = {
        'sync-full': ['sync-index'], 'sync-selected': ['sync-index', '--select', identity(10000)],
        'list': ['list', '--limit', '5', '--offset', '5'],
        'metadata': ['search', 'benchmark', '--in', 'metadata', '--limit', '5'],
        'relations': ['list', '--related-to', identity(9000), '--direction', 'successors', '--limit', '5'],
        'content': ['search', 'needle-perf-unique', '--in', 'content'],
        'show': ['show', identity(10000)], 'readiness': ['show-candidate', '261001-candidate-1'],
        'new': ['new', 'new-candidate' if domain == 'dr' else '261001-new-candidate', '--title', 'benchmark candidate', '--tag', 'benchmark'],
        'publish': ['publish', '261001-candidate-1'],
        'set-relations': ['set-relations', '--source', identity(10000), '--relation', f'{"修订" if domain == "dr" else "补充"}={identity(8999)}'],
        'rename': ['rename', identity(10000), '261001-renamed-record', '--rename-recorded-decision' if domain == 'dr' else '--rename-recorded-report'],
        'discard': ['discard', identity(10000), '--delete-recorded'], 'check': ['check']}
    if domain == 'dr':
        common['list'] += ['--status', 'all']
        common['metadata'] += ['--status', 'all']
        common['content'] += ['--status', 'all']
        common['publish'] += ['--alignment', 'aligned']
        common['publish-batch'] = ['evolve', '--successor', 'aligned=261001-candidate-1', '--successor', 'aligned=261001-candidate-2', '--clear-relations']
        common['new'] += ['--purpose', '固定目的', '--background', '固定背景', '--decision', '固定决定']
    else:
        common['content'] += ['--limit', '5', '--tag', 'content-scope']
        common['publish-batch'] = ['publish', '261001-candidate-1', '261001-candidate-2']
        common['new'] += ['--question', '固定问题', '--formed-at', '2026-10-01T00:00:00Z']
    return common[scenario]


def reset(root, scenario):
    # 精确目标仅为本生成器私有 /tmp fixture；不触碰真实 Git 环境。
    assert str(root).startswith('/tmp/') and (root / 'fixture-manifest.json').exists()
    git(root, 'reset', '--hard', 'HEAD')
    # 删除只限 docs 中本轮新建的未跟踪产物；run artifacts 在 docs 外。
    git(root, 'clean', '-fd', '--', 'docs')
    frozen = json.loads((root / 'tree-manifest.json').read_text())
    actual, _ = tree_manifest(root)
    assert actual.keys() == frozen.keys(), 'reset member mismatch'
    for relative, expected in frozen.items():
        assert actual[relative]['sha256'] == expected['sha256'] and actual[relative]['bytes'] == expected['bytes'], ('reset bytes', relative)
        if actual[relative]['mode'] != expected['mode']:
            (root / relative).chmod(int(expected['mode'], 8))
    if scenario in {'sync-full', 'sync-selected'}:
        for directory in ['decisions', 'investigations']:
            file = root / 'docs' / directory / (identity(10000) + '.md')
            file.write_bytes(file.read_bytes().replace(b'benchmark 261001-record-10000', b'benchmark edited-record-10000', 1))


def index_file(root, domain):
    directory, name = ('decisions', 'decision-index.json') if domain == 'dr' else ('investigations', 'investigation-index.json')
    return root / 'docs' / directory / name


def domain_manifest(root, domain):
    entries, _ = tree_manifest(root)
    prefix = 'docs/decisions/' if domain == 'dr' else 'docs/investigations/'
    return {k: v for k, v in entries.items() if k.startswith(prefix)}


def postverify(root, domain, scenario, before, before_index, stdout):
    after = domain_manifest(root, domain)
    changed = sorted(key for key in set(before) | set(after) if before.get(key) != after.get(key))
    idxpath = index_file(root, domain)
    index = json.loads(idxpath.read_text())
    entries = index['entries']
    expected_count = 10000 + (1 if scenario == 'publish' else 2 if scenario == 'publish-batch' else -1 if scenario == 'discard' else 0)
    assert len(entries) == expected_count, (scenario, len(entries), expected_count)
    assert set(index['sourceRevision']['entries']) == set(entries)
    expected_edges = 8999 if scenario == 'discard' else 9000
    assert sum(len(entry['relations']) for entry in entries.values()) == expected_edges
    selected_audit = {}
    if scenario in {'sync-full', 'sync-selected'}:
        expected = {**before_index['entries'][identity(10000)], 'title': 'benchmark edited-record-10000'}
        assert entries[identity(10000)] == expected
        selected_audit[identity(10000)] = expected
    if scenario in {'publish', 'publish-batch'}:
        published = {f'261001-candidate-{i}' for i in range(1, 3 if scenario == 'publish-batch' else 2)}
        assert set(entries) == set(before_index['entries']) | published
        for ident in published:
            expected = {'name': ident[7:], 'sourcePath': ident + '.md', 'title': 'benchmark ' + ident, 'tags': ['benchmark'], 'relations': []}
            if domain == 'dr':
                stamp = entries[ident]['createdAt']
                from datetime import datetime
                assert datetime.fromisoformat(stamp.replace('Z', '+00:00')).tzinfo is not None
                expected.update(status='active', alignment='aligned', createdAt=stamp, purpose='固定目的', background='固定背景', decision='固定决定')
            else:
                expected.update(formedAt='2026-10-01T00:00:00Z', question='固定问题', resourceIds=[])
            assert entries[ident] == expected, ('published projection', ident, entries[ident], expected)
            selected_audit[ident] = expected
    if scenario == 'rename':
        expected = {**before_index['entries'][identity(10000)], 'name': 'renamed-record', 'sourcePath': 'renamed-record.md'}
        assert set(entries) == (set(before_index['entries']) - {identity(10000)}) | {'261001-renamed-record'}
        assert entries['261001-renamed-record'] == expected
        selected_audit['261001-renamed-record'] = expected
    if scenario == 'discard':
        assert set(entries) == set(before_index['entries']) - {identity(10000)}
    if scenario == 'set-relations':
        expected = {**before_index['entries'][identity(10000)], 'relations': [{'type': '修订' if domain == 'dr' else '补充', 'target': identity(8999)}]}
        assert entries[identity(10000)] == expected
        selected_audit[identity(10000)] = expected
    # 独立逐项核对发布 locator、frontmatter ID 和 revision。索引结构由真实既有域/fixture全量验收proof承接；此处不追加check。
    for ident, entry in entries.items():
        source = idxpath.parent / entry['sourcePath']
        data = source.read_bytes()
        lines = data.decode('utf8').splitlines()
        declared = [line[3:].strip().strip('"') for line in lines[1:lines.index('---', 1)] if line.startswith('id:')]
        assert declared == [ident], (ident, declared)
        label = ('decision' if domain == 'dr' else 'investigation') + '-index-entry-v2'
        normalized = data.decode('utf8').replace('\r\n', '\n')
        if domain == 'ir': normalized = normalized.replace('\r', '\n')
        fields = [ident, entry['sourcePath'], normalized]
        fingerprint = label.encode() + b'\0' + b''.join(str(len(field.encode())).encode() + b':' + field.encode() + b'\0' for field in fields)
        assert index['sourceRevision']['entries'][ident] == 'sha256:' + hashlib.sha256(fingerprint).hexdigest(), ('revision', ident)
    if scenario not in MUTATIONS:
        assert changed == [], changed
    else:
        # 验证完整未选状态：只有指定精确白名单文件可变化；无临时文件/资源逃逸。
        prefix = 'docs/decisions/' if domain == 'dr' else 'docs/investigations/'
        selected = identity(10000) + '.md'
        candidate = lambda i: f'261001-candidate-{i}.md' if domain == 'dr' else f'_candidate.261001-candidate-{i}'
        allowed = {str(idxpath.relative_to(root))}
        if scenario in {'sync-full', 'sync-selected'}: pass
        elif scenario == 'new': allowed = {prefix + ('new-candidate.md' if domain == 'dr' else '_candidate.new-candidate')}
        elif scenario.startswith('publish'):
            for i in range(1, 3 if scenario == 'publish-batch' else 2):
                allowed.update({prefix + candidate(i), prefix + f'261001-candidate-{i}.md'})
        elif scenario == 'rename': allowed.update({prefix + selected, prefix + 'renamed-record.md'})
        else: allowed.add(prefix + selected)
        assert set(changed).issubset(allowed) and changed, (scenario, changed, sorted(allowed))
        for file in set(before) & set(after):
            if before[file]['mode'] != after[file]['mode']:
                assert domain == 'ir' and scenario in {'publish', 'publish-batch', 'set-relations', 'rename', 'discard'} and file in allowed and after[file]['mode'] == '0o600', ('mode', file, before[file]['mode'], after[file]['mode'])
        for ident in set(before_index['entries']) & set(entries):
            if ident != identity(10000):
                assert before_index['entries'][ident] == entries[ident], ('unselected entry', ident)
        if scenario in {'sync-full', 'sync-selected', 'set-relations'}:
            assert before_index['entries'][identity(10000)] != entries[identity(10000)]
        if scenario == 'rename':
            assert identity(10000) not in entries and '261001-renamed-record' in entries
        if scenario == 'discard': assert identity(10000) not in entries
    for file in set(after) - set(before):
        assert after[file]['mode'] in {value['mode'] for value in before.values()} | {'0o600'}, ('unexpected created mode', file, after[file]['mode'])
    out = {'fileDelta': {file: {'before': before.get(file), 'after': after.get(file)} for file in changed}, 'relationCount': expected_edges, 'sourceRevisionMembershipExact': True, 'changedFiles': changed, 'entryCount': len(entries), 'unselectedBytesModesEntriesPreserved': True,
           'identityLocatorChecked': len(entries), 'selectedEntryProjectionAudit': selected_audit, 'stdoutSha256': hashlib.sha256(stdout).hexdigest(),
           'indexSha256': hashlib.sha256(idxpath.read_bytes()).hexdigest()}
    # API JSON search/list 直接验证 count/window/coverage；CLI 人类输出另存并下方断言关键字段。
    if domain == 'ir' and stdout.startswith(b'{'):
        result = json.loads(stdout)
        if scenario == 'metadata':
            assert len(result['entries']) == 5 and result['searchInfo']['counts']['matched'] == {'value': 10000, 'precision': 'exact'}
            out['searchInfo'] = result['searchInfo']
        elif scenario == 'content':
            assert len(result['entries']) == 1 and result['entries'][0]['id'] == identity(10000)
            assert result['searchInfo']['coverage']['scanComplete']
            out['searchInfo'] = result['searchInfo']
        elif scenario == 'list':
            assert [entry['id'] for entry in result['entries']] == [identity(i) for i in range(6, 11)] and result['total'] == 10000
        elif scenario == 'relations': assert len(result['entries']) == 1 and result['entries'][0]['id'] == identity(10000)
    else:
        text = stdout.decode('utf8')
        if scenario == 'metadata':
            assert 'matched=10000 precision=exact returned=5' in text and 'Coverage: scan=complete results=limited previews=n/a reasons=max-records' in text, text[:700]
        if scenario == 'content':
            assert identity(10000) in text and 'matched=1 precision=exact returned=1' in text and 'Coverage: scan=complete results=complete previews=complete reasons=none' in text, text[:700]
        if scenario in {'relations', 'show'}: assert identity(10000) in text
    if scenario == 'new':
        created = next(iter(changed))
        markdown = (root / created).read_text()
        lines = markdown.splitlines()
        ids = [line[3:].strip().strip('\"') for line in lines[1:lines.index('---', 1)] if line.startswith('id:')]
        expected_id = time.strftime('%y%m%d', time.gmtime()) + '-new-candidate' if domain == 'dr' else '261001-new-candidate'
        assert ids == [expected_id]
        if domain == 'dr':
            assert f'Decision ID: {expected_id}' in stdout.decode() and 'bodyReady: false' in stdout.decode()
        out['createdIdentityAudit'] = {'id': expected_id, 'sourcePath': str(Path(created).relative_to(idxpath.parent.relative_to(root)))}
        if domain == 'ir' and stdout.startswith(b'{'):
            candidate = json.loads(stdout)['candidate']
            assert candidate['id'] == expected_id and candidate['path'] == str(root / created) and candidate['markdown'] == markdown
            assert candidate['readiness'] == {'scaffoldValid': True, 'bodyReady': False, 'resourceReady': True}
            out['createdIdentityAudit']['readiness'] = candidate['readiness']
    if scenario == 'readiness':
        if domain == 'ir' and stdout.startswith(b'{'):
            candidate = json.loads(stdout)['candidate']
            assert candidate['id'] == '261001-candidate-1' and candidate['readiness'] == {'scaffoldValid': True, 'bodyReady': True, 'resourceReady': True}
        else:
            assert 'bodyReady: true' in stdout.decode() and 'scaffoldValid: true' in stdout.decode()
    if scenario == 'show':
        actual_markdown = (idxpath.parent / (identity(10000) + '.md')).read_text()
        if domain == 'ir' and stdout.startswith(b'{'): assert json.loads(stdout)['markdown'] == actual_markdown
        else: assert actual_markdown.strip() in stdout.decode('utf8')
    return out


def launch(argv, root, out, err, env):
    started = time.monotonic_ns()
    with out.open('wb') as stdout, err.open('wb') as stderr:
        process = subprocess.Popen(argv, cwd=root, env=env, stdout=stdout, stderr=stderr)
        _, status, usage = os.wait4(process.pid, 0)
        process.returncode = os.waitstatus_to_exitcode(status)
    return {'exit': process.returncode, 'wallMs': (time.monotonic_ns() - started) / 1e6,
            'userMs': usage.ru_utime * 1000, 'systemMs': usage.ru_stime * 1000, 'maxRssKiB': usage.ru_maxrss}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--source', type=Path, required=True)
    parser.add_argument('--fixture', type=Path, required=True)
    parser.add_argument('--output', type=Path, required=True)
    parser.add_argument('--scenarios', default=','.join(SCENARIOS))
    parser.add_argument('--domains', default='dr,ir')
    parser.add_argument('--modes', default='api,cli')
    parser.add_argument('--counts', action='store_true')
    parser.add_argument('--full-check-proof', type=Path, help='复用已记录的冻结版本/领域全量验收；逐样本独立后验不减')
    parser.add_argument('--repetitions', type=int, choices=[1, 3], help='显式覆盖有限代表的采样次数')
    parser.add_argument('--smoke', action='store_true', help='每项仅一次；仅用于检查 harness，不作为完整 baseline')
    args = parser.parse_args()
    os.umask(0o002)
    root = args.fixture.resolve()
    output = args.output.resolve()
    assert str(output).startswith('/tmp/') and not output.exists()
    output.mkdir(parents=True)
    results = []
    for domain in args.domains.split(','):
        for scenario in args.scenarios.split(','):
            if domain == 'ir' and scenario == 'content':
                assert json.loads((root / 'fixture-manifest.json').read_text()).get('irContentWindow') == 100, 'IR content requires --ir-content-window 100 fixture'
            if domain == 'dr' and scenario == 'publish-batch':
                continue  # DR 多 successor 必须闭合拆分/重划；常数批代表只选 IR 两条。
            for mode in args.modes.split(','):
                for repeat in range(args.repetitions if args.repetitions is not None else 1 if args.smoke or args.counts or scenario not in HOT else 3):
                    reset(root, scenario)
                    before = domain_manifest(root, domain)
                    before_index = json.loads(index_file(root, domain).read_text())
                    key = f'{domain}-{scenario}-{mode}-{repeat + 1}'
                    out, err, metric = [output / (key + suffix) for suffix in ['.stdout', '.stderr', '.metrics.json']]
                    cmd = command(domain, scenario)
                    if mode == 'api':
                        argv = ['node', str(HERE / 'api-worker.mjs'), str(args.source.resolve()), domain, str(root), scenario, json.dumps(cmd), str(metric)]
                    else:
                        entry = 'skills/decision-records/scripts/decision-records.ts' if domain == 'dr' else 'skills/investigation-report/scripts/check-investigations.ts'
                        argv = ['node', str(args.source.resolve() / entry), *cmd, '--root', str(root)]
                    env = safe_env()
                    if args.counts: env['RECORD_PERF_COUNTS'] = '1'
                    measured = launch(argv, root, out, err, env)
                    if mode == 'api' and metric.exists(): measured.update(json.loads(metric.read_text()))
                    item = {'key': key, 'domain': domain, 'scenario': scenario, 'mode': mode, 'repeat': repeat + 1,
                            'argv': argv, 'fixtureHead': git(root, 'rev-parse', 'HEAD'), 'inputDomainSha256': hashlib.sha256(json.dumps(before, sort_keys=True, separators=(',', ':')).encode()).hexdigest(), **measured, 'stdoutBytes': out.stat().st_size, 'stderrBytes': err.stat().st_size}
                    if measured['exit'] != 0:
                        item['failure'] = err.read_text()[:6000]
                        results.append(item)
                        (output / 'results.json').write_text(json.dumps(results, ensure_ascii=False, indent=2))
                        raise SystemExit(f'失败场景不计性能：{key}；保留 {output} 和当前 fixture')
                    try:
                        item['postverify'] = postverify(root, domain, scenario, before, before_index, out.read_bytes())
                        # 完整 check 是输入/结果独立验收，不计入测量，也不复用被测操作的成功断言。
                        entry = 'skills/decision-records/scripts/decision-records.ts' if domain == 'dr' else 'skills/investigation-report/scripts/check-investigations.ts'
                        if scenario == 'check':
                            item['postverify']['fullCheckExit'] = 'measured check itself; no duplicate full check'
                        elif args.full_check_proof is not None:
                            proof = json.loads(args.full_check_proof.read_text())
                            assert str(args.source.resolve()) in proof['allowedSources']
                            receipt = proof['domains'][domain]
                            assert receipt['exit'] == 0
                            raw = Path(receipt['rawPath']).read_bytes()
                            assert hashlib.sha256(raw).hexdigest() == receipt['rawSha256']
                            item['postverify']['fullCheckExit'] = 'shared frozen-version/domain proof; no repeated full check'
                            item['postverify']['fullCheckProof'] = {'path': str(args.full_check_proof.resolve()), **receipt}
                        elif repeat == 0:
                            checked = subprocess.run(['node', str(args.source.resolve() / entry), 'check', '--root', str(root)], capture_output=True, env=safe_env())
                            if checked.returncode: raise AssertionError(checked.stderr.decode()[:2000])
                            item['postverify']['fullCheckExit'] = checked.returncode
                        else:
                            item['postverify']['fullCheckExit'] = 'same scenario/entry first sample checked; every repeat independently bytes/mode/entry/revision verified'
                    except Exception as error:
                        item['verificationFailure'] = repr(error)
                        results.append(item)
                        (output / 'results.json').write_text(json.dumps(results, ensure_ascii=False, indent=2))
                        raise
                    results.append(item)
                    (output / 'results.json').write_text(json.dumps(results, ensure_ascii=False, indent=2))
                    print(f'{key}: {measured["wallMs"]:.1f} ms {measured["maxRssKiB"]} KiB verified', flush=True)
    reset(root, '')


if __name__ == '__main__':
    main()
