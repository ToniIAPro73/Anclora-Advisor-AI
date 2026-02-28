// tests/test-orchestrator.ts
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

import { Orchestrator } from '../lib/agents/orchestrator';

async function test() {
  const orchestrator = new Orchestrator();
  const userId = 'test-user-id';
  const conversationId = '00000000-0000-0000-0000-000000000000'; // Placeholder UUID
  
  console.log('--- TEST 1: Consulta sobre RETA 2025 ---');
  const query1 = '¿Qué es la cuota cero para autónomos en 2025?';
  const result1 = await orchestrator.processQuery(userId, conversationId, query1);
  
  console.log('Response:', result1.primarySpecialistResponse);
  console.log('Citations:', result1.citations);
  console.log('Alerts:', result1.alerts);
  console.log('Performance:', result1.performance);

  console.log('\n--- TEST 1B: Misma consulta para comprobar cache ---');
  const result1Cached = await orchestrator.processQuery(userId, conversationId, query1);
  console.log('Performance (cached):', result1Cached.performance);

  console.log('\n--- TEST 2: Consulta fuera de dominio (No alucinación) ---');
  const query2 = '¿Quién ganó el mundial de fútbol en 1930?';
  const result2 = await orchestrator.processQuery(userId, conversationId, query2);
  
  console.log('Response:', result2.primarySpecialistResponse);
  console.log('Citations:', result2.citations);
  console.log('Context Warnings:', result2.contexts[0]?.warnings);
  console.log('Performance:', result2.performance);

  console.log('\n--- TEST 3: Calculo determinista de factura ---');
  const query3 = 'Calcula una factura con base 1000, IVA 21 e IRPF 15';
  const result3 = await orchestrator.processQuery(userId, conversationId, query3);

  console.log('Response:', result3.primarySpecialistResponse);
  console.log('Citations:', result3.citations);
  console.log('Performance:', result3.performance);

  console.log('\n--- TEST 4: Calculo determinista de IVA ---');
  const query4 = 'Calcula el IVA de una base 1000 con IVA 21';
  const result4 = await orchestrator.processQuery(userId, conversationId, query4);

  console.log('Response:', result4.primarySpecialistResponse);
  console.log('Performance:', result4.performance);

  console.log('\n--- TEST 5: Deduccion de suministros ---');
  const query5 = 'Si mi vivienda tiene 100 m2 y afecto 20 m2, cuanto puedo deducir de suministros sobre 150 euros';
  const result5 = await orchestrator.processQuery(userId, conversationId, query5);

  console.log('Response:', result5.primarySpecialistResponse);
  console.log('Performance:', result5.performance);

  console.log('\n--- TEST 6: Prorrata de IVA ---');
  const query6 = 'Calcula la prorrata del 60 sobre un IVA soportado de 210 euros';
  const result6 = await orchestrator.processQuery(userId, conversationId, query6);

  console.log('Response:', result6.primarySpecialistResponse);
  console.log('Performance:', result6.performance);
}

test().catch(console.error);
