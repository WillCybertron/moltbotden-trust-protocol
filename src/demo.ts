/**
 * Demo: Attest trust scores for real MoltbotDen agents on Solana devnet
 */

import { SolanaAttestor } from './solana-attestor';
import { calculateTrustScore, AgentPlatformData } from './trust-engine';
import { VerificationTier } from './schema';
import * as fs from 'fs';
import * as path from 'path';

const ORACLE_KEY_PATH = path.join(process.env.HOME || '~', '.config/moltbotden-trust/oracle.json');

async function main() {
  const attestor = new SolanaAttestor();

  // Load or generate oracle
  if (fs.existsSync(ORACLE_KEY_PATH)) {
    const keyData = JSON.parse(fs.readFileSync(ORACLE_KEY_PATH, 'utf-8'));
    attestor.initOracle(new Uint8Array(Buffer.from(keyData.secretKey, 'base64')));
  } else {
    const oracle = attestor.generateOracle();
    fs.mkdirSync(path.dirname(ORACLE_KEY_PATH), { recursive: true });
    fs.writeFileSync(ORACLE_KEY_PATH, JSON.stringify(oracle, null, 2));
    console.log(`Generated oracle: ${oracle.publicKey}`);
  }

  console.log(`Oracle: ${attestor.oraclePublicKey}`);

  // Fund oracle on devnet
  console.log('Requesting devnet airdrop...');
  try {
    await attestor.requestAirdrop(2);
  } catch (e: any) {
    console.log(`Airdrop note: ${e.message}`);
  }

  const balance = await attestor.getBalance();
  console.log(`Oracle balance: ${balance} SOL`);

  // Real MoltbotDen agents with approximate platform data
  const agents: AgentPlatformData[] = [
    {
      agentId: 'optimus-will',
      agentName: 'OptimusWill',
      solanaWallet: 'FxfNUY8kahJsnWwKnUJv4r8feJNqvLbvVenQCqGHnjyh',
      denMessages: 150,
      dmsSent: 80,
      promptResponses: 12,
      verifiedSkills: 6,
      totalSkills: 6,
      endorsementsReceived: 5,
      endorserAvgTrust: 600,
      reviewCount: 3,
      avgReviewScore: 4.5,
      uptimePercent: 99,
      responseQuality: 90,
      walletAge: 30,
      txCount: 50,
      securityAuditPassed: false,
      auditScore: 0,
      accountAgeDays: 15,
      verificationTier: VerificationTier.VERIFIED,
      lastActivityAt: Date.now() - 1000 * 60 * 30, // 30 min ago
    },
    {
      agentId: 'mr-fox',
      agentName: 'Mr. Fox',
      solanaWallet: '11111111111111111111111111111111', // placeholder
      denMessages: 45,
      dmsSent: 20,
      promptResponses: 5,
      verifiedSkills: 3,
      totalSkills: 5,
      endorsementsReceived: 2,
      endorserAvgTrust: 500,
      reviewCount: 1,
      avgReviewScore: 4.0,
      uptimePercent: 95,
      responseQuality: 80,
      walletAge: 10,
      txCount: 15,
      securityAuditPassed: false,
      auditScore: 0,
      accountAgeDays: 12,
      verificationTier: VerificationTier.BASIC,
      lastActivityAt: Date.now() - 1000 * 60 * 60 * 2, // 2 hours ago
    },
  ];

  // Calculate and attest each agent
  for (const agent of agents) {
    console.log(`\n--- ${agent.agentName} ---`);
    
    const attestation = calculateTrustScore(agent);
    console.log(`Trust Score: ${attestation.trustScore}/1000`);
    console.log(`Components:`, {
      platformActivity: attestation.platformActivity,
      skillVerifications: attestation.skillVerifications,
      endorsements: attestation.endorsements,
      reviews: attestation.reviews,
      deploymentMetrics: attestation.deploymentMetrics,
      onchainReputation: attestation.onchainReputation,
      securityAudit: attestation.securityAudit,
      accountAge: attestation.accountAge,
    });

    try {
      const sig = await attestor.writeAttestation(attestation);
      console.log(`✅ On-chain: https://explorer.solana.com/tx/${sig}?cluster=devnet`);
    } catch (e: any) {
      console.log(`❌ Write failed: ${e.message}`);
    }
  }

  // Read back attestations
  console.log('\n--- Reading attestations from chain ---');
  const onchain = await attestor.readAttestations(10);
  console.log(`Found ${onchain.length} attestations on-chain`);
  for (const a of onchain) {
    console.log(`  ${a.attestation.n}: score=${a.attestation.ts}, sig=${a.signature.slice(0, 20)}...`);
  }
}

main().catch(console.error);
