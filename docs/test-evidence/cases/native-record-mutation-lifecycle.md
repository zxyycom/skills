### Case NATIVE-RECORD-MUTATION-LIFECYCLE-001: 决策生命周期与前序约束

Tests:
- `test:009f623850f1dd0e0bd8b6e8d53eabe0f25640126bb0040603accce4e8c6e2ff`
- `test:02ea65ec9b7738420a56f41783bd4e88ce48ef31256709b246aefd94fc3ff2fb`
- `test:17718bf8707a8a20ad8a4adf28592264cc5321584fe6a99a0438ec0a1e750774`
- `test:1e05d317a32e96762132238dfd59885b3cf41b14ba29310a29f3db6a3d07dd97`
- `test:39c1f3a311b0ccdc5ea5c3e660d345333ffc5fd4b224c46632b11c1461eff8f3`
- `test:5b9b13e3d716d9150fc3b0c5921646adc10ffe2cc07559a7c2de35107c901c9d`
- `test:621407bbdfb225d8667f7fabff9b23b89e490c602f6bcb0ad0d8ad6417a71b78`
- `test:99db5c2f6adb4327b45c806eb88be3a4360b4ecfd29dfeecbfb609c19ec2813b`

Tags:
- `record-rust`

Contract:
- 生命周期和演进操作须遵守状态、历史确认与选定记录范围。

Proves:
- 手写状态和私有事务验证归档、恢复为活动状态、对齐、前序及预检事实。
