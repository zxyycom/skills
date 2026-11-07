### Case NATIVE-RECORD-RESOURCE-EVIDENCE-001: 调查资源的成员与身份快照

Tests:
- `test:1740c737699157afbfda136429b5cb741af77e407310773be9a056d5a32b4319`
- `test:727cbbdececd9f6f41c62a594e0129b29db6f87ea11fb7aea42225bb41521fb9`

Tags:
- `record-rust`

Contract:
- 资源校验须区分缺失 owner、选定 owner 的直接成员及可见性。

Proves:
- 私有资源目录验证预期缺失与已存在冲突、直接成员选择和受管可见性。
