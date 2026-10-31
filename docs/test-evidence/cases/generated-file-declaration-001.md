### Case GENERATED-FILE-DECLARATION-001: 声明文件生成结果稳定

Tests:
- `test:f42710aa6ef472d8425a8ebc0f6722a288e4f9b64872ff33b88c1081ba43088d`

Tags:
- `repository-tooling`

Contract:
- 生成声明必须规范化换行，同时保留维护来源 banner。

Proves:
- 不同输入换行产生一致声明内容，且 banner 未被移除。
