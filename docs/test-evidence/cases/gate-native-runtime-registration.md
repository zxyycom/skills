### Case GATE-NATIVE-RUNTIME-REGISTRATION-001: 原生 runtime Gate 与稳定测试入口一致

Tests:
- `test:3975f6f74f52f833d17c1ba258b208dbc4ad5ea03599547089080805db84ef31`

Tags:
- `repository-tooling`

Contract:
- 原生 runtime 的 Gate Check 完整执行稳定 package 测试入口声明的命令和测试文件。

Proves:
- 比较 Check 的完整命令及参数与 package 脚本，发现遗漏或不一致。
