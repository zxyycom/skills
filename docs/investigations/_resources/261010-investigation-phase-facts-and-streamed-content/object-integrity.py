"""Private Git object readability contrast; deletes its own temporary fixture."""
import hashlib,json,subprocess,tempfile
from pathlib import Path
with tempfile.TemporaryDirectory(prefix="blob-integrity-") as temporary:
 root=Path(temporary)
 def git(*args,input=None):
  return subprocess.run(["git","-C",str(root),*args],input=input,capture_output=True)
 git("init","-q")
 payload=bytes(i%251 for i in range(600000))
 oid=git("hash-object","-w","--stdin",input=payload).stdout.decode().strip()
 path=root/".git/objects"/oid[:2]/oid[2:]
 original=path.read_bytes();path.chmod(0o600);path.write_bytes(original[:-12])
 observations=[]
 for flag in ["--batch-check","--batch"]:
  result=git("cat-file",flag,input=(oid+"\n").encode())
  observations.append(dict(flag=flag,exit=result.returncode,stdoutBytes=len(result.stdout),header=result.stdout.split(b"\n")[0].decode(),stderr=result.stderr.decode()))
 print(json.dumps(dict(payloadSHA256=hashlib.sha256(payload).hexdigest(),originalCompressedBytes=len(original),truncatedBytes=12,observations=observations),indent=2))
