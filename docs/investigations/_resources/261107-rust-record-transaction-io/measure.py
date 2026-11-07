import ctypes
import hashlib
import json
import os
import pathlib
import shutil
import signal
import subprocess
import sys
import time

base = pathlib.Path(__file__).resolve().parent
fixture = base / 'fixture'
arm = sys.argv[1]
binary = pathlib.Path(sys.argv[2]).resolve()
out = base / (arm + '.jsonl')
libc = ctypes.CDLL(None, use_errno=True)


def ptrace(req, pid=0, addr=0, data=0):
    r = libc.ptrace(req, pid, addr, data)
    if r == -1:
        raise OSError(ctypes.get_errno(), os.strerror(ctypes.get_errno()))
    return r


def run(argv, dest):
    stdout = dest / 'stdout'
    stderr = dest / 'stderr'
    start = time.monotonic_ns()
    pid = os.fork()
    if pid == 0:
        os.dup2(os.open(stdout, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600), 1)
        os.dup2(os.open(stderr, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600), 2)
        ptrace(0)
        os.kill(os.getpid(), signal.SIGSTOP)
        os.execv(argv[0], argv)
    os.waitpid(pid, 0)
    ptrace(0x4200, pid, 0, 0x40)
    ptrace(7, pid)
    while True:
        _, status = os.waitpid(pid, 0)
        if status >> 16 == 6:
            io = {
                k: int(v)
                for k, v in (
                    line.split(':')
                    for line in pathlib.Path(f'/proc/{pid}/io').read_text().splitlines()
                )
            }
            ptrace(7, pid)
            _, status = os.waitpid(pid, 0)
            break
        if not os.WIFSTOPPED(status):
            raise RuntimeError(f'early exit: {status}')
        ptrace(7, pid, 0, 0 if os.WSTOPSIG(status) == signal.SIGTRAP else os.WSTOPSIG(status))
    return {
        'exit': os.waitstatus_to_exitcode(status),
        'io': io,
        'elapsed_ns': time.monotonic_ns() - start,
        'stdout': stdout.read_text(),
        'stderr': stderr.read_text(),
    }


def files(p):
    return {
        str(x.relative_to(p)): hashlib.sha256(x.read_bytes()).hexdigest()
        for x in p.rglob('*')
        if x.is_file() and '.git' not in x.parts
    }


with out.open('w') as log:
    for scenario in ['update', 'rename']:
        dest = base / (arm + '-' + scenario)
        dest.mkdir()
        root = dest / 'root'
        shutil.copytree(fixture, root)
        before = files(root)
        if scenario == 'update':
            cmd = [str(binary / 'decision-records'), 'mark-aligned', '260101-record-00019',
                   '--root', str(root), '--json']
            allowed = {'docs/decisions/260101-record-00019.md', 'docs/decisions/decision-index.json'}
        else:
            cmd = [str(binary / 'investigation-report'), 'rename', '260101-record-00019',
                   'renamed', '--root', str(root), '--json']
            allowed = {'docs/investigations/260101-record-00019.md',
                       'docs/investigations/renamed.md', 'docs/investigations/investigation-index.json'}
        result = run(cmd, dest)
        after = files(root)
        changes = {k for k in before.keys() | after.keys() if before.get(k) != after.get(k)}
        if scenario == 'update':
            assert 'alignment: aligned' in (root / 'docs/decisions/260101-record-00019.md').read_text() and changes == allowed
        else:
            old = 'docs/investigations/_resources/260101-record-00019/'
            new = 'docs/investigations/_resources/260101-renamed/'
            for f in ['payload.txt', 'small.txt']:
                assert before[old + f] == after[new + f] and old + f not in after
                allowed.update([old + f, new + f])
            assert changes == allowed, (changes, allowed)
            text = (root / 'docs/investigations/renamed.md').read_text()
            assert '_resources/260101-renamed/payload.txt' in text and '_resources/260101-renamed/small.txt' in text
        assert result['exit'] == 0 and json.loads(result['stdout'])['ok'], result
        check = subprocess.run(
            ['node', str(pathlib.Path('/workspace/skills/skills') / (
                'decision-records/scripts/decision-records.ts' if scenario == 'update'
                else 'investigation-report/scripts/check-investigations.ts'
            )), '--root', str(root), 'check'],
            capture_output=True, text=True,
        )
        assert check.returncode == 0, (check.stdout, check.stderr)
        result.update({
            'scenario': scenario, 'cmd': cmd, 'changed': sorted(changes),
            'before_hashes': {k: before[k] for k in changes if k in before},
            'after_hashes': {k: after[k] for k in changes if k in after},
            'check': check.stdout.strip(),
        })
        print(json.dumps(result, ensure_ascii=False), file=log, flush=True)
