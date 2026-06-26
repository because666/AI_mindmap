import paramiko
import sys

HOST = '43.139.43.112'
USERNAME = 'root'
PASSWORD = '123456789Luo'


def run(cmd):
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect(HOST, username=USERNAME, password=PASSWORD, timeout=30)
    stdin, stdout, stderr = client.exec_command(cmd)
    out = stdout.read().decode('utf-8', errors='replace')
    err = stderr.read().decode('utf-8', errors='replace')
    client.close()
    return out, err


if __name__ == '__main__':
    sys.stdout.reconfigure(encoding='utf-8')
    sys.stderr.reconfigure(encoding='utf-8')
    cmd = """mongosh 'mongodb://deepmindmap:deepmindmap123@localhost:27017/deepmindmap?authSource=deepmindmap' --quiet --eval '
      print("=== ADMIN_IPS ===");
      printjson(db.admin_ips.find().toArray());
      print("=== ADMIN_CONFIGS ===");
      printjson(db.admin_configs.find({}, {passwordHash:0}).toArray());
    '"""
    out, err = run(cmd)
    print(out)
    if err:
        print('STDERR:', err, file=sys.stderr)
