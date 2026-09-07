### Case SKILL-PACKAGE-HASH-001: 从 pending Git 内容收集有序 skill 文件

Tests:
- `test:e1e3694ba0cc52330a683443110d012093bb11ca64fab628ff0be503c4a23f16`

Tags:
- `repository-tooling`

Contract:
- Skill 包文件集必须来自 Git 索引内容，并以稳定相对路径顺序呈现。

Proves:
- staged 文本、二进制和空格路径被保留，已删除、未跟踪及工作树覆盖不进入文件集。
