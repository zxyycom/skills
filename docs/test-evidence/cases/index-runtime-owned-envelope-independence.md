### Case INDEX-RUNTIME-ENVELOPE-INDEPENDENCE-001: 独立解析不共享 envelope 或复用旧输入

Tests:
- `test:2aaa888e9a7f3146ea34a1108d03b8a682d706fa76d74af66fac3df0e1358248`

Tags:
- `index-runtime`

Contract:
- 每次原始文本解析建立本调用的冻结 envelope；不能用旧阶段解析结果掩盖新的实际输入。

Proves:
- 相同文本两次解析产生独立 envelope/state，改变下一份输入后新结果反映改变、旧结果保持原值；不代替真实 fresh/CAS 阶段集成证明。
