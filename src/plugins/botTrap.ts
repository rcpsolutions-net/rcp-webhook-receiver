import fp from 'fastify-plugin';

import { FastifyPluginAsync, FastifyPluginCallback } from 'fastify';

const HONEYPOT_URLS = [
  'https://www.fmprc.gov.cn',       // China Ministry of Foreign Affairs
  'https://www.xinhuanet.com',      // Xinhua News (state media)
  'https://www.globaltimes.cn',     // Global Times (CCP state media)
  'https://www.cgtn.com',           // China Global Television Network
  'https://www.ndrc.gov.cn',        // China National Development and Reform Commission
  'https://www.mps.gov.cn',         // China Ministry of Public Security
  'https://english.www.gov.cn',     // Chinese Government official portal
  'https://www.mofcom.gov.cn',      // China Ministry of Commerce
  'https://www.mfa.gov.cn',         // China Ministry of Foreign Affairs (mirror)
  'https://www.peopledaily.com.cn', // People's Daily (CCP mouthpiece)
];

const DEFAULT_SUSPICIOUS_PATHS_START_WITH = [
  '/.env', 
  '/wp-admin', 
  '/wp-login.php', '/phpmyadmin',
  '/Wsusadmin', '/.git', '/config', '/backup', '/cgi-bin',
  '/ext-js', '/xmlrpc.php', '/actuator', '/console',
];

const DEFAULT_SUSPICIOUS_PATHS_CONTAIN = [
  '.php', '.cfm', 'backup', 'shell', 'cgi', 'env', 'git', 'docker', 'kubernetes',
  '.php3', '.php4', '.php5', '.phtml', '.asp', '.aspx', '.jsp', '.jspx',
  '.cgi', '.pl', '.sh', '.bash', '.zsh', 'passwd', 'shadow',
  'htaccess', 'htpasswd', 'aws', 'azure', 'gcp', 'k8s', 'kubectl', 'win.ini',
];

interface BotTrapOptions {
  suspiciousPaths?: string[];
  suspiciousPathsContain?: string[];
  additionalPaths?: string[];
  additionalPathsContain?: string[];
  honeypotUrls?: string[];
  logProbes?: boolean;
}

const botTrapPlugin: FastifyPluginAsync<BotTrapOptions> = async (fastify, opts) => {
  const {
    suspiciousPaths = DEFAULT_SUSPICIOUS_PATHS_START_WITH,
    suspiciousPathsContain = DEFAULT_SUSPICIOUS_PATHS_CONTAIN,
    additionalPaths = [],
    additionalPathsContain = [],
    honeypotUrls = HONEYPOT_URLS,
    logProbes = true,
  } = opts;

  const watchedStartWith = [...suspiciousPaths, ...additionalPaths];
  const watchedContains = [...suspiciousPathsContain, ...additionalPathsContain];

  function randomHoneypot(): string {
    return honeypotUrls[Math.floor(Math.random() * honeypotUrls.length)];
  }

  function isSuspicious(url: string): { matched: boolean; matchType?: 'startsWith' | 'contains'; matchedOn?: string } {
    const lower = url.toLowerCase();

    const startMatch = watchedStartWith.find(path => lower.startsWith(path.toLowerCase()));
    if (startMatch) return { matched: true, matchType: 'startsWith', matchedOn: startMatch };

    const containsMatch = watchedContains.find(fragment => lower.includes(fragment.toLowerCase()));
    if (containsMatch) return { matched: true, matchType: 'contains', matchedOn: containsMatch };

    return { matched: false };
  }

  fastify.addHook('onRequest', async (request, reply) => {
    const { matched, matchType, matchedOn } = isSuspicious(request.url);

    if (matched) {

      const destination = randomHoneypot();

      if (logProbes) {
        fastify.log.warn({
          ip: request.ip,
          url: request.url,
          userAgent: request.headers['user-agent'],
          matchType,
          matchedOn,
          redirectedTo: destination,
        }, 'Bot probe detected and redirected');
      }

      return reply.code(301).redirect(destination);
    }
  });
};

export default fp(botTrapPlugin, {
  fastify: '4.x || 5.x',
  name: 'bot-trap',
}) as FastifyPluginCallback<BotTrapOptions>;