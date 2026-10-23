#!/usr/bin/env python3
"""冻结实际工作树产品/生成闭包；不依赖未提交更改的 Git HEAD。"""
import argparse
from datetime import datetime, timezone
import hashlib
import json
import os
from pathlib import Path
import shutil
import stat
import subprocess

INPUTS = ['tools', 'skills', 'scripts', 'package.json', 'pnpm-lock.yaml', 'tsconfig.json']
EXCLUDE = {'.git', '.codegraph', '__pycache__', 'node_modules'}


def manifest(root):
    result = {}
    def visit(path):
        relative = str(path.relative_to(root))
        info = path.lstat()
        mode = oct(stat.S_IMODE(info.st_mode))
        if path.is_symlink():
            result[relative] = {'kind': 'symlink', 'mode': mode, 'target': os.readlink(path)}
        elif path.is_dir():
            for child in sorted(path.iterdir()):
                if child.name not in EXCLUDE:
                    visit(child)
        else:
            data = path.read_bytes()
            result[relative] = {'kind': 'file', 'mode': mode, 'bytes': len(data), 'sha256': hashlib.sha256(data).hexdigest()}
    for relative in INPUTS:
        visit(root / relative)
    return result


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--repository', type=Path, required=True)
    parser.add_argument('--output', type=Path, required=True)
    parser.add_argument('--label', required=True)
    args = parser.parse_args()
    repository, output = args.repository.resolve(), args.output.resolve()
    assert str(output).startswith('/tmp/') and not output.exists()
    source = output / 'source'
    source.mkdir(parents=True)
    before = manifest(repository)
    for relative in INPUTS:
        old, new = repository / relative, source / relative
        if old.is_dir():
            shutil.copytree(old, new, symlinks=True, ignore=shutil.ignore_patterns(*EXCLUDE))
        else:
            shutil.copy2(old, new, follow_symlinks=False)
    copied, after = manifest(source), manifest(repository)
    assert before == copied == after, '源码复制时发生变化；保留现场，不接受此快照'
    data = (json.dumps(copied, ensure_ascii=False, sort_keys=True, indent=2) + '\n').encode()
    files = output / 'files-manifest.json'
    files.write_bytes(data)
    # 锁定源码副本；原始 mode 三方证明记录在 files-manifest，单独声明测量时只读处理。
    for relative, info in copied.items():
        if info['kind'] == 'file':
            file = source / relative
            file.chmod(stat.S_IMODE(file.stat().st_mode) & ~0o222)
    for directory, _, _ in os.walk(source, topdown=False):
        path = Path(directory)
        path.chmod(stat.S_IMODE(path.stat().st_mode) & ~0o222)
    # 根目录暂恢复owner写，建立标准依赖解析symlink，再锁定；不安装或修改依赖。
    source.chmod(stat.S_IMODE(source.stat().st_mode) | 0o200)
    (source / 'node_modules').symlink_to(repository / 'node_modules', target_is_directory=True)
    source.chmod(stat.S_IMODE(source.stat().st_mode) & ~0o222)
    note = {
        'label': args.label, 'capturedAt': datetime.now(timezone.utc).isoformat(),
        'baseHead': subprocess.check_output(['git', '-C', str(repository), 'rev-parse', 'HEAD'], text=True).strip(),
        'snapshot': str(source), 'capture': INPUTS, 'excludedDirectoryNames': sorted(EXCLUDE),
        'verifiedFiles': len(copied), 'bytes': sum(item.get('bytes', 0) for item in copied.values()),
        'fileManifest': str(files), 'fileManifestSha256': hashlib.sha256(data).hexdigest(),
        'verification': 'before-current == copied == after-current: all paths, original bytes/hash/mode/symlink',
        'measurementSourceModes': 'After three-way verification, only write bits removed from copied regular files/directories; bytes/symlinks unchanged.',
        'dependencyResolution': str(repository / 'node_modules') + ' symlink; source measurement only, no install/distribution proof'
    }
    (output / 'snapshot-manifest.json').write_text(json.dumps(note, ensure_ascii=False, indent=2))
    (output / 'artifact-note.md').write_text(
        '# 最终记录操作性能临时来源\n\n'
        '用途：本次Change最终同输入性能测量与分离插桩。源码来自当时实际工作树，三方逐文件核对，非git archive HEAD。\n'
        '保留：Change性能结论交付前不删除；结束后与受控baseline/阶段目录一起清理。所有fixture与输出只留/tmp，不入长期仓库。\n'
        '恢复：查看snapshot-manifest/files-manifest；已冻结source不被真实工作树后续改动影响。没有真实Git写入或远端。\n'
    )
    print(json.dumps(note, ensure_ascii=False))


if __name__ == '__main__':
    main()
