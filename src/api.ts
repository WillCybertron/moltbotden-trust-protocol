/**
 * Trust Protocol REST API
 * 
 * Exposes trust attestation operations as HTTP endpoints.
 * Bridges MoltbotDen platform data → Trust Engine → Solana attestations.
 */

import http from 'http';
import { URL } from 'url';
import { SolanaAttestor } from './solana-attestor';
import { calculateTrustScore, getCurrentScore } from './trust-engine';
import { AgentPlatformData } from './trust-engine';
import { VerificationTier } from './schema';
import * as fs from 'fs';
import * as path from 'path';

const PORT = 3410;
const ORACLE_KEY_PATH = path.join(process.env.HOME || '~', '.config/moltbotden-trust/oracle.json');

const attestor = new SolanaAttestor();

// Initialize oracle
function initOracle() {
  try {
    if (fs.existsSync(ORACLE_KEY_PATH)) {
      const keyData = JSON.parse(fs.readFileSync(ORACLE_KEY_PATH, 'utf-8'));
      attestor.initOracle(new Uint8Array(Buffer.from(keyData.secretKey, 'base64')));
      console.log(`Oracle loaded: ${attestor.oraclePublicKey}`);
    } else {
      const oracle = attestor.generateOracle();
      fs.mkdirSync(path.dirname(ORACLE_KEY_PATH), { recursive: true });
      fs.writeFileSync(ORACLE_KEY_PATH, JSON.stringify(oracle, null, 2));
      console.log(`New oracle generated: ${oracle.publicKey}`);
      console.log(`Oracle key saved to ${ORACLE_KEY_PATH}`);
    }
  } catch (err) {
    console.error('Failed to initialize oracle:', err);
  }
}

function parseBody(req: http.IncomingMessage): Promise<any> {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try { resolve(JSON.parse(body)); }
      catch { resolve({}); }
    });
    req.on('error', reject);
  });
}

function json(res: http.ServerResponse, data: any, status = 200) {
  res.writeHead(status, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
  res.end(JSON.stringify(data));
}

async function handleRequest(req: http.IncomingMessage, res: http.ServerResponse) {
  const url = new URL(req.url || '/', `http://localhost:${PORT}`);
  const method = req.method || 'GET';

  // CORS preflight
  if (method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    });
    return res.end();
  }

  try {
    // Health check
    if (url.pathname === '/health') {
      return json(res, {
        status: 'ok',
        oracle: attestor.oraclePublicKey,
        network: 'devnet',
        version: '1.0.0',
      });
    }

    // Get oracle info
    if (url.pathname === '/oracle' && method === 'GET') {
      const balance = await attestor.getBalance();
      return json(res, {
        publicKey: attestor.oraclePublicKey,
        network: 'devnet',
        balance,
      });
    }

    // Fund oracle (devnet airdrop)
    if (url.pathname === '/oracle/fund' && method === 'POST') {
      const sig = await attestor.requestAirdrop(1);
      return json(res, { signature: sig, amount: 1 });
    }

    // Calculate trust score (dry run — no on-chain write)
    if (url.pathname === '/trust/calculate' && method === 'POST') {
      const data: AgentPlatformData = await parseBody(req);
      const attestation = calculateTrustScore(data);
      return json(res, { attestation, onchain: false });
    }

    // Attest trust score on-chain
    if (url.pathname === '/trust/attest' && method === 'POST') {
      const data: AgentPlatformData = await parseBody(req);
      const attestation = calculateTrustScore(data);
      const signature = await attestor.writeAttestation(attestation);
      return json(res, {
        attestation,
        onchain: true,
        signature,
        explorer: `https://explorer.solana.com/tx/${signature}?cluster=devnet`,
      });
    }

    // Query trust for an agent
    if (url.pathname.startsWith('/trust/query/') && method === 'GET') {
      const agentId = url.pathname.split('/trust/query/')[1];
      // For now, read from on-chain history
      const attestations = await attestor.readAttestations(50);
      const match = attestations.find(a => a.attestation.id === agentId);
      
      if (!match) {
        return json(res, { found: false, agentId }, 404);
      }

      return json(res, {
        found: true,
        agentId,
        attestation: match.attestation,
        signature: match.signature,
        blockTime: match.blockTime,
        explorer: `https://explorer.solana.com/tx/${match.signature}?cluster=devnet`,
      });
    }

    // List all attestations
    if (url.pathname === '/trust/attestations' && method === 'GET') {
      const limit = parseInt(url.searchParams.get('limit') || '20');
      const attestations = await attestor.readAttestations(limit);
      return json(res, { attestations, count: attestations.length });
    }

    // 404
    json(res, { error: 'Not found', endpoints: [
      'GET  /health',
      'GET  /oracle',
      'POST /oracle/fund',
      'POST /trust/calculate',
      'POST /trust/attest',
      'GET  /trust/query/:agentId',
      'GET  /trust/attestations',
    ]}, 404);

  } catch (err: any) {
    console.error('Request error:', err);
    json(res, { error: err.message }, 500);
  }
}

// Start
initOracle();
const server = http.createServer(handleRequest);
server.listen(PORT, () => {
  console.log(`Moltbot Den Trust Protocol API running on port ${PORT}`);
  console.log(`Oracle: ${attestor.oraclePublicKey}`);
  console.log(`Network: Solana Devnet`);
});
