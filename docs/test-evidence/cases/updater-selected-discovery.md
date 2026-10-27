### Case UPDATER-SELECTED-DISCOVERY-001: 选中 skill 身份校验不枚举无关包

Tests:
- `test:33ad53eb4c3da9b36a3191ae234af16bd0b882f935ebc5f96a1e53c7c9c3f65f`

Tags:
- `repository-tooling`

Contract:
- 选组发现先完整校验所选普通目录与 SKILL.md 普通文件，既不枚举无关损坏包，也不接受链接或逃逸身份。

Proves:
- 隔离真实目录中 alpha 去重成功，无关 broken 缺 SKILL 不阻断；空集合、未知成员、选中损坏包、路径或空名失败；目录 symlink 与 SKILL.md symlink 均拒绝。
