### Case TEST-EVIDENCE-PROJECT-MERGE-001: 项目生产器合并共享注册并保留命令本地实体

Tests:
- `test:20c035ea82add25dd9108c23a90135611baf951019079abaa661dff37fcc6daf`
- `test:4f023e9c722f25190f0252957f15dc51658fa8eb3ba69e82198ede818e926d0b`

Tags:
- `repository-tooling`

Contract:
- 不同测试容器注册的相同实体必须合并其 locator 集合；共享循环导入不能使不同源文件中的同名命令本地注册混合。

Proves:
- 两个脚本指向同一文件时只产生一个实体，且含 direct、container 与 legacy selector。
- 两个命令通过共享循环导入发现同一 shared registration 时只形成一个共享实体且保留两个命令 locator，两个源文件中的同名本地注册仍分别形成实体，共计三个。
