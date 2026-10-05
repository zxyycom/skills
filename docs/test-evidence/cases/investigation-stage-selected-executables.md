### Case INVESTIGATION-STAGE-SELECTED-EXECUTABLES-001: 暂存修改与新增可执行资源

Tests:
- `test:ec7d3e2c6edec0891c6dc237b94ed35c69c54bed277b7e03346c2a3500a86dec`

Tags:
- `investigation-report`
- `version-control`

Contract:
- 选中报告的常规非符号链接 owner 资源按照有效工作区执行位与字节进入 pending。

Proves:
- 已有脚本内容变化与新脚本同时暂存后，两者内容符合工作区且均为 100755，writtenPaths 准确列出两个脚本。
