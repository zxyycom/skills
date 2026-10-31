### Case GATE-SELECTED-VERSION-CONTROL-001: 版本控制领域实际阻断所拥有产品源码超限

Tests:
- `test:765fbb52bec39582dd601775fbe86898e5317db883a328e6eb552c9f9ddb6b5f`

Tags:
- `repository-tooling`

Contract:
- version-control 的领域 files 包含 tools/shared/src/version-control 下维护源码；selected 指标必须实际分析该产品代码并执行五参数上限，而非仅覆盖测试文件。

Proves:
- 两项真实指标声明经 collectProjectFiles 收集后恰好包含版本控制产品路径；同树无关 file-text-search 六参数函数不进入选集。
- 健康版本控制源码实际运行 function-metrics 时 aggregate passed 且无 finding；只将该文件改为六参数函数后，Check 与 aggregate 均 failed。
- supplemental record 恰有一项，精确标识版本控制路径、tooMany、parameter-count、上限五及实测六，防止只检查 options 而没有执行指标。
