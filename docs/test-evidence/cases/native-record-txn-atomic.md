### Case NATIVE-RECORD-TXN-ATOMIC-001: 单文件替换与独占新建

Tests:
- `test:801b4ffbf80287291be5cbcad31153d6f8290a938295db8f9e67994b83669dba`
- `test:9dd867f462b16b35ff8860b3daeae31d2573e26a589663ca81dac22cbc0382ee`

Tags:
- `record-rust`

Contract:
- 单文件更新成功须报告实际写入，新建目标冲突不得覆盖已有文件。

Proves:
- 私有文件验证替换后的内容和提交事实，以及 create_new 冲突时原内容保留；不单凭此测试证明替换的原子性。
