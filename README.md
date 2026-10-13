# Screeps World TypeScript Bot

适用于 **Screeps: World** 的 RCL 1–8 自动发展脚本。已有房间放置第一个 spawn 后即可运行；旧版 `worker` / `miner` Memory 可继续使用。

## 开始

使用 **Node.js 24 或更新版本**（运行部署脚本的本地环境；游戏内代码构建为 ES2020）。

```bash
npm ci
npm run check
```

`check` 会依次执行源代码和测试的 TypeScript 检查、Vitest 测试、游戏代码构建。输出为 `dist/main.js`。

首次配置部署：

```bash
cp .env.sample .env
```

在 `.env` 填入 Screeps token 和 branch。已有 `.env` 时保留原文件。

```bash
npm run deploy
```

`deploy` 会先重新构建再上传。也可以把 `dist/main.js` 内容粘贴到游戏的 `main` 模块中。

```bash
npm run test:watch  # 仅监听测试，不上传游戏代码
npm run watch       # 监听 src，发生修改时构建并上传
```

## 默认自动化

| 阶段  | 自动执行                                                                                             |
| ----- | ---------------------------------------------------------------------------------------------------- |
| RCL 1 | 小 worker 恢复生产、按矿点生产容器、挖矿与升级                                                       |
| RCL 2 | extensions、控制器容器、道路、关键结构 rampart；低容量矿点可配置多个矿工                             |
| RCL 3 | tower 攻击、治疗与保留能源的维修；逐步转向专职采矿和运输                                             |
| RCL 4 | storage、按能源盈余分配建设与升级人数                                                                |
| RCL 5 | storage/source/controller links，自动传输并防止同 tick 超额填充                                      |
| RCL 6 | terminal、extractor、矿物容器和采矿、labs                                                            |
| RCL 7 | 第二个 spawn、factory                                                                                |
| RCL 8 | 第三个 spawn、6 towers、60 extensions、10 labs、observer、power spawn、nuker；升级身体限制在 15 WORK |

规划每 100 ticks 执行一次，每次最多新增 4 个工地，单房最多保留 12 个待建工地。按照当前 RCL 的上限统计已有结构和工地；优先能源、防御和基础设施。围绕第一个 spawn 的锚点预留间隔建设，避开墙体、矿点和控制器。不拆已有结构。CPU bucket 低于或等于 1000 时暂停新增规划。

空间受限、出口附近、密集旧布局或狭窄地形可能需要手动布置；规划不是通用于任意地形的布局求解器。第一个 spawn 仍需玩家放置；记录锚点后，如果 spawn 被毁且有存活 worker，可自动建立替代工地。

### 人口与身体

- `worker`：早期采集、填充、建设、维修与升级；后期保留至少一个作为恢复后备。建设需求按剩余工程量调整，仓库低储备时缩减。
- `miner`：按矿点恢复速率计算所需 WORK，按可用容量生成身体；低等级允许多矿工，数量受站位限制。每个矿点需要自己的容器才启用；旧小矿工的实际 WORK 不足时会补足。
- `hauler`：根据矿点到 storage/spawn 的距离、产量和 CARRY 容量调整人数。旧小运输的实际 CARRY 不足时会补足。收集能源、遗物及矿物，填 spawn/extensions/towers 和控制器补给；补充 terminal 储备。
- `upgrader`：矿运链建立后启用，能源盈余较多时增加人数，RCL8 保留一个。
- `defender`：有战斗能力的敌人出现时生成远程守卫，身体按当前可用能源增加 RANGED_ATTACK/MOVE，高预算加入 HEAL。优先敌方 healer，面对近战靠近时尝试保持距离。
- `mineralMiner`：有 extractor、矿物容器、可用矿量和充足能源/空间时启用。

身体不超过 50 parts，不超过传入能源预算。基础 worker 断档时优先用当前能量恢复，最低 200 能量。正常生产按房间容量生成身体并等待所需成本；寿命不足以覆盖生产和行走时间时提前补位。房间人口、spawn 队列和能源预算独立计算，同房多个 spawn 共用队列，名称包含 spawn 名称。

### 守家

Towers 优先集火敌方 healer，和平时治疗己方、按能源储备维修。重要结构附近出现武装敌人时尝试开启可用 safe mode。侦察单位不会触发守卫生产或 safe mode。

这是基础防御，未实现 boost 威胁评估、复杂阵型、完整边界封墙、nuke 应对或跨房进攻，不能保证抵御成熟玩家的军队。默认 rampart 覆盖关键结构，而不是封闭整个房间。

## 房间设置

在游戏 Console 中执行，房间名替换为你的：

```js
// 默认自动规划；已有自定义布局时可以关闭。
Memory.rooms['W1N1'].settings = {
  autoBuild: false,
  storageReserve: 20000,
  upgradeSurplus: 60000,
  maxDefenders: 4,
};

// 再次启用规划。
Memory.rooms['W1N1'].settings.autoBuild = true;

// 查看当前角色目标、RCL、能源和敌人数量。
JSON.stringify(Memory.rooms['W1N1'].stats);
```

全部默认值在 `src/config.ts`，可用 `RoomMemory.settings` 按房间覆盖。修改全局 `CONFIG.generatePixel` 可启用生成 pixel，默认关闭以保留 CPU bucket。

## 高级设施

基础设施自动建设；高级生产通过 Memory 显式启用。原料装填/清空、配方规划、power creep 操作和市场交易目前需要自行管理，没有完整工业供应链。Terminal 默认补到 10000 energy；富余矿物可由运输补到每种 5000，条件是能源需求已满足。

```js
// 工厂：先装好配方原料，随后具备材料且无 cooldown 时生产。
Memory.rooms['W1N1'].factoryProduct = 'battery';

// 实验室：先装好两种有效原料；output 必须在两个 input 的 2 格内。
Memory.rooms['W1N1'].labReaction = {
  inputs: ['inputLabId1', 'inputLabId2'],
  outputs: ['outputLabId1'],
};

// 装填 power + energy 后启用处理。
Memory.rooms['W1N1'].processPower = true;
```

Observer 自动轮流观察相邻房间。Nuker 仅建设，不会自动发射。没有自动占领新房、远矿或市场买卖逻辑；多房运行针对已有己方房间。

## Vitest

原压缩包没有 `.test.ts` 文件，因此 `vitest run` 返回 “No test files found”。旧配置还使用了 Jest helper、重复 Memory 声明和 CommonJS 下的 ESM 配置文件。

现在使用：

- `vitest.config.mts`：ESM 配置，明确匹配 `test/**/*.test.ts`。
- `test/setup.ts`：每个测试前重置 Game、Memory、对象注册表和 PathFinder。
- `test/constants.ts` / `test/mock.ts`：只模拟本项目所需的 Screeps 常量、结构、位置和 action intent。
- `tsconfig.test.json`：同时检查测试和源代码；测试显式从 `vitest` 导入 API，不混入 Jest 类型。

```bash
npm test
npm run typecheck
npm run build
# 定位某个行为：
npm test -- test/population.test.ts
```

测试覆盖身体预算、RCL 1–8 人口与连续建设、恢复、矿点分配、提前替换、多 spawn 预算、防御、运输循环、矿物、links、生产开关、Memory 和主循环错误隔离。

测试使用 mock，并不是 Screeps 完整服务器仿真；路径选择、碰撞、tick 末尾 intent 结算和 PvP 结果还需在游戏中验证。建议首次部署后观察 `Memory.rooms[roomName].stats`、生产队列和能源储备，尤其是已有布局与狭窄矿点。
