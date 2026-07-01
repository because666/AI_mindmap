# 地图实体重构 - 技术设计文档

## 一、现状分析

### 1.1 当前架构核心假设
**"工作区 = 地图"**：工作区（Workspace）和地图（Map）是同一概念。节点直接通过 `workspaceId` 归属到工作区，没有独立的"地图"实体。

### 1.2 现有数据模型关系
```
Visitor (访客)
  └── Workspace (工作区) ←── 通过 workspaceId 直接关联
        ├── Node (节点)          workspaceId
        ├── Relation (关系)      workspaceId
        ├── Conversation (对话)  workspaceId + nodeId
        └── Message (消息)       workspaceId + nodeId + conversationId
```

### 1.3 关键数据流
- **节点创建**：前端 → `POST /api/nodes` → workspaceMemberAuth 注入 `req.workspaceId` → `nodeService.createNode(workspaceId, ...)` → Neo4j + 内存缓存 + MongoDB
- **节点加载**：前端 `App.tsx` 监听 `currentWorkspace` 变化 → `nodeApi.getAll()` → axios 拦截器注入 `X-Workspace-Id` 请求头 → 后端按 workspaceId 查询
- **工作区切换**：`switchWorkspace()` → 清空所有数据 → 重新从 API 加载
- **缓存层级**：内存 LRU (workspaceId) → Redis (workspaceId) → Neo4j → MongoDB

---

## 二、目标架构设计

### 2.1 新数据模型关系
```
Visitor (访客)
  └── Workspace (工作区)
        └── Map (地图) ←── 新增实体
              ├── Node (节点)          mapId + workspaceId
              ├── Relation (关系)      mapId + workspaceId
              ├── Conversation (对话)  mapId + workspaceId + nodeId
              └── Message (消息)       mapId + workspaceId + nodeId + conversationId
```

### 2.2 Map 实体定义
```typescript
interface MindMap {
  id: string;              // UUID
  workspaceId: string;     // 所属工作区ID
  name: string;            // 地图名称
  description?: string;    // 地图描述
  isDefault: boolean;      // 是否为默认地图
  nodeCount: number;       // 节点数（冗余字段，用于列表展示）
  createdBy?: string;      // 创建者ID
  createdAt: Date;
  updatedAt: Date;
}
```

### 2.3 Node 实体变更
```typescript
interface Node {
  id: string;
  workspaceId: string;     // 保留，用于工作区级权限校验
  mapId: string;           // 新增：所属地图ID
  // ... 其余字段不变
}
```

### 2.4 层级关系规则
- **一个工作区可有多个地图**，但建议软限制（如最多 20 个）
- **每个工作区有一个默认地图**，不可删除
- **节点必须归属到具体地图**，通过 `mapId` 字段关联
- **对话和消息继承节点的地图归属**
- **权限校验仍以工作区为粒度**，地图不单独设权限

---

## 三、数据库设计

### 3.1 MongoDB `maps` 集合
```typescript
// 集合名：maps
{
  _id: ObjectId,
  id: string,              // UUID，业务主键
  workspaceId: string,     // 所属工作区
  name: string,
  description: string,
  isDefault: boolean,
  nodeCount: number,       // 冗余计数，定期校准
  createdBy: string,
  createdAt: Date,
  updatedAt: Date
}
```

**索引：**
```typescript
maps: { id: 1 }                    // unique，业务主键查询
maps: { workspaceId: 1, updatedAt: -1 }  // 按工作区查地图列表
maps: { workspaceId: 1, isDefault: 1 }   // 查默认地图
```

### 3.2 MongoDB `nodes` 集合变更
```typescript
// 新增字段
nodes: { mapId: 1 }                 // 按地图查节点元数据
nodes: { workspaceId: 1, mapId: 1 } // 复合索引
```

### 3.3 MongoDB `conversations` 集合变更
```typescript
// 新增字段
conversations: { mapId: 1 }         // 按地图查对话
conversations: { workspaceId: 1, mapId: 1 }
```

### 3.4 MongoDB `messages` 集合变更
```typescript
// 新增字段
messages: { mapId: 1 }
messages: { workspaceId: 1, mapId: 1 }
```

### 3.5 Neo4j 节点属性变更
```cypher
// Node 节点新增 mapId 属性
MATCH (n:Node) WHERE n.workspaceId = $workspaceId
SET n.mapId = $defaultMapId
```

### 3.6 缓存策略变更
```
内存缓存键：workspace_cache:{workspaceId}:{mapId}  （原来是 workspace_cache:{workspaceId}）
Redis 缓存键：workspace_cache:{workspaceId}:{mapId}
```

---

## 四、后端 API 设计

### 4.1 地图 CRUD 路由
```
基础路径：/api/workspaces/:workspaceId/maps
鉴权：workspaceMemberAuth

GET    /                         获取工作区下的所有地图
POST /                         创建新地图
GET    /:mapId                   获取地图详情
PUT    /:mapId                   更新地图（名称、描述）
DELETE /:mapId                   删除地图（非默认地图）
GET    /:mapId/stats             获取地图统计（节点数、最后更新时间）
```

### 4.2 节点路由变更
```
现有路由不变，但需要：
- 请求头新增 X-Map-Id（可选，不传时使用默认地图）
- createNode 自动注入 mapId
- getAllNodes 支持 mapId 过滤
```

### 4.3 对话路由变更
```
现有路由不变，但：
- 对话创建时自动注入 mapId
- GET /list 支持 mapId 过滤
```

### 4.4 工作区创建流程变更
```
createWorkspace() 后自动调用：
  mapService.createMap(workspaceId, '主地图', true)  // 创建默认地图
  返回 { workspace, defaultMapId }
```

---

## 五、前端设计

### 5.1 新增 mapStore
```typescript
interface MapStore {
  // 状态
  maps: MindMap[];                    // 当前工作区的地图列表
  currentMapId: string | null;        // 当前选中的地图ID
  isLoading: boolean;

  // 计算属性
  currentMap: MindMap | null;         // 当前地图对象

  // 操作
  fetchMaps: (workspaceId: string) => Promise<void>;
  createMap: (name: string) => Promise<MindMap | null>;
  switchMap: (mapId: string) => void;
  updateMap: (mapId: string, updates: Partial<MindMap>) => Promise<boolean>;
  deleteMap: (mapId: string) => Promise<boolean>;
}
```

### 5.2 地图切换数据流
```
用户点击地图卡片
  → mapStore.switchMap(mapId)
  → localStorage.setItem('currentMapId', mapId)
  → clearAllData()  // 清空节点、关系、对话
  → App.tsx useEffect 监听 currentMapId 变化
  → loadMapData(mapId)  // 重新加载该地图的节点和对话
```

### 5.3 API 层变更
```typescript
// api.ts 新增
export const mapApi = {
  getList: (workspaceId: string) =>
    api.get(`/workspaces/${workspaceId}/maps`),
  create: (workspaceId: string, name: string) =>
    api.post(`/workspaces/${workspaceId}/maps`, { name }),
  getDetail: (workspaceId: string, mapId: string) =>
    api.get(`/workspaces/${workspaceId}/maps/${mapId}`),
  update: (workspaceId: string, mapId: string, updates: Partial<MindMap>) =>
    api.put(`/workspaces/${workspaceId}/maps/${mapId}`, updates),
  delete: (workspaceId: string, mapId: string) =>
    api.delete(`/workspaces/${workspaceId}/maps/${mapId}`),
};

// 现有 nodeApi 变更
// 请求头新增 X-Map-Id（由 axios 拦截器自动注入）
```

### 5.4 MapLibrary.tsx 重写
- 展示当前工作区下的地图列表（非工作区列表）
- 地图卡片：名称、节点数、最后编辑时间、当前地图高亮
- 搜索过滤、排序
- 创建新地图
- 切换地图（触发画布和对话更新）

### 5.5 App.tsx 数据加载变更
```typescript
// 现有：监听 currentWorkspace 变化
useEffect(() => { loadWorkspaceData(); }, [currentWorkspace]);

// 新增：监听 currentMapId 变化
useEffect(() => { loadMapData(currentMapId); }, [currentMapId]);
```

### 5.6 axios 拦截器变更
```typescript
// 现有：注入 X-Workspace-Id
// 新增：注入 X-Map-Id
const mapId = localStorage.getItem('currentMapId');
if (mapId) {
  config.headers['X-Map-Id'] = mapId;
}
```

---

## 六、数据迁移方案

### 6.1 迁移策略
采用**惰性迁移 + 后台批量迁移**结合：

1. **惰性迁移**（即时）：当用户访问工作区时，检查是否有默认地图，没有则自动创建
2. **后台批量迁移**（一次性）：编写迁移脚本，为所有现有工作区创建默认地图，为所有现有节点设置 `mapId`

### 6.2 迁移脚本逻辑
```typescript
// 1. 遍历所有工作区
const workspaces = await db.collection('workspaces').find({}).toArray();

for (const workspace of workspaces) {
  // 2. 检查是否已有默认地图
  const defaultMap = await db.collection('maps').findOne({
    workspaceId: workspace.id,
    isDefault: true
  });

  // 3. 没有则创建
  if (!defaultMap) {
    const map = {
      id: uuidv4(),
      workspaceId: workspace.id,
      name: '主地图',
      isDefault: true,
      nodeCount: 0,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    await db.collection('maps').insertOne(map);

    // 4. 将该工作区的所有节点设置 mapId
    await db.collection('nodes').updateMany(
      { workspaceId: workspace.id },
      { $set: { mapId: map.id } }
    );

    // 5. 更新 nodeCount
    const count = await db.collection('nodes').countDocuments({
      workspaceId: workspace.id,
      mapId: map.id
    });
    await db.collection('maps').updateOne(
      { id: map.id },
      { $set: { nodeCount: count } }
    );
  }
}

// 6. Neo4j 迁移：为所有 Node 设置 mapId
// MATCH (n:Node) WHERE n.workspaceId = $wid AND n.mapId IS NULL
// SET n.mapId = $defaultMapId
```

### 6.3 向后兼容
- **节点查询兼容**：`getAllNodes` 方法支持两种模式：
  - 传入 `mapId`：仅返回该地图的节点（新逻辑）
  - 不传 `mapId`：返回工作区所有节点（兼容旧数据）
- **前端兼容**：`currentMapId` 为 null 时，行为与当前一致（展示工作区所有节点）

---

## 七、影响范围评估

### 7.1 后端文件变更清单

| 文件 | 变更类型 | 变更内容 |
|------|---------|---------|
| `server/src/types/index.ts` | 修改 | Node 接口新增 mapId；新增 MindMap 接口 |
| `server/src/services/mapService.ts` | **新增** | 地图 CRUD 服务 |
| `server/src/routes/maps.ts` | **新增** | 地图 RESTful 路由 |
| `server/src/index.ts` | 修改 | 注册地图路由 |
| `server/src/services/nodeService.ts` | 修改 | createNode 支持 mapId；getAllNodes 支持 mapId 过滤；缓存键变更 |
| `server/src/services/workspaceService.ts` | 修改 | createWorkspace 自动创建默认地图 |
| `server/src/services/conversationService.ts` | 修改 | 对话关联 mapId |
| `server/src/routes/nodes.ts` | 修改 | 读取 X-Map-Id 请求头 |
| `server/src/routes/conversations.ts` | 修改 | 对话列表支持 mapId 过滤 |
| `server/src/middleware/index.ts` | 修改 | workspaceMemberAuth 注入 mapId |
| `server/src/data/mongodb/connection.ts` | 修改 | 新增 maps 集合索引 |

### 7.2 前端文件变更清单

| 文件 | 变更类型 | 变更内容 |
|------|---------|---------|
| `client/src/stores/mapStore.ts` | **新增** | 地图状态管理 |
| `client/src/services/api.ts` | 修改 | 新增 mapApi；axios 拦截器注入 X-Map-Id |
| `client/src/components/Workspace/MapLibrary.tsx` | 重写 | 展示当前工作区的地图列表 |
| `client/src/App.tsx` | 修改 | 监听 currentMapId 变化加载地图数据 |
| `client/src/stores/visitorWorkspaceStore.ts` | 修改 | switchWorkspace 时初始化 mapStore |
| `client/src/stores/nodeStore.ts` | 修改 | 节点操作关联 mapId |
| `client/src/stores/chatStore.ts` | 修改 | 对话操作关联 mapId |
| `client/src/stores/appStore.ts` | 修改 | 集成 mapStore |
| `client/src/services/tracker.ts` | 修改 | 修复数据格式（紧急） |
| `client/src/locales/` | 修改 | 新增地图相关翻译 |

### 7.3 部署文件变更清单

| 文件 | 变更内容 |
|------|---------|
| `deploy_server.py` | 新增所有新增/修改文件 |

---

## 八、风险与注意事项

### 8.1 数据一致性风险
- **迁移期间的并发写入**：用户在迁移脚本执行期间创建的节点可能没有 mapId
- **解决方案**：采用惰性迁移，首次访问时自动补充 mapId

### 8.2 缓存失效
- 缓存键从 `workspace_cache:{workspaceId}` 变为 `workspace_cache:{workspaceId}:{mapId}`
- **现有缓存需要失效**：部署后所有内存缓存自动失效（服务重启），Redis 缓存需手动清理或等待 TTL 过期

### 8.3 性能影响
- 节点查询新增 `mapId` 过滤条件，需要确保索引到位
- 地图切换需要重新加载节点，比当前工作区切换多一次网络请求（获取地图列表）

### 8.4 向后兼容
- 旧版前端（未更新的客户端）访问新版后端：节点查询不传 mapId，返回所有节点（兼容）
- 新版前端访问旧版后端（理论上不应发生）：mapApi 会 404，需处理降级

---

## 九、实施顺序建议

### 阶段 1：紧急修复（Task 1）
- 修复 tracker 数据格式，解决 400 错误
- 部署验证

### 阶段 2：后端基础（Task 2 + 3）
- 新增 Map 实体和服务
- 节点和对话增加 mapId 支持
- 工作区创建时自动创建默认地图
- 编写数据迁移脚本

### 阶段 3：前端集成（Task 4 + 5 + 6）
- 新增 mapStore
- 重写 MapLibrary 组件
- 修改 App.tsx 数据加载逻辑
- 修改 axios 拦截器

### 阶段 4：部署验证（Task 7）
- 执行数据迁移
- 更新部署脚本
- 全量测试
- 部署上线
