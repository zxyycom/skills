### Case NATIVE-CANDIDATE-LOCK-ORDER-001: 规范候选 lock 重复生成保持字节

Tests:
- `test:1a8feecbf4813d0dd86f3035c7804b3f9dbf6fd359a557156d16f1712aedb09b`

Tags:
- `repository-tooling`

Contract:
- 候选 lock 已按生成器规范剪枝时，重复生成不应改变顶层字段顺序或产生字节漂移。

Proves:
- 对包含 settings 和单个可达依赖的固定规范 YAML，通过真实候选 lock API 再次生成得到完全相同的字节；不证明任意原始 YAML 格式均被保留。
