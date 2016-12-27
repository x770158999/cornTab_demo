# corntab_demo
延时任务
基于redis的pub/sub制作


用于在服务器可能处于重启或coredump情况下 对数据库进行自定义操作（mongodb）或通过request模块 向服务器调用接口  用以完成一些复杂操作


！redis需开启keyspace notify 功能
