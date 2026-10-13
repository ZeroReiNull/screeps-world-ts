<div align="center">

# Screeps World · TypeScript Bot

**从 RCL 1 到 RCL 8 的房间自动化**  
Room automation from RCL 1 to RCL 8

TypeScript · Vitest · Adaptive Population · Auto Construction · Base Defense

[简体中文](#简体中文) · [English](#english)

</div>

---

## 简体中文

适用于 **Screeps: World** 的 TypeScript 自动化脚本。放置第一个 spawn 后，脚本会管理已有己方房间的采矿、运输、建设、升级与基础防御，并根据能源、工程量和敌情调整 creep 数量及身体。

> 当前覆盖已有房间的基础发展。防御属于基础守家策略；自动扩张、远矿和完整工业供应链尚未实现。

### 快速开始

本地环境需要 **Node.js 24+** 和 npm。这个要求用于安装、测试和部署，不会改变游戏服务器的运行环境；游戏代码构建目标为 ES2020。

```bash
npm ci
npm run check
```

首次部署时，复制配置文件：

```bash
cp .env.sample .env
```

填写 `.env`：

```dotenv
SCREEPS_TOKEN=YOUR_ACCESS_TOKEN
SCREEPS_BRANCH=default
```

已有 `.env` 时保留原文件。请勿把真实 token 或 `.env` 提交到 GitHub。

```bash
npm run deploy
```

`deploy` 会重新构建并上传到指定 branch。也可以将 `dist/main.js` 的内容粘贴到游戏的 `main` 模块。

### 常用命令

| 命令 | 用途 |
| --- | --- |
| `npm ci` | 按 lock 文件重新安装依赖 |
| `npm run check` | 依次进行类型检查、测试和构建，不上传 |
| `npm test` | 运行 Vitest 测试 |
| `npm run test:watch` | 监听并重新运行测试 |
| `npm run typecheck` | 检查源码及测试的 TypeScript 类型 |
| `npm run build` | 构建 `dist/main.js` |
| `npm run deploy` | 构建并上传游戏代码 |
| `npm run watch` | 监听源码变化，自动构建并上传 |

### 自动化能力

| 模块 | 行为 |
| --- | --- |
| 人口管理 | 根据矿点产量、运输距离、实际 WORK/CARRY、工程量与敌情调整需求 |
| 身体生成 | 按能源预算生成身体，最多 50 parts；寿命不足时提前补位 |
| 生产恢复 | 经济链断档时优先生产小 worker，最低 200 energy 起步 |
| 多 spawn | 同房间共享生产队列与能源预算 |
| 自动建设 | 随 RCL 解锁放置工地，由 worker 施工，保留已有建筑 |
| 基础防御 | towers 攻击、治疗与维修；远程守卫；关键建筑附近触发 safe mode |
| 设施调度 | links 传输、terminal 补给；可配置 labs、factory 和 power 处理 |
| 多房运行 | 管理已有己方房间；清理死亡 creep Memory，隔离房间与 creep 错误 |

### RCL 1–8 发展路线

下表是各阶段的主要变化，实际施工受能源、地形和工地数量限制。

| 等级 | 主要发展 |
| --- | --- |
| RCL 1 | worker 挖矿、建设与升级，规划能源容器 |
| RCL 2 | extensions、控制器容器、道路及关键建筑 rampart |
| RCL 3 | towers；容器建成后逐步转向专职采矿与运输 |
| RCL 4 | storage；按储备和盈余调整建设与升级投入 |
| RCL 5 | storage、能源矿与控制器附近的 links |
| RCL 6 | terminal、extractor、矿物容器、矿物采集与 labs |
| RCL 7 | 第二个 spawn、factory |
| RCL 8 | 第三个 spawn、6 towers、60 extensions、10 labs、observer、power spawn、nuker；upgrader 身体最多 15 WORK |

规划器默认每 **100 ticks** 检查一次，每次最多新增 **4 个工地**，单房最多保留 **12 个待建工地**。CPU bucket ≤ 1000 时暂停新增规划。

普通建筑围绕首个 spawn 的锚点寻找空位；容器、links 和道路按矿点、控制器与仓库位置规划。第一个 spawn 需要手动放置。记录锚点后，spawn 被毁且仍有可施工的 worker 时，可以规划替代工地。

这是一套基础布局规则。狭窄地形、出口附近或密集旧布局可能需要手动调整。

### Creep 分工

| 角色 | 任务 |
| --- | --- |
| `worker` | 早期采矿、填能、建设、维修、升级；后期保留恢复能力 |
| `miner` | 固定矿点采矿，向附近容器或 link 交付能源 |
| `hauler` | 搬运能源与矿物，补充 spawn、extensions、towers 和控制器供能设施 |
| `upgrader` | 专职升级；能源盈余时增加投入，RCL 8 保留一个 |
| `defender` | 远程守家，优先攻击 healer，尝试与近战保持距离 |
| `mineralMiner` | 设施、矿量、能源和空间条件满足时采集矿物 |

已有 creep 的身体不会改变。人口调整通过后续生产与自然替换完成；旧小 creep 的实际 WORK/CARRY 不足时会补充产能。

### 配置与状态

默认配置位于 [`src/config.ts`](src/config.ts)。在游戏 Console 中按房间覆盖，替换示例房间名；首次运行后再执行：

```js
Memory.rooms['W1N1'].settings = {
  autoBuild: true,
  storageReserve: 20000,
  upgradeSurplus: 60000,
  maxDefenders: 4,
};
```

| 设置 | 默认值 | 含义 |
| --- | --- | --- |
| `autoBuild` | `true` | 自动放置工地 |
| `planInterval` | `100` | 规划间隔，单位 tick |
| `maxNewSites` | `4` | 每轮最多新增工地 |
| `maxRoomSites` | `12` | 单房规划工地上限 |
| `storageReserve` | `20000` | 能源储备参考值 |
| `upgradeSurplus` | `60000` | 增加升级投入的储备阈值 |
| `maxDefenders` | `4` | 守卫数量上限 |

已有手动布局时，可以关闭规划；其他自动化继续运行：

```js
Memory.rooms['W1N1'].settings.autoBuild = false;

// 查看角色目标、RCL、能源与敌人数量。
JSON.stringify(Memory.rooms['W1N1'].stats);
```

`CONFIG.generatePixel` 默认关闭，可在源码中启用。

### 防御与边界

Towers 优先攻击敌方 healer，和平时治疗己方并按储备维修。武装敌人逼近关键建筑时尝试开启可用 safe mode，普通侦察单位不会触发守卫生产或 safe mode。Rampart 默认覆盖关键建筑，不会封闭整个房间。

尚未实现经济 creep 避敌撤退、守卫依托 rampart、防御边界规划、boost 威胁评估、复杂 PvP、nuke 应对或 safe mode 次数自动补充。面对高等级玩家的持续骚扰，需要结合游戏情况调整防线。

### 高级设施

建筑自动规划，高级生产需要显式配置并准备原料：

```js
// 工厂：先装填配方原料。
Memory.rooms['W1N1'].factoryProduct = 'battery';

// 实验室：装填有效原料；输出 lab 距两个输入 lab 都应在 2 格内。
Memory.rooms['W1N1'].labReaction = {
  inputs: ['inputLabId1', 'inputLabId2'],
  outputs: ['outputLabId1'],
};

// Power spawn：装填 power 和 energy 后启用。
Memory.rooms['W1N1'].processPower = true;
```

Terminal 默认补至 10000 energy；能源需求满足后，运输可将富余矿物补至每种 5000。Observer 轮流观察相邻房间；nuker 只建设，不会自动发射。

原料装填与清空、配方规划、power creep 操作、市场交易、远矿和自动占领仍需自行管理。仓库满时没有完整溢出策略，能源仍可能掉落并消失。

### 测试

Vitest 使用可重置的 Screeps mock。配置位于 `vitest.config.mts`，测试位于 `test/`；`test/tsconfig.json` 让 VS Code 识别测试项目和自定义 Memory 类型。

```bash
npm test
npm test -- test/population.test.ts
```

覆盖身体预算、RCL 1–8 人口与连续建设、断粮恢复、矿点分配、提前替换、多 spawn、防御、运输循环、矿物、links、生产开关及主循环错误隔离。

Mock 不等于完整服务器仿真。首次部署后应观察路径、拥堵、生产队列与能源储备；tick 末尾 intent 结算和 PvP 效果仍需游戏内验证。

---

## English

A TypeScript automation bot for **Screeps: World**. After you place the first spawn, it manages harvesting, hauling, construction, upgrading, and basic defense in your existing owned rooms. Creep counts and bodies adapt to energy supply, workload, and threats.

> The current scope is basic development in existing rooms. Defense is a foundation; automatic expansion, remote mining, and a complete industrial supply chain are not implemented.

### Quick start

Use **Node.js 24+** and npm locally. This requirement applies to installation, testing, and deployment, not the game server. The game bundle targets ES2020.

```bash
npm ci
npm run check

# First-time deployment setup; keep your existing .env if you have one.
cp .env.sample .env
```

Set your credentials and target branch in `.env`:

```dotenv
SCREEPS_TOKEN=YOUR_ACCESS_TOKEN
SCREEPS_BRANCH=default
```

Keep real tokens and `.env` out of GitHub.

```bash
npm run deploy
```

Deployment rebuilds the code and uploads it to the configured branch. Alternatively, paste `dist/main.js` into the game's `main` module.

### Commands

| Command | Purpose |
| --- | --- |
| `npm ci` | Reinstall dependencies from the lock file |
| `npm run check` | Type-check, test, and build; no upload |
| `npm test` | Run Vitest tests |
| `npm run test:watch` | Watch and rerun tests |
| `npm run typecheck` | Check source and test types |
| `npm run build` | Build `dist/main.js` |
| `npm run deploy` | Build and upload game code |
| `npm run watch` | Watch source changes, build, and upload |

### Features

| System | Behavior |
| --- | --- |
| Adaptive population | Accounts for source output, hauling distance, actual WORK/CARRY, construction workload, and threats |
| Body generation | Respects energy budgets and the 50-part limit; schedules replacements before expiration |
| Economic recovery | Prioritizes a small recovery worker when the economy breaks, starting at 200 energy |
| Multiple spawns | Shares a room's queue and energy budget |
| Construction | Places sites as RCL unlocks structures and preserves existing buildings |
| Basic defense | Tower combat, healing and repairs; ranged defenders; safe mode near critical structures |
| Structure control | Link transfers, terminal supply, and configurable labs, factory, and power processing |
| Multiple rooms | Manages existing owned rooms, cleans dead creep Memory, and isolates execution errors |

### RCL progression

Construction depends on available energy, terrain, and site limits.

| Level | Main additions |
| --- | --- |
| RCL 1 | Workers harvest, build, and upgrade; source containers are planned |
| RCL 2 | Extensions, controller container, roads, and ramparts on critical structures |
| RCL 3 | Towers; dedicated miners and haulers as containers become available |
| RCL 4 | Storage; construction and upgrading budgets based on reserves |
| RCL 5 | Links near storage, sources, and the controller |
| RCL 6 | Terminal, extractor, mineral container, mineral mining, and labs |
| RCL 7 | Second spawn and factory |
| RCL 8 | Third spawn, 6 towers, 60 extensions, 10 labs, observer, power spawn, and nuker; upgrader bodies capped at 15 WORK |

By default, planning runs every **100 ticks**, adds up to **4 sites** per pass, and keeps at most **12 pending sites** per room. New planning pauses at CPU bucket ≤ 1000.

General structures are placed around the first spawn's anchor. Containers, links, and roads follow source, controller, and storage positions. Place the first spawn manually. With a recorded anchor and surviving workers able to build, a replacement spawn site can be planned after destruction.

The planner uses basic placement rules. Narrow terrain, exits, and dense existing layouts may need manual adjustments.

### Creep roles

| Role | Responsibility |
| --- | --- |
| `worker` | Early harvesting, filling, construction, repair, and upgrading; later economic recovery |
| `miner` | Harvests an assigned source and delivers to a nearby container or link |
| `hauler` | Moves energy and minerals; supplies spawns, extensions, towers, and controller supply structures |
| `upgrader` | Dedicated upgrading; more investment with surplus energy, one at RCL 8 |
| `defender` | Ranged defense, healer targeting, and attempts to keep distance from melee enemies |
| `mineralMiner` | Mines minerals when infrastructure, energy, mineral availability, and capacity allow |

Existing bodies do not change. Adaptation happens through new spawning and natural replacement. Additional capacity is spawned when older, smaller creeps provide insufficient WORK or CARRY.

### Configuration and monitoring

Defaults live in [`src/config.ts`](src/config.ts). Override settings per room through the game Console after the bot has initialized room Memory:

```js
Memory.rooms['W1N1'].settings = {
  autoBuild: true,
  storageReserve: 20000,
  upgradeSurplus: 60000,
  maxDefenders: 4,
};
```

| Setting | Default | Meaning |
| --- | --- | --- |
| `autoBuild` | `true` | Automatic construction-site placement |
| `planInterval` | `100` | Planning interval in ticks |
| `maxNewSites` | `4` | Maximum new sites per pass |
| `maxRoomSites` | `12` | Pending-site limit for room planning |
| `storageReserve` | `20000` | Energy reserve reference |
| `upgradeSurplus` | `60000` | Reserve threshold for increased upgrading |
| `maxDefenders` | `4` | Defender count limit |

Disable construction planning for a custom layout, or inspect room statistics:

```js
Memory.rooms['W1N1'].settings.autoBuild = false;
JSON.stringify(Memory.rooms['W1N1'].stats);
```

Other automation continues when planning is disabled. Pixel generation is disabled by default and can be enabled through `CONFIG.generatePixel` in the source.

### Defense and limitations

Towers prioritize hostile healers, then heal friendly units and repair according to reserves during peace. Armed enemies approaching critical structures trigger an attempt to activate available safe mode. Unarmed scouts do not trigger defender spawning or safe mode. Ramparts protect critical structures rather than enclosing the room.

Economic creep retreat, rampart-based defender positioning, perimeter planning, boost-aware threat evaluation, advanced PvP, nuke response, and automatic safe mode replenishment are not implemented. Persistent harassment from advanced players requires in-game evaluation and defensive adjustments.

### Advanced structures

Infrastructure is planned automatically. Production requires explicit configuration and prepared materials:

```js
// Factory: load recipe ingredients first.
Memory.rooms['W1N1'].factoryProduct = 'battery';

// Labs: load valid reagents; each output must be within range 2 of both inputs.
Memory.rooms['W1N1'].labReaction = {
  inputs: ['inputLabId1', 'inputLabId2'],
  outputs: ['outputLabId1'],
};

// Power spawn: supply power and energy before enabling processing.
Memory.rooms['W1N1'].processPower = true;
```

The terminal targets 10000 energy. Once energy needs are met, haulers may supply surplus minerals up to 5000 of each type. The observer cycles through neighboring rooms. The nuker is built but never fired automatically.

Ingredient loading and clearing, recipe planning, power creep operations, trading, remote mining, and claiming new rooms require separate management. There is no complete overflow strategy; energy may still be dropped and decay when storage fills.

### Testing

Vitest uses resettable Screeps mocks. Configuration lives in `vitest.config.mts`, with tests under `test/`. `test/tsconfig.json` enables VS Code to recognize the test project and custom Memory types.

```bash
npm test
npm test -- test/population.test.ts
```

Coverage includes body budgets, RCL 1–8 population and progressive construction, recovery, source assignment, early replacement, shared spawn budgets, defense, hauling loops, minerals, links, production toggles, and main-loop error isolation.

Mocks are not a full Screeps server simulation. Observe routing, congestion, spawn queues, and energy reserves after deployment. End-of-tick intent resolution and combat outcomes still require in-game validation.
