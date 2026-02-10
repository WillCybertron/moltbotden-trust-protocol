"use strict";
/**
 * Trust Protocol REST API
 *
 * Exposes trust attestation operations as HTTP endpoints.
 * Bridges MoltbotDen platform data → Trust Engine → Solana attestations.
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const http_1 = __importDefault(require("http"));
const url_1 = require("url");
const solana_attestor_1 = require("./solana-attestor");
const trust_engine_1 = require("./trust-engine");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const PORT = 3410;
const ORACLE_KEY_PATH = path.join(process.env.HOME || '~', '.config/moltbotden-trust/oracle.json');
const attestor = new solana_attestor_1.SolanaAttestor();
// Initialize oracle
function initOracle() {
    try {
        if (fs.existsSync(ORACLE_KEY_PATH)) {
            const keyData = JSON.parse(fs.readFileSync(ORACLE_KEY_PATH, 'utf-8'));
            attestor.initOracle(new Uint8Array(Buffer.from(keyData.secretKey, 'base64')));
            console.log(`Oracle loaded: ${attestor.oraclePublicKey}`);
        }
        else {
            const oracle = attestor.generateOracle();
            fs.mkdirSync(path.dirname(ORACLE_KEY_PATH), { recursive: true });
            fs.writeFileSync(ORACLE_KEY_PATH, JSON.stringify(oracle, null, 2));
            console.log(`New oracle generated: ${oracle.publicKey}`);
            console.log(`Oracle key saved to ${ORACLE_KEY_PATH}`);
        }
    }
    catch (err) {
        console.error('Failed to initialize oracle:', err);
    }
}
function parseBody(req) {
    return new Promise((resolve, reject) => {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', () => {
            try {
                resolve(JSON.parse(body));
            }
            catch {
                resolve({});
            }
        });
        req.on('error', reject);
    });
}
function json(res, data, status = 200) {
    res.writeHead(status, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
    res.end(JSON.stringify(data));
}
async function handleRequest(req, res) {
    const url = new url_1.URL(req.url || '/', `http://localhost:${PORT}`);
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
            const data = await parseBody(req);
            const attestation = (0, trust_engine_1.calculateTrustScore)(data);
            return json(res, { attestation, onchain: false });
        }
        // Attest trust score on-chain
        if (url.pathname === '/trust/attest' && method === 'POST') {
            const data = await parseBody(req);
            const attestation = (0, trust_engine_1.calculateTrustScore)(data);
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
            ] }, 404);
    }
    catch (err) {
        console.error('Request error:', err);
        json(res, { error: err.message }, 500);
    }
}
// Start
initOracle();
const server = http_1.default.createServer(handleRequest);
server.listen(PORT, () => {
    console.log(`Moltbot Den Trust Protocol API running on port ${PORT}`);
    console.log(`Oracle: ${attestor.oraclePublicKey}`);
    console.log(`Network: Solana Devnet`);
});
//# sourceMappingURL=api.js.map