#!/usr/bin/env python3
"""最终phase去重的真实源码差异与有限复用边界，不执行产品/fixture。"""
import difflib
import hashlib
import json
from pathlib import Path

HERE = Path(__file__).resolve().parent
BEFORE = Path('/tmp/unify-record-operations-final-strict-opt-20261023')
AFTER = Path('/tmp/unify-record-operations-final-phase-opt-20261023')

def main():
    a = json.loads((BEFORE / 'files-manifest.json').read_text())
    b = json.loads((AFTER / 'files-manifest.json').read_text())
    changes = []
    for name in sorted(a.keys() | b.keys()):
        if a.get(name) == b.get(name) or not name.startswith('tools/') or '/src/' not in name or not name.endswith('.ts'):
            continue
        old, new = BEFORE / 'source' / name, AFTER / 'source' / name
        diff = ''.join(difflib.unified_diff(old.read_text().splitlines(True) if old.exists() else [], new.read_text().splitlines(True) if new.exists() else [], fromfile=str(old), tofile=str(new)))
        changes.append({'path': name, 'before': a.get(name), 'after': b.get(name), 'diff': diff})
    assert len(changes) == 4
    data = {
        'beforeManifest': str(BEFORE / 'files-manifest.json'),
        'beforeManifestSha256': hashlib.sha256((BEFORE / 'files-manifest.json').read_bytes()).hexdigest(),
        'afterManifest': str(AFTER / 'files-manifest.json'),
        'afterManifestSha256': hashlib.sha256((AFTER / 'files-manifest.json').read_bytes()).hexdigest(),
        'actualChangedRuntimeSources': changes,
        'reusedDRDiscard': 'DR decision-transaction-plan.ts is byte-identical. Its guards explicitly filter all writePaths including index, so discard writes and guards do not overlap. RecordVerificationPhase now observes each unique path once with same readRecordFileSnapshot/sameRecordFile and permissions checks. New per-phase Map bookkeeping is not measured as zero overhead: original strict-opt discard67.557s/CPU/RSS retains actual snapshot. Latest DRrename normal is a limited shared-phase control, not proof of equal final RSS/startup.',
        'reusedSyncQueriesChecks': 'No sync/query/source/index-runtime/check owner bytes changed. New verification phase is not invoked by readonly sync/query/check. Existing source-opt12 sync, two measured readonly checks, prior metadata AB/BA and counts, and strict-opt two contents retain exact executable business responsibilities. Import closure/RSS not asserted identical.',
        'reusedCandidatesOrdinaryTransactions': 'Public candidate and ordinary publish/set-relations paths have no new domain discovery/parse/projection/IO. Common verification retains real per-phase source reads, with duplicate same-path proof success reused only inside one root-bound phase. Default noCapture/body/index branches documented in final-runtime-reuse-proof.json remain. Per-phase Map allocation/bookkeeping delta is not separately timed for every old operation; no all-matrix repetition or exact wall/RSS equality claim. Latest DRnew CLI covers affected current startup+transaction representative.',
        'remeasured': 'IRrename/discard normal1 each, IRrename counts1, DRrename normal1. Existing DRdiscard retained by disjoint-loop proof. Latest CLI DRnew/DRselected/IRmetadata1 each plus missing baseline DRnew/DRselected1 each.',
        'historicalBoundary': 'Common noop writes+guards repeated per-path verification was introduced in shared transaction path. IR postwrite duplicate formal layout/body parse already existed in exact original HEAD; now reused only within this fresh domain postwrite validation, not across prepare/native fresh/common guard phases.',
        'guarantee': 'No cross-phase or persistent cache; only same-phase duplicate verification shares actual successful root/path proof. Each verify phase newly resolves root and observes sources; an expected mismatch cannot suppress real IO/error, mutable expected bytes are not stored as acquired proof. Root independent correctness evidence owns drift/failure semantics; this performance proof is not its substitute.'
    }
    (HERE / 'final-phase-reuse-proof.json').write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n')

if __name__ == '__main__':
    main()
