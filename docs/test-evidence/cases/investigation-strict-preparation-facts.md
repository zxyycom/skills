### Case INVESTIGATION-STRICT-PREPARATION-FACTS-001: rename 写后只读实际改写来源

Tests:
- `test:0bf5a18fa0320b9baa5280d203c7024f5b3656aa2c30c28bdbc81721583cb954`
- `test:9ca0935b798f7ec13cee1e4fb046392145eda28e91185740ad8bd4bdd7b208ed`
- `test:c9a1cc3d745d3b58dac58dc175597f29ad518af08b918f9099086a9a9fe4e158`
- `test:df0970efb125bbe7bcc664f48bb28420eaf844ba01e18e2fe167439a804d4916`
- `test:e04be613186be842cda13eb4fd2517cdcc1979f965ce587bf7ae9a3c31c5edf4`

Tags:
- `investigation-report`

Contract:
- rename 与正式 discard 只采集所选及实际改写来源并将安全 snapshot 交给事务；写后独立读取实际写集和目标索引，未选来源不进入当前性验收。

Proves:
- hook 后写后阶段对每个实际改写来源各读一次；计数范围为写后来源读取。
