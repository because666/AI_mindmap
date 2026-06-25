# DeepMindMap Admin 后台环境变量更新脚本
# 仅在服务器上执行，不要在本地运行

$envPath = '/www/wwwroot/AI_mindmap/admin/server/.env'

$password = 'P1uGooPCa5%QYevu#Kon'
$sessionSecret = 'NLkbKAa5CHwUsmc4jYHAqPcDE982TBjuUyqS536tAQqR0bC4GOJISuGnwPZpva5Gd4uGughYxyiPJ_Axso2a0g'
$securityAnswer = 'mM2z2JAFN4aLiuXK'

Write-Host "ADMIN_INIT_PASSWORD=$password"
Write-Host "SESSION_SECRET=$sessionSecret"
Write-Host "SECURITY_ANSWER=$securityAnswer"

# 更新 .env 文件
ssh root@43.139.43.112 @"
set -e
# 备份
\cp -f $envPath ${envPath}.bak.$(date +%Y%m%d_%H%M%S)

# 使用 sed 更新或添加变量
sed -i "s|^ADMIN_INIT_PASSWORD=.*|ADMIN_INIT_PASSWORD=$password|" $envPath || echo "ADMIN_INIT_PASSWORD=$password" >> $envPath
sed -i "s|^SESSION_SECRET=.*|SESSION_SECRET=$sessionSecret|" $envPath || echo "SESSION_SECRET=$sessionSecret" >> $envPath
sed -i "s|^SECURITY_ANSWER=.*|SECURITY_ANSWER=$securityAnswer|" $envPath || echo "SECURITY_ANSWER=$securityAnswer" >> $envPath

# 如果存在旧的 SECRET_ANSWER，删除
sed -i '/^SECRET_ANSWER=/d' $envPath

echo '环境变量已更新'
"@
