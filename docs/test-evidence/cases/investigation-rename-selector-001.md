### Case INVESTIGATION-RENAME-SELECTOR-001: dated source 精确匹配且 name 歧义报错

Tests:
- `test:afd7515a5e5d08b99ecf0de898639cc1af0d72122b9342d6927ba4fd9b9a23aa`

Tags:
- `investigation-report`

Contract:
- Investigation source selector 先精确匹配 calendar-valid dated ID，其他输入仅作为 exact name；重名不得按日期猜测。

Proves:
- 重名 name source preflight 报 ambiguous。
- 带 `.md` 的 dated source 通过 CLI 精确 rename，并输出 old/new ID。
