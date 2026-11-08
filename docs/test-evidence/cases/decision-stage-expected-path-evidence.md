### Case DECISION-STAGE-EXPECTED-PATH-EVIDENCE-001: 预期路径的失败不能被同 ID 他处来源遮蔽

Tests:
- `test:f46f104e5ce84c3294a22b131385495083983e819190134032dfc126c6a01adb`

Tags:
- `decision-records`

Contract:
- 工作区发布索引指向的所选来源身份不符时，不能以其他路径的同 ID 来源掩盖错误。

Proves:
- 目标路径改为错误 ID 而另一文件仍声明所选 ID 时，all scope 失败且 pending 条目不变。
