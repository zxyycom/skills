### Case NATIVE-RECORD-SOURCE-INVALID-REFERENCES-001: 非法来源引用指出定义位置

Tests:
- `test:72f81512524935902a094c601d2c49244b050a05a1ac42f9eb4f21e2f4714505`

Tags:
- `investigation-report`
- `record-rust`

Contract:
- 合并后的来源图拒绝未知 key 和循环引用，诊断应定位到引用所属配置文件及来源 key。

Proves:
- 同一本地层分别引入 missing 引用和 all 回指，配置 API 均返回 config-error，保留错误类别、.investigation-report.local.json 和 sources.nested 定位。
