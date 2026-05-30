import paramiko
import time

def run_ssh_command(ssh, command, timeout=300):
    print(f"\n>>> 执行: {command}")
    stdin, stdout, stderr = ssh.exec_command(command, timeout=timeout)
    exit_code = stdout.channel.recv_exit_status()
    out = stdout.read().decode('utf-8', errors='replace')
    err = stderr.read().decode('utf-8', errors='replace')
    if out:
        print(out)
    if err:
        print(f"[STDERR] {err}")
    print(f"<<< 退出码: {exit_code}")
    return exit_code, out, err

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())

PROJECT_DIR = "/www/wwwroot/AI_mindmap"

try:
    ssh.connect('43.139.43.112', username='root', password='123456789Luo', timeout=15)
    print("SSH连接成功!")

    print("\n" + "="*60)
    print("步骤1: 清理本地修改和未跟踪文件")
    print("="*60)
    run_ssh_command(ssh, f"cd {PROJECT_DIR} && git checkout -- .")
    run_ssh_command(ssh, f"cd {PROJECT_DIR} && rm -f client/src/components/Common/ConfirmDialog.tsx")
    run_ssh_command(ssh, f"cd {PROJECT_DIR} && git clean -fd client/src/components/Common/")

    print("\n" + "="*60)
    print("步骤2: 拉取最新代码")
    print("="*60)
    code, out, err = run_ssh_command(ssh, f"cd {PROJECT_DIR} && git pull origin main")

    print("\n" + "="*60)
    print("步骤3: 验证最新代码")
    print("="*60)
    run_ssh_command(ssh, f"cd {PROJECT_DIR} && git log --oneline -5")

    print("\n" + "="*60)
    print("步骤4: 验证ChatPanel.tsx中的内联样式")
    print("="*60)
    run_ssh_command(ssh, f"cd {PROJECT_DIR} && grep -n '475569' client/src/components/Chat/ChatPanel.tsx | head -5")

    print("\n" + "="*60)
    print("步骤5: 构建前端")
    print("="*60)
    run_ssh_command(ssh, f"cd {PROJECT_DIR}/client && npm run build", timeout=300)

    print("\n" + "="*60)
    print("步骤6: 构建后端")
    print("="*60)
    run_ssh_command(ssh, f"cd {PROJECT_DIR}/server && npm run build", timeout=300)

    print("\n" + "="*60)
    print("步骤7: 重启PM2服务")
    print("="*60)
    run_ssh_command(ssh, "pm2 restart deepmindmap-server")
    run_ssh_command(ssh, "pm2 restart deepmindmap-admin")

    print("\n" + "="*60)
    print("步骤8: 验证服务状态")
    print("="*60)
    time.sleep(3)
    run_ssh_command(ssh, "pm2 list")

    print("\n" + "="*60)
    print("步骤9: 验证构建产物包含内联样式")
    print("="*60)
    run_ssh_command(ssh, f"ls -la {PROJECT_DIR}/client/dist/assets/ | head -10")
    run_ssh_command(ssh, f"grep -c '475569' {PROJECT_DIR}/client/dist/assets/index-*.js")

    print("\n部署完成!")

except Exception as e:
    print(f"错误: {e}")
finally:
    ssh.close()
    print("SSH连接已关闭")
