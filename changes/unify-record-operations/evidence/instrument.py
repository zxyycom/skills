#!/usr/bin/env python3
"""只在独立 /tmp 副本函数体入口插计数，正常 baseline 从不加载此副本。"""
import argparse
import hashlib
import json
from pathlib import Path
import re
import shutil

# 只统计具名原生边界；计数含各阶段，不能把总数误作同阶段重复。
FUNCTIONS = {
    'decision-records/src/decision-metadata.ts': ['parseDecisionMarkdown'],
    'decision-records/src/decision-candidate-context.ts': ['loadCandidateIdentityContext'],
    'decision-records/src/decision-candidate-discovery.ts': ['loadCandidateIdentityContext', 'readDecisionCandidateHeader'],
    'record-operations/src/candidate.ts': ['prepareRecordCandidates'],
    'record-operations/src/source.ts': ['readRecordText'],
    'decision-records/src/scan.ts': ['scanDecisionRecords'],
    'decision-records/src/decision-rename.ts': ['applyDecisionRenameWithinLock'],
    'decision-records/src/decision-transaction-plan.ts': ['prepareDecisionTransactionPlan', 'verifyDecisionTransactionMembers'],
    'decision-records/src/decision-transaction-source.ts': ['captureDecisionTransactionSources'],
    'decision-records/src/scan-collection.ts': ['readSourceText'],
    'decision-records/src/decision-index-source.ts': ['readDecisionSourceRevision', 'readDecisionStateSnapshot', 'discoverDecisionSources'],
    'record-operations/src/check.ts': ['checkCollectedRecordIndex'],
    'record-operations/src/transaction.ts': ['runRecordTransaction', 'executePreparedRecordTransaction', 'verifyPlan', 'verifyWritten'],
    'record-operations/src/transaction-files.ts': ['readRecordFileSnapshot'],
    'record-operations/src/transaction-snapshot.ts': ['readRecordFileSnapshot', 'readRecordTextSnapshot', 'requireRecordTextSnapshot'],
    'decision-records/src/decision-strict-preparation.ts': ['captureDecisionSourceFiles'],
    'investigation-report/src/rename-preparation.ts': ['prepareRename', 'loadRenameSources', 'verifyRenameIndexFreshness'],
    'investigation-report/src/rename-transaction-plan.ts': ['prepareRenameTransaction'],
    'investigation-report/src/rename-verification.ts': ['verifyCommittedRename', 'indexIsStale'],
    'investigation-report/src/markdown.ts': ['parseInvestigationReport'],
    'index-runtime/src/snapshot-parser.ts': ['parseStateIndex', 'parseStateIndexEnvelope'],
    'index-runtime/src/snapshot-builder.ts': ['buildStateIndex', 'buildStateIndexFromSnapshot'],
    'index-runtime/src/reader.ts': ['createStateIndexReader', 'createStateIndexReaderFromSnapshot', 'createStateIndexReaderFromPrepared'],
    'index-runtime/src/query-fields.ts': ['materializeStateIndexEntry'],
    'index-runtime/src/prepared.ts': ['prepareStateIndex', 'prepareStateIndexFromSnapshot', 'loadPreparedStateIndex', 'consumePreparedStateIndex', 'prepareSelectedStateIndexBaseline', 'consumePreparedSelectedBaseline'],
    'index-runtime/src/projection.ts': ['projectStateIndexState', 'validateCompleteStateIndex'],
    'shared/src/graph/relations.ts': ['buildRelationGraph'],
    'decision-records/src/relation-graph.ts': ['decisionRelationConsistencyIssues'],
    'investigation-report/src/relation-validation.ts': ['validateInvestigationRelationGraph'],
}


OPTIONAL = {'verifyCommittedRename', 'indexIsStale', 'readRecordTextSnapshot', 'requireRecordTextSnapshot', 'captureDecisionSourceFiles', 'prepareRename', 'loadRenameSources', 'verifyRenameIndexFreshness', 'prepareRenameTransaction', *FUNCTIONS['decision-records/src/decision-rename.ts'], *FUNCTIONS['decision-records/src/decision-transaction-plan.ts'], *FUNCTIONS['decision-records/src/decision-transaction-source.ts'], *FUNCTIONS['record-operations/src/source.ts'], *FUNCTIONS['decision-records/src/scan.ts'], *FUNCTIONS['decision-records/src/scan-collection.ts'], *FUNCTIONS['decision-records/src/decision-index-source.ts'], *FUNCTIONS['record-operations/src/check.ts'], *FUNCTIONS['record-operations/src/transaction.ts'], *FUNCTIONS['record-operations/src/transaction-files.ts'], 'loadCandidateIdentityContext', 'createStateIndexReaderFromSnapshot', 'createStateIndexReaderFromPrepared', *FUNCTIONS['index-runtime/src/prepared.ts']}

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--source', type=Path, required=True)
    parser.add_argument('--target', type=Path, required=True)
    parser.add_argument('--phases', action='store_true', help='两域严格正常代表固定顺序阶段标记，不作泛化上下文平台')
    args = parser.parse_args()
    assert str(args.target.resolve()).startswith('/tmp/') and not args.target.exists()
    shutil.copytree(args.source, args.target, symlinks=True)
    # 复制品保留原只读目录mode；只在受控插桩副本恢复目录owner写权限。
    for directory in [args.target, *[p for p in args.target.rglob('*') if p.is_dir() and not p.is_symlink() and p.name != 'node_modules']]:
        directory.chmod(directory.stat().st_mode | 0o200)
    patched = []
    # 分发 wrapper 运行闭包是实际计数位置；无生产源码改动。
    for skill in ['decision-records', 'investigation-report']:
        closure = args.target / 'skills' / skill / 'scripts/runtime/tools'
        for relative, functions in FUNCTIONS.items():
            file = closure / relative
            if not file.exists():
                continue
            text = file.read_text()
            source_hash = hashlib.sha256(text.encode()).hexdigest()
            for name in functions:
                # 已核对的具名函数签名；不匹配或重复匹配时拒绝，不猜测插入位置。
                # 函数参数最后一行可能是 }（object 参数），故从函数名到返回类型所在行确定入口。
                start = re.search(rf'\bfunction {name}\b', text)
                if start is None:
                    assert name in OPTIONAL, (file, name)
                    patched.append({'skill': skill, 'file': relative, 'function': name, 'status': 'absent-in-revision', 'sourceSha256': source_hash})
                    continue
                rest = text[start.start():]
                signature = re.search(r'\n\}?\):[^\{]+?\{\n', rest)
                if signature is None and name == 'readDecisionCandidateHeader':
                    signature = re.search(r'function readDecisionCandidateHeader\([^\n]+\) \{\n', rest)
                assert signature is not None and signature.end() < 1500, (file, name)
                offset = start.start() + signature.end()
                stages = {'applyDecisionRenameWithinLock': 'rename.locked-prepare', 'prepareDecisionTransactionPlan': 'txn.prepare', 'prepareRenameTransaction': 'txn.prepare', 'verifyPlan': 'txn.fresh-guards', 'executePreparedRecordTransaction': 'txn.write', 'verifyWritten': 'txn.postwrite-guards'}
                stage = f'  globalThis.__recordPerfStage?.({json.dumps(stages[name])});\n' if args.phases and name in stages else ''
                text = text[:offset] + stage + f'  globalThis.__recordPerfCount?.({json.dumps(name)});\n' + text[offset:]
                patched.append({'skill': skill, 'file': relative, 'function': name, 'status': 'instrumented', 'sourceSha256': source_hash})
            if args.phases and relative == 'investigation-report/src/rename-preparation.ts':
                needle = '  const freshness = await verifyRenameIndexFreshness(root, indexPath, formal);'
                assert text.count(needle) == 1
                text = text.replace(needle, '  const __perfPreviousPhase = globalThis.__recordPerfPhase?.();\n  globalThis.__recordPerfStage?.(`${__perfPreviousPhase}.native-indexfresh`);\n' + needle + '\n  globalThis.__recordPerfStage?.(__perfPreviousPhase);')
                patched.append({'skill': skill, 'file': relative, 'status': 'fixed-phase-marker', 'phase': 'prepare.native-indexfresh', 'sourceSha256': source_hash})
            if args.phases and relative == 'investigation-report/src/rename-verification.ts':
                needle = '  const freshness = await syncInvestigationStateIndex({\n    investigationsDirectory: root,\n    mode: "check",\n    snapshot: collection.snapshot\n  });'
                assert text.count(needle) == 1
                text = text.replace(needle, '  const __perfPreviousPhase = globalThis.__recordPerfPhase?.();\n  globalThis.__recordPerfStage?.(`${__perfPreviousPhase}.native-indexfresh`);\n' + needle + '\n  globalThis.__recordPerfStage?.(__perfPreviousPhase);')
                patched.append({'skill': skill, 'file': relative, 'status': 'fixed-phase-marker', 'phase': 'postwrite.native-indexfresh', 'sourceSha256': source_hash})
            if args.phases and relative == 'record-operations/src/transaction.ts':
                for needle, label in [('await options.fresh(plan.value);', 'txn.fresh-domain'), ('await options.verify(plan.value);', 'txn.postwrite-domain')]:
                    assert text.count(needle) == 1, (relative, needle)
                    text = text.replace(needle, f'globalThis.__recordPerfStage?.({json.dumps(label)});\n      ' + needle)
                    patched.append({'skill': skill, 'file': relative, 'function': needle, 'status': 'fixed-phase-marker', 'phase': label, 'sourceSha256': source_hash})
            file.chmod(0o644)
            file.write_text(text)
    if args.phases:
        file = args.target / 'skills/investigation-report/scripts/runtime/tools/investigation-report/src/rename.ts'
        text = file.read_text()
        source_hash = hashlib.sha256(text.encode()).hexdigest()
        for needle, label in [('  const initial = await prepareRename(root, indexPath, options);', 'ir.preflight-prepare'), ('        const prepared = await prepareRename(root, indexPath, options);', 'ir.locked-prepare')]:
            assert text.count(needle) == 1
            text = text.replace(needle, f'  globalThis.__recordPerfStage?.({json.dumps(label)});\n' + needle)
            patched.append({'skill': 'investigation-report', 'file': 'investigation-report/src/rename.ts', 'status': 'fixed-phase-marker', 'phase': label, 'sourceSha256': source_hash})
        file.chmod(0o644)
        file.write_text(text)
    (args.target / 'instrumentation.json').write_text(json.dumps(patched, indent=2))
    print(json.dumps(patched, indent=2))


if __name__ == '__main__':
    main()
