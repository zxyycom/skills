export const remotePutScript = String.raw`
set -eu
root=$1
destination_relative=$2
replace=$3
expected_bytes=$4
expected_sha=$5
fail() { printf '%s\n' "$1" >&2; exit 64; }
relative_path_ok() {
  case "$1" in ''|/*) return 1 ;; esac
  case "/$1/" in */../*|*/.git/*) return 1 ;; esac
  return 0
}
hash_file() {
  if command -v sha256sum >/dev/null 2>&1; then sha256sum "$1" | awk '{print $1}';
  elif command -v shasum >/dev/null 2>&1; then shasum -a 256 "$1" | awk '{print $1}';
  else fail 'remote SHA-256 tool is unavailable'; fi
}
relative_path_ok "$destination_relative" || fail 'destination path rejected'
root_real=$(cd "$root" && pwd -P) || fail 'project root unavailable'
destination="$root/$destination_relative"
destination_parent=$(dirname "$destination")
destination_basename=$(basename "$destination")
parent_real=$(cd "$destination_parent" && pwd -P) || fail 'destination parent unavailable'
case "$parent_real/" in "$root_real/"*) ;; *) fail 'destination escaped project root' ;; esac
# Keep the verified directory open as cwd. All later paths are relative to this
# directory object, so a lexical symlink replacement cannot redirect the write.
cd "$parent_real" || fail 'destination parent unavailable'
within_root() {
  current_parent=$(pwd -P) || return 1
  case "$current_parent/" in "$root_real/"*) return 0 ;; *) return 1 ;; esac
}
[ ! -L "$destination_basename" ] || fail 'destination symlink rejected'
temp=$(mktemp "./.mcpshell-transfer.XXXXXX") || fail 'remote temporary file unavailable'
cleanup() { rm -f "$temp"; }
trap cleanup 0 HUP INT TERM
cat > "$temp"
actual_bytes=$(wc -c < "$temp" | tr -d ' ')
actual_sha=$(hash_file "$temp")
[ "$actual_bytes" = "$expected_bytes" ] || fail 'remote byte count mismatch'
[ "$actual_sha" = "$expected_sha" ] || fail 'remote SHA-256 mismatch'
within_root || fail 'destination escaped project root before commit'
if [ "$replace" = false ]; then
  if ln "$temp" "$destination_basename" 2>/dev/null; then
    :
  elif [ -e "$destination_basename" ] || [ -L "$destination_basename" ]; then
    fail 'destination exists'
  else
    fail 'atomic no-replace link failed'
  fi
else
  mv -f "$temp" "$destination_basename"
fi
within_root || fail 'destination final containment cannot be confirmed'
printf 'MCPSHELL_META %s %s\n' "$actual_bytes" "$actual_sha" >&2
`;

export const remoteGetScript = String.raw`
set -eu
root=$1
source_relative=$2
fail() { printf '%s\n' "$1" >&2; exit 64; }
relative_path_ok() {
  case "$1" in ''|/*) return 1 ;; esac
  case "/$1/" in */../*|*/.git/*) return 1 ;; esac
  return 0
}
hash_file() {
  if command -v sha256sum >/dev/null 2>&1; then sha256sum "$1" | awk '{print $1}';
  elif command -v shasum >/dev/null 2>&1; then shasum -a 256 "$1" | awk '{print $1}';
  else fail 'remote SHA-256 tool is unavailable'; fi
}
relative_path_ok "$source_relative" || fail 'source path rejected'
root_real=$(cd "$root" && pwd -P) || fail 'project root unavailable'
source="$root/$source_relative"
source_parent=$(dirname "$source")
source_basename=$(basename "$source")
parent_real=$(cd "$source_parent" && pwd -P) || fail 'source parent unavailable'
case "$parent_real/" in "$root_real/"*) ;; *) fail 'source escaped project root' ;; esac
# Read through a hard-link snapshot in the verified physical parent, never through
# the lexical source path after its parent has been resolved.
cd "$parent_real" || fail 'source parent unavailable'
within_root() {
  current_parent=$(pwd -P) || return 1
  case "$current_parent/" in "$root_real/"*) return 0 ;; *) return 1 ;; esac
}
[ -f "$source_basename" ] || fail 'source is not a regular file'
[ ! -L "$source_basename" ] || fail 'source symlink rejected'
snapshot=$(mktemp "./.mcpshell-read.XXXXXX") || fail 'remote source snapshot unavailable'
rm -f "$snapshot" || fail 'remote source snapshot unavailable'
cleanup() { rm -f "$snapshot"; }
trap cleanup 0 HUP INT TERM
ln "$source_basename" "$snapshot" 2>/dev/null || fail 'remote source snapshot unavailable'
[ -f "$snapshot" ] || fail 'source is not a regular file'
[ ! -L "$snapshot" ] || fail 'source symlink rejected'
within_root || fail 'source escaped project root'
bytes=$(wc -c < "$snapshot" | tr -d ' ')
sha=$(hash_file "$snapshot")
cat "$snapshot"
within_root || fail 'source escaped project root'
printf 'MCPSHELL_META %s %s\n' "$bytes" "$sha" >&2
`;

export const remoteShellStatusScript = String.raw`
set +e
root=$1
marker=$2
cd -- "$root"
status=$?
if [ "$status" -eq 0 ]; then
  /bin/sh
  status=$?
fi
printf 'MCPSHELL_TARGET_STATUS %s %s\n' "$marker" "$status" >&2
exit 0
`;

export const remotePatchStatusScript = String.raw`
set +e
root=$1
marker=$2
cd -- "$root"
status=$?
if [ "$status" -eq 0 ]; then
  git apply --whitespace=nowarn --
  status=$?
fi
printf 'MCPSHELL_TARGET_STATUS %s %s\n' "$marker" "$status" >&2
exit 0
`;
