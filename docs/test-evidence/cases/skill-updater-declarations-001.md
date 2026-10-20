### Case SKILL-UPDATER-DECLARATIONS-001: Updater TS 入口公开稳定 API 与类型

Tests:
- `test:9882e1a719d7e6eaa21598fe221a3751b2053ccdbeb78ea383c841b9592f7b7b`

Tags:
- `skill-updater`

Contract:
- 公开 TS 入口必须追溯维护源，并提供 updater 配置、执行入口和 UpdaterConfig 类型。

Proves:
- 入口明确导出公共 API；独立 TS 消费者通过原生可擦除语法类型检查，配置与函数签名兼容公开契约。
