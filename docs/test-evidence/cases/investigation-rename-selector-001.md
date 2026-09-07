### Case INVESTIGATION-RENAME-SELECTOR-001: dated source 精确匹配且 name 歧义报错

Tests:
- `test:9171e683c2a32d8ec787e6e12c4a867cdcf3d8e64d417df8638aa5958b3eba53`

Tags:
- `investigation-report`

Contract:
- Investigation source selector 先精确匹配 calendar-valid dated ID，其他输入仅作为 exact name；重名不得按日期猜测。

Proves:
- 重名 name source preflight 报 ambiguous。
- 带 `.md` 的 dated source 通过 CLI 精确 rename，并输出 old/new ID。
