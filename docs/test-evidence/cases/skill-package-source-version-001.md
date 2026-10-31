### Case SKILL-PACKAGE-SOURCE-VERSION-001: 源码及独立安装基线承载版本

Tests:
- `test:1ebe7551a88d9a029ed564e27f373452292c91cb7cbbf9a215db73a6c4596527`

Tags:
- `repository-tooling`

Contract:
- 正式 TS、package.json 和 pnpm 锁文件均属于 skill 制品身份，其内容改变需要提升独立版本。

Proves:
- 分别修改运行时 TS、manifest 与锁文件字节会改变聚合 hash，并在版本未提升时各产生一个版本问题。
