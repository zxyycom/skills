#!/usr/bin/env python3
"""冻结清单对照与已审默认分支的差异证据；不执行产品或遍历fixture。"""
import difflib
import hashlib
import json
from pathlib import Path

HERE = Path(__file__).resolve().parent
OLD = Path('/tmp/unify-record-operations-final-source-opt-20261023')
NEW = Path('/tmp/unify-record-operations-final-strict-opt-20261023')

def main():
    before = json.loads((OLD / 'files-manifest.json').read_text())
    after = json.loads((NEW / 'files-manifest.json').read_text())
    changed = []
    for name in sorted(before.keys() | after.keys()):
        if not name.startswith('tools/') or '/tests/' in name or not name.endswith('.ts') or name.endswith('.test.ts') or before.get(name) == after.get(name):
            continue
        left = OLD / 'source' / name
        right = NEW / 'source' / name
        diff = ''.join(difflib.unified_diff(left.read_text().splitlines(True) if left.exists() else [], right.read_text().splitlines(True) if right.exists() else [], fromfile=str(left), tofile=str(right)))
        changed.append({'path': name, 'before': before.get(name), 'after': after.get(name), 'diff': diff})
    unchanged = ['tools/record-operations/src/source.ts', 'tools/record-operations/src/check.ts', 'tools/record-operations/src/transaction.ts', 'tools/record-operations/src/candidate.ts', 'tools/index-runtime/src/storage-sync.ts', 'tools/decision-records/src/scan.ts', 'tools/decision-records/src/decision-state-index.ts', 'tools/decision-records/src/candidate-new.ts', 'tools/investigation-report/src/investigation-state-index.ts', 'tools/investigation-report/src/candidate-create-transaction.ts']
    exact = []
    for name in unchanged:
        if name not in before or name not in after:
            continue
        assert before[name] == after[name], name
        exact.append({'path': name, 'sha256': after[name]['sha256'], 'sameBytesAndMode': True})
    data = {
        'status': 'Frozen source-opt -> final strict-opt behavior reuse proof; not latest RSS/import equivalence',
        'beforeManifest': str(OLD / 'files-manifest.json'),
        'beforeManifestSha256': hashlib.sha256((OLD / 'files-manifest.json').read_bytes()).hexdigest(),
        'afterManifest': str(NEW / 'files-manifest.json'),
        'afterManifestSha256': hashlib.sha256((NEW / 'files-manifest.json').read_bytes()).hexdigest(),
        'unchangedRuntimeOwners': exact,
        'defaultBranchProofs': [
            {'operations': 'DR full/selected sync, readonly check', 'facts': 'scanDecisionRecords still calls scanDecisionSnapshot(options) without captureTransactionSources. New default false creates no Map; scan-index absent sourceCapture takes same readRecordText; scan-collection only adds braces. acquireDecisionCollection is the original acquisition sequence moved intact. Validation select/summary/check helpers moved from index.ts into decision-validation.ts with same body/diagnostic order.'},
            {'operations': 'IR full/selected sync, readonly check', 'facts': 'No InvestigationPreparation supplied. layout-entry uses same readRecordText; collectionStates uses same parseInvestigationReport; authoring resource helpers execute same former inline parse/build conditions. Added optional preparation branches are unreachable for these default operations.'},
            {'operations': 'DR/IR new, readiness', 'facts': 'Known-formal skip/header owner and common candidate logic unchanged. New strict capture is only supplied by rename/discard private path, not candidate preparation. Native creation modes and journal remain byte-identical source-opt paths. Default resource-reference helper extraction retains same parse options and result.'},
            {'operations': 'DR ordinary publish/set-relations; IR ordinary publish/two-candidate batch/set-relations', 'facts': 'No strict sourceCapture/InvestigationPreparation supplied. DR applyPreparedDecisionTransaction delegates to same run body with undefined capture; captureDecisionSource retains original readSnapshot/requireExpectedText; publishedBaseline projection returns before new validatedSources branch. isCandidateOnlyChange extracted unchanged. IR investigationFileWrite with absent captured still reads same snapshot; collection/resource default branches above unchanged. Common transaction/readRecordFileSnapshot bodies unchanged; snapshot file adds two unused functions.'},
            {'operations': 'strict rename/discard', 'facts': 'Actual capture/parsed-document/root-bound proof reuse changes executable work. Old four strict values stay historical, replaced by new four normal and two separate counts. Never reused as final strict results.'}
        ],
        'changedRuntimeFilesWithActualDiff': changed,
        'resourceBoundary': 'New imported modules enlarge process/import closure. Prior API lifecycle maxRSS and startup are retained only under actual historical snapshot provenance. Latest CLI representatives measure current complete import/start/render; no global byte-identical import claim.',
        'stage03Queries': 'Earlier runtime-reuse-operation-proof.json and runtime-reuse-analysis.md document stage03 query path semantics. Compare additional strict-only diff above: no query/source/text-search owner changes; readonly default layout additions remain absent preparation. Metadata AB/BA preserved, content representatives explicitly remeasured.'
    }
    (HERE / 'final-runtime-reuse-proof.json').write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n')

if __name__ == '__main__':
    main()
