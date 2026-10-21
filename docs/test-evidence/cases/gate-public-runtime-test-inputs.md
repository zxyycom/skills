### Case GATE-PUBLIC-TEST-INPUTS-001: 共享运行时测试不扩散到领域消费者

Tests:
- `test:156a60e20495abe64570ab4e9c2193c8cf854a901da68e54d4afc4b2fd7686b9`

Tags:
- `repository-tooling`

Contract:
- 公共运行时能力与其独立测试分别建模，测试文件只使实际测试消费者及必要聚合/宽消费者失效。

Proves:
- file-text-search、graph、version-control、index-runtime 与 updater 的测试变化使各自原语脚本和 Gate catalog 自测执行，仓库校验、生成原语、两领域集合/生命周期及 Change Plan 等无关消费者复用。
