### Case INVESTIGATION-RESOURCE-TRACKED-MISSING-ROOT-001: unreferenced resource members produce warnings without blocking report checks

Tests:
- `test:9fce3c04922a6c38202fdeb907eae7cc944be4d67bb9a8f16ef09aea075289c4`

Tags:
- `investigation-report`

Contract:
- 未引用资源产生完整检查 warning。

Proves:
- 真实目录增加 orphan/file.txt 后，完整检查成功并包含该文件的 warning。
