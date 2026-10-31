### Case INVESTIGATION-STAGE-SELECTED-EXECUTABLES-001: 暂存修改与新增可执行资源

Tests:
- `test:3b1d68fbd0efde62df13356969f8c06eacefe6092eac97edea7da67fdb7c767e`

Tags:
- `investigation-report`
- `version-control`

Contract:
- 选中报告的常规非符号链接 owner 资源按照有效工作区执行位与字节进入 pending。

Proves:
- 已有脚本内容变化与新脚本同时暂存后，两者内容符合工作区且均为 100755，writtenPaths 准确列出两个脚本。
