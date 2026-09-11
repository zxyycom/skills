### Case GATE-SECRET-DETECTION-001: 私钥检测阻断 finding 并对 unavailable fail closed

Tests:
- `test:6cd2e722e98f97de6feffd132bb929ac2df2588f698eaeab00eff7d15886ebed`

Tags:
- `repository-tooling`

Contract:
- 高置信 PEM private-key finding 与输入不可用都必须阻断 aggregate。

Proves:
- 普通文本 fixture passed，加入合成私钥材料后 Check failed。
- 不存在的项目根使 Check unavailable，并由 aggregate fail closed。
