import { Request, Response, NextFunction } from 'express';
import { adminDB } from '../config/database';
import { AdminIP } from '../types';

/**
 * IP 白名单缓存有效期（毫秒）
 * 60 秒内复用上次查询结果，避免每次请求都查询数据库
 */
const IP_WHITELIST_CACHE_TTL_MS = 60 * 1000;

/**
 * IP 白名单缓存结构
 * - ips: 已启用且在白名单中的 IP/CIDR 字符串列表
 * - loadedAt: 本次缓存加载的时间戳（毫秒）
 */
interface IpWhitelistCache {
  ips: string[];
  loadedAt: number;
}

/**
 * 模块级缓存变量
 * 初次为 null，首次请求时加载；60 秒后过期重新加载
 */
let whitelistCache: IpWhitelistCache | null = null;

/**
 * 标记"白名单未启用"提示日志是否已输出过
 * 仅在白名单为空时首次输出，避免每次请求都打印日志
 */
let whitelistEmptyLogged = false;

/**
 * 获取客户端真实IP地址
 * 支持代理服务器场景下的IP获取
 * @param req - Express请求对象
 * @returns 客户端IP地址
 */
export function getClientIp(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') {
    return forwarded.split(',')[0].trim();
  }
  if (Array.isArray(forwarded)) {
    return forwarded[0].trim();
  }
  return req.ip || req.socket.remoteAddress || 'unknown';
}

/**
 * 将 IPv4 映射的 IPv6 地址（如 ::ffff:1.2.3.4）转换为纯 IPv4 地址
 * 用于统一比较，避免代理/协议差异导致匹配失败
 * @param ip - 原始 IP 字符串
 * @returns 规范化后的 IP 字符串
 */
function normalizeIp(ip: string): string {
  if (!ip) return ip;
  // 处理 IPv4 映射的 IPv6 地址
  const ipv4MappedMatch = ip.match(/^::ffff:(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/i);
  if (ipv4MappedMatch) {
    return ipv4MappedMatch[1];
  }
  return ip;
}

/**
 * 判断目标 IP 是否匹配指定 CIDR 网段
 * 仅支持 IPv4 CIDR 匹配；非 CIDR 格式或非法输入返回 false
 * @param ip - 目标 IP 地址（已规范化）
 * @param cidr - CIDR 字符串，如 "192.168.1.0/24"
 * @returns 是否在 CIDR 网段内
 */
function matchCidr(ip: string, cidr: string): boolean {
  try {
    const slashIndex = cidr.indexOf('/');
    if (slashIndex === -1) return false;

    const networkPart = cidr.substring(0, slashIndex);
    const prefixStr = cidr.substring(slashIndex + 1);
    const prefix = parseInt(prefixStr, 10);
    if (isNaN(prefix) || prefix < 0 || prefix > 32) return false;

    const ipParts = ip.split('.').map((p) => parseInt(p, 10));
    const netParts = networkPart.split('.').map((p) => parseInt(p, 10));
    if (ipParts.length !== 4 || netParts.length !== 4) return false;
    if (ipParts.some((p) => isNaN(p) || p < 0 || p > 255)) return false;
    if (netParts.some((p) => isNaN(p) || p < 0 || p > 255)) return false;

    // 将 IPv4 地址转换为 32 位无符号整数
    const ipNum = (ipParts[0] << 24) + (ipParts[1] << 16) + (ipParts[2] << 8) + ipParts[3];
    const netNum = (netParts[0] << 24) + (netParts[1] << 16) + (netParts[2] << 8) + netParts[3];

    // 计算掩码：prefix 为 0 时掩码为 0（匹配全部），为 32 时掩码为 0xFFFFFFFF
    const mask = prefix === 0 ? 0 : (0xFFFFFFFF << (32 - prefix)) >>> 0;

    // 比较"IP & 掩码"与"网络地址 & 掩码"是否一致
    // 使用 >>> 0 转为无符号 32 位整数，避免符号位差异导致比较失败
    return ((ipNum & mask) >>> 0) === ((netNum & mask) >>> 0);
  } catch (error) {
    console.error('CIDR 匹配异常:', error);
    return false;
  }
}

/**
 * 判断目标 IP 是否在白名单列表中
 * 支持精确 IP 匹配与 CIDR 网段匹配
 * @param ip - 目标 IP 地址
 * @param whitelist - 白名单条目列表（可为 IP 或 CIDR）
 * @returns 是否匹配
 */
function isIpInWhitelist(ip: string, whitelist: string[]): boolean {
  const normalizedIp = normalizeIp(ip);
  for (const entry of whitelist) {
    const normalizedEntry = normalizeIp(entry.trim());
    // 精确匹配
    if (normalizedEntry === normalizedIp) {
      return true;
    }
    // CIDR 匹配
    if (normalizedEntry.includes('/') && matchCidr(normalizedIp, normalizedEntry)) {
      return true;
    }
  }
  return false;
}

/**
 * 加载 IP 白名单（带 60 秒内存缓存）
 * 缓存过期或不存在时从 admin_ips 集合重新查询
 * 查询异常时返回空数组并记录错误日志，避免数据库故障导致服务不可用
 * @returns 当前启用的 IP/CIDR 字符串列表
 */
async function loadWhitelist(): Promise<string[]> {
  const now = Date.now();
  // 缓存有效期内直接返回
  if (whitelistCache && now - whitelistCache.loadedAt < IP_WHITELIST_CACHE_TTL_MS) {
    return whitelistCache.ips;
  }

  try {
    const docs = await adminDB.find<AdminIP>('admin_ips', { isActive: true } as never);
    const ips = docs.map((doc) => doc.ipAddress).filter((ip): ip is string => Boolean(ip));
    whitelistCache = { ips, loadedAt: now };
    return ips;
  } catch (error) {
    console.error('加载 IP 白名单失败:', error);
    // 查询失败时保留旧缓存（若存在），否则视为空白名单
    if (whitelistCache) {
      return whitelistCache.ips;
    }
    return [];
  }
}

/**
 * 重置 IP 白名单缓存与"白名单未启用"日志标记
 * 主要供单元测试使用，确保测试用例之间相互隔离
 */
export function resetIpWhitelistCache(): void {
  whitelistCache = null;
  whitelistEmptyLogged = false;
}

/**
 * IP 白名单中间件
 * - 从 admin_ips 集合读取启用中的 IP 列表（带 60 秒内存缓存）
 * - 白名单为空时放行所有请求（首次配置场景），仅首次输出一条提示日志
 * - 已登录用户（携带有效 sessionId）直接放行，不受 IP 白名单限制
 * - 未登录用户走 IP 白名单检查，非白名单 IP 返回 403 状态码
 * - 使用 getClientIp 获取客户端真实 IP，支持精确 IP 与 CIDR 匹配
 * @param req - Express 请求对象
 * @param res - Express 响应对象
 * @param next - Express 下一个中间件函数
 */
export async function ipWhitelistMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  // IP 白名单已禁用：后台依靠密码登录（requireAuth）+ 蜜罐系统保护
  // Cloudflare 代理导致用户真实 IP 难以稳定获取，IP 白名单反而阻碍正常使用
  next();
  return;

  // 以下代码保留但不执行，便于未来需要时重新启用
  try {
    const whitelist = await loadWhitelist();

    // 白名单为空：放行所有请求（首次配置场景）
    if (whitelist.length === 0) {
      if (!whitelistEmptyLogged) {
        console.info('ℹ️ IP 白名单未启用（admin_ips 集合为空），当前放行所有请求。请在后台配置白名单以加强安全。');
        whitelistEmptyLogged = true;
      }
      next();
      return;
    }

    // 白名单非空后，重置"未启用"日志标记，便于下次再次为空时重新提示
    whitelistEmptyLogged = false;

    // 已登录用户（携带有效 sessionId）直接放行，不受 IP 白名单限制
    const sessionId = (req as Request & { session?: { sessionId?: string } }).session?.sessionId;
    if (sessionId) {
      next();
      return;
    }

    const clientIp = getClientIp(req);
    if (clientIp === 'unknown') {
      console.warn('⚠️ IP 白名单校验：无法识别客户端 IP，已拒绝请求');
      res.status(403).json({ success: false, error: 'IP不在白名单' });
      return;
    }

    if (isIpInWhitelist(clientIp, whitelist)) {
      next();
      return;
    }

    console.warn(`⚠️ IP 白名单拦截：客户端 IP ${clientIp} 不在白名单中`);
    res.status(403).json({ success: false, error: 'IP不在白名单' });
  } catch (error) {
    console.error('IP 白名单中间件异常:', error);
    // 中间件异常时返回 500，避免静默失败
    res.status(500).json({ success: false, error: 'IP 白名单校验失败' });
  }
}
