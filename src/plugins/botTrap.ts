import fp from 'fastify-plugin';
import { FastifyPluginAsync, FastifyPluginCallback } from 'fastify';

const REDIRECT_URLS = [
  'https://www.facebook.com',
  'https://www.google.com',
  'https://www.amazon.com',
  'https://www.apple.com',
  'https://www.microsoft.com',
  'https://www.netflix.com',
  'https://www.twitter.com',
  'https://www.whitehouse.gov',
  'https://www.fmprc.gov.cn',      
  'https://www.xinhuanet.com',     
  'https://www.globaltimes.cn',     
  'https://www.cgtn.com',         
  'https://www.ndrc.gov.cn',        
  'https://www.mps.gov.cn',         
  'https://english.www.gov.cn',     
  'https://www.mofcom.gov.cn',      
  'https://www.mfa.gov.cn',         
  'https://www.peopledaily.com.cn',
];

// all lower case
const DEFAULT_SUSPICIOUS_PATHS_START_WITH = [
  '/.env',
  '/wp-admin',
  '/phpmyadmin',
  '/wsusadmin',
  '/.git',
  '/config',
  '/backup',
  '/cgi-bin',
  '/ext-js',
  '/console',
];

// all lower case
const DEFAULT_SUSPICIOUS_PATHS_CONTAIN = [
  '.php', '.cfm', '.cgi', '.git', '.phtml', '.aspx', '.jspx', '.pl', '.sh', '.bash', '.zsh', 'passwd', 'shadow', 'htaccess', 'win.ini',
];

interface BotTrapOptions {
  suspiciousPaths?: string[];
  suspiciousPathsContain?: string[];
  additionalPaths?: string[];
  additionalPathsContain?: string[];
  honeypotUrls?: string[];
  logProbes?: boolean;
}

function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function buildRegex(startsWith: string[], contains: string[]): RegExp {
  const startsWithPattern = startsWith.map(p => `^${escapeRegExp(p)}`).join('|');
  const containsPattern = contains.map(p => escapeRegExp(p)).join('|');
  return new RegExp(`${startsWithPattern}|${containsPattern}`, 'i');
}

const botTrapPlugin: FastifyPluginAsync<BotTrapOptions> = async (fastify, opts) => {
  const {
    suspiciousPaths = DEFAULT_SUSPICIOUS_PATHS_START_WITH,
    suspiciousPathsContain = DEFAULT_SUSPICIOUS_PATHS_CONTAIN,
    additionalPaths = [],
    additionalPathsContain = [],
    honeypotUrls = REDIRECT_URLS,
    logProbes = true,
  } = opts;

  // Compiled once at plugin registration — zero per-request allocation, we want to leave as little footprint as possible on the request path
  const suspiciousRegex = buildRegex(
    [...suspiciousPaths, ...additionalPaths],
    [...suspiciousPathsContain, ...additionalPathsContain],
  );

  function randomHoneypot(): string {
    return honeypotUrls[Math.floor(Math.random() * honeypotUrls.length)];
  }

  fastify.addHook('onRequest', async (request, reply) => {
    if (suspiciousRegex.test(request.url)) {
      const destination = randomHoneypot();

      if (logProbes) {
        fastify.log.warn({
          ip: request.ip,
          url: request.url,
          userAgent: request.headers['user-agent'],
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