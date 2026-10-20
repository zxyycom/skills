### Case SKILL-PACKAGE-SOURCE-VERSION-001: 源码及独立安装基线承载版本

Tests:
- `test:2441985e1a697e552b0d9678d8c4bb2ac1259a59f88e70062feddbb46c05544f`

Tags:
- `repository-tooling`

Contract:
- 正式 TS、package.json 和 pnpm 锁文件均属于 skill 制品身份，其内容改变需要提升独立版本。

Proves:
- 分别修改运行时 TS、manifest 与锁文件字节会改变聚合 hash，并在版本未提升时各产生一个版本问题。
