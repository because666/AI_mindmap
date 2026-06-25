#!/bin/bash
set -e

# ============================================================
# DeepMindMap V2 部署脚本
# ============================================================
# 依赖环境变量：
#   ZHIPU_API_KEY_2 : 智谱 AI API Key（必填）
# ============================================================

PROJECT_DIR="/www/wwwroot/AI_mindmap"
TIMESTAMP=$(date +%Y%m%d%H%M%S)
BACKUP_TAG="deploy-backup-${TIMESTAMP}"

# 错误处理函数：打印错误并提示回滚方式
error_exit() {
  echo ""
  echo "❌ [错误] $1"
  echo ""
  echo "部署失败，建议手动回滚到备份版本："
  echo "    bash rollback_remote.sh ${TIMESTAMP}"
  echo ""
  exit 1
}

echo "=== DeepMindMap V2 部署脚本 ==="
echo "备份时间戳: ${TIMESTAMP}"
echo "备份标签: ${BACKUP_TAG}"
echo ""

# ============================================================
# [步骤 0] 环境变量校验
# ============================================================
echo "[0/8] 检查环境变量..."
if [[ -z "${ZHIPU_API_KEY_2}" ]]; then
  echo ""
  echo "❌ [错误] 未检测到环境变量 ZHIPU_API_KEY_2"
  echo "请在服务器环境中设置该变量后再执行部署，例如："
  echo "    export ZHIPU_API_KEY_2='your-api-key'"
  echo ""
  exit 1
fi
echo "环境变量 ZHIPU_API_KEY_2 已配置"

# ============================================================
# [步骤 1] 进入项目目录并创建本地 Git 备份
# ============================================================
echo ""
echo "[1/8] 创建本地 Git 备份..."
cd "$PROJECT_DIR" || error_exit "无法进入项目目录: ${PROJECT_DIR}"

# 检查是否为 Git 仓库
if [[ ! -d ".git" ]]; then
  error_exit "项目目录不是 Git 仓库"
fi

# 检查工作区是否干净；不干净则自动提交
echo "检查 Git 工作区状态..."
if ! git diff --quiet || ! git diff --cached --quiet; then
  echo "检测到未提交的本地变更，自动提交备份..."
  git add -A
  git commit -m "deploy: 自动提交本地变更（备份时间戳 ${TIMESTAMP}）" || error_exit "自动提交本地变更失败"
else
  echo "Git 工作区干净"
fi

# 创建本地备份标签
echo "创建本地备份标签: ${BACKUP_TAG}"
git tag -a "${BACKUP_TAG}" -m "部署前自动备份（时间戳 ${TIMESTAMP}）" || error_exit "创建备份标签失败"
echo "本地 Git 备份完成，当前 HEAD: $(git rev-parse --short HEAD)"

# ============================================================
# [步骤 2] 服务器端文件备份
# ============================================================
echo ""
echo "[2/8] 备份服务器端关键目录..."

backup_dir() {
  local src="$1"
  local suffix="$2"
  if [[ -d "${src}" ]]; then
    echo "备份 ${src}/ 为 ${src}.${suffix}/"
    cp -a "${src}" "${src}.${suffix}" || error_exit "备份 ${src}/ 失败"
  else
    echo "目录 ${src}/ 不存在，跳过备份"
  fi
}

backup_dir "server" "bak-${TIMESTAMP}"
backup_dir "admin/server" "bak-${TIMESTAMP}"
backup_dir "client/dist" "bak-${TIMESTAMP}"

echo "服务器端备份完成"

# ============================================================
# [步骤 3] 拉取最新代码
# ============================================================
echo ""
echo "[3/8] 拉取最新代码..."
git fetch origin || error_exit "git fetch 失败"
git reset --hard origin/main || error_exit "git reset 到 origin/main 失败"
echo "当前版本: $(git log --oneline -1)"

# ============================================================
# [步骤 4] 检查 .env 文件
# ============================================================
echo ""
echo "[4/8] 检查环境配置文件..."
if [[ ! -f "server/.env" ]]; then
  echo ""
  echo "⚠️ [警告] server/.env 文件不存在"
  echo "请在 server/.env 中手动配置所需环境变量，例如："
  echo "    ZHIPU_API_KEY_2=your-api-key"
  echo ""
  error_exit "缺少 server/.env 环境配置文件"
fi

# 确保 .env 中存在 ZHIPU_API_KEY_2 配置项（从环境变量写入，不硬编码）
if grep -q "^ZHIPU_API_KEY_2=" server/.env 2>/dev/null; then
  echo "更新 server/.env 中的 ZHIPU_API_KEY_2 配置"
  sed -i "s|^ZHIPU_API_KEY_2=.*|ZHIPU_API_KEY_2=${ZHIPU_API_KEY_2}|" server/.env
else
  echo "写入 ZHIPU_API_KEY_2 到 server/.env"
  echo "" >> server/.env
  echo "ZHIPU_API_KEY_2=${ZHIPU_API_KEY_2}" >> server/.env
fi
echo "server/.env 配置完成"

# ============================================================
# [步骤 5] 安装服务端依赖
# ============================================================
echo ""
echo "[5/8] 安装服务端依赖..."
cd "${PROJECT_DIR}/server" || error_exit "无法进入 server 目录"
npm install --production 2>/dev/null || npm install || error_exit "服务端依赖安装失败"
echo "服务端依赖安装完成"

# ============================================================
# [步骤 6] 构建服务端
# ============================================================
echo ""
echo "[6/8] 构建服务端..."
npm run build 2>/dev/null || npx tsc || error_exit "服务端构建失败"
echo "服务端构建完成"

# ============================================================
# [步骤 7] 构建客户端
# ============================================================
echo ""
echo "[7/8] 构建客户端..."
cd "${PROJECT_DIR}/client" || error_exit "无法进入 client 目录"
npm install || error_exit "客户端依赖安装失败"
npm run build || error_exit "客户端构建失败"
echo "客户端构建完成"

# ============================================================
# [步骤 8] 重启服务并健康检查
# ============================================================
echo ""
echo "[8/8] 重启服务..."
cd "$PROJECT_DIR" || error_exit "无法返回项目根目录"
pm2 restart deepmindmap-server || error_exit "重启 deepmindmap-server 失败"
pm2 restart deepmindmap-admin 2>/dev/null || true
pm2 save || error_exit "pm2 save 失败"
echo "服务重启完成"

# 健康检查
echo ""
echo "执行健康检查..."
sleep 3

HEALTH_URLS=(
  "http://127.0.0.1:3001/health"
  "http://127.0.0.1:3002/api/health"
)

for url in "${HEALTH_URLS[@]}"; do
  echo "检查 ${url}"
  status=$(curl -s -o /dev/null -w "%{http_code}" "${url}" || echo "000")
  if [[ "${status}" != "200" ]]; then
    error_exit "健康检查失败: ${url} 返回状态码 ${status}（期望 200）"
  fi
  echo "  ✓ ${url} 返回 200"
done

echo ""
echo "=== 部署完成 ==="
echo "服务状态:"
pm2 list
echo ""
echo "请访问网站验证功能是否正常"
echo ""
echo "如需回滚，请执行："
echo "    bash rollback_remote.sh ${TIMESTAMP}"
echo ""
