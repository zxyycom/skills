### Case GENERATED-FILE-DECLARATION-001: 声明文件生成结果稳定

Tests:
- `test:767a4f7a09903417a0bade4dc23500a963b0c576e7245196c753f1023e6950c7`

Tags:
- `repository-tooling`

Contract:
- 生成声明必须规范化换行，同时保留维护来源 banner。

Proves:
- 不同输入换行产生一致声明内容，且 banner 未被移除。
