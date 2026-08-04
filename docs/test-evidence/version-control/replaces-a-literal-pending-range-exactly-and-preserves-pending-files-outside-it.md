### Case VERSION-CONTROL-PENDING-REPLACE-001: 精确替换字面 pending 范围并保留范围外文件
Entry:
- `tools/shared/tests/version-control.test.ts > replaces a literal pending range exactly and preserves pending files outside it`
- `bun test --test-name-pattern="^replaces a literal pending range exactly and preserves pending files outside it$" ./tools/shared/tests/version-control.test.ts`
Contract:
- pending 范围替换以精确目标文件集合表达增加、修改和删除，并保持范围外 pending 内容与 workspace 不变。
Proves:
- 写入结果与读回内容只包含目标范围内的新增和修改文件，遗漏的原范围文件成为删除。
- 目标普通文件不会继承同路径既有 pending 的符号链接或仅 mode 变化，替换后统一保持普通文件语义。
- 范围外已暂存内容和范围内 workspace 内容保持原值，结果只返回项目级路径语义。
