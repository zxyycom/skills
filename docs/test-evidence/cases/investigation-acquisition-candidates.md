### Case INVESTIGATION-ACQUISITION-CANDIDATES-001: 候选共享身份快照并按需读取正式 owner

Tests:
- `test:26f38c7f4a56b6334773f2399491fab0d5d6895f955d7e3bfd4032dac7e6b2e5`

Tags:
- `investigation-report`

Contract:
- 同一候选操作复用候选字节、身份与资源依据，只读取选定候选需要的正式资源 owner。

Proves:
- 八条候选列表各候选只读一次；show 读取共同候选身份、唯一必需正式 owner 而不读无关正式报告，合法共享资源仍 ready。
