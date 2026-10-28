from pathlib import Path
import shutil

root = Path(__file__).resolve().parent
shutil.copytree(root / "baseline", root / "instrumented", symlinks=True)


def replace_once(path: Path, marker: str, replacement: str) -> None:
    source = path.read_text()
    if source.count(marker) != 1:
        raise ValueError(f"expected one instrumentation marker in {path}: {marker}")
    path.write_text(source.replace(marker, replacement, 1))


replace_once(
    root / "instrumented/tools/decision-records/src/decision-relation-transaction-strategy.ts",
    "for (const id of selected) if (component.has(id)) return true;",
    "for (const id of selected) { globalThis.__evidence.closureHas += 1; if (component.has(id)) return true; }",
)
replace_once(
    root / "instrumented/tools/shared/src/graph/trace-ordering.ts",
    'const compared = compareStrings(left[index] ?? "", right[index] ?? "");',
    'globalThis.__evidence.sequenceItems += 1; const compared = compareStrings(left[index] ?? "", right[index] ?? ""); if (compared === 0) globalThis.__evidence.maxEqualPrefix = Math.max(globalThis.__evidence.maxEqualPrefix, index + 1);',
)
