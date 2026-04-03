import { createChatCompletion } from '@/lib/ai/model-router';
import type { CanonicalPlanState } from '@/types/planning';
import { logger } from '@/lib/observability/logger';

/**
 * Build an executive summary of the plan for non-technical stakeholders.
 */
export async function buildExecutiveSummary(
  plan: CanonicalPlanState,
  context: string = ''
): Promise<string> {
  const planSummary = summarizePlanForPrompt(plan);
  
  const result = await createChatCompletion(
    'artifact_generation',
    [
      {
        role: 'system',
        content: `You are a technical writer producing executive summaries for AI data center planning projects. 
Write for a non-technical executive audience. Be concise, business-focused, and highlight key decisions, risks, and costs.
Format with clear sections using markdown headings. Do not invent specific vendor pricing or specs.`,
      },
      {
        role: 'user',
        content: `Write an executive summary for this AI data center plan:\n\n${planSummary}\n\n${context ? `Additional context:\n${context}` : ''}`,
      },
    ],
    { temperature: 0.3 }
  );
  
  logger.info('artifact_built', { type: 'executive_summary', planVersion: plan.version });
  return result.content;
}

/**
 * Build a detailed technical summary for engineers.
 */
export async function buildTechnicalSummary(
  plan: CanonicalPlanState,
  context: string = ''
): Promise<string> {
  const planSummary = summarizePlanForPrompt(plan);
  
  const result = await createChatCompletion(
    'artifact_generation',
    [
      {
        role: 'system',
        content: `You are a senior infrastructure architect producing technical design documents for AI data centers.
Write for a technical audience (engineers, architects). Include detailed specifications, design rationale, assumptions, and open questions.
Format with clear sections using markdown headings and tables where appropriate.
Always flag assumptions and estimates clearly.`,
      },
      {
        role: 'user',
        content: `Write a technical design summary for this AI data center plan:\n\n${planSummary}\n\n${context ? `Additional context:\n${context}` : ''}`,
      },
    ],
    { temperature: 0.2 }
  );
  
  logger.info('artifact_built', { type: 'technical_summary', planVersion: plan.version });
  return result.content;
}

/**
 * Build a structured BOM in markdown table format.
 */
export function buildBOM(plan: CanonicalPlanState): string {
  const { bom } = plan;
  const lines: string[] = [
    '# Bill of Materials',
    '',
    `*Generated: ${new Date(bom.generatedAt).toLocaleString()}*`,
    `*Currency: ${bom.currency}*`,
    '',
  ];

  if (bom.quotedItems.length > 0) {
    lines.push('## Quoted Items');
    lines.push('');
    lines.push('| Category | Description | Vendor | Part # | Qty | Unit Price | Total |');
    lines.push('|----------|-------------|--------|--------|-----|------------|-------|');
    for (const item of bom.quotedItems) {
      lines.push(
        `| ${item.category} | ${item.description} | ${item.vendor ?? '-'} | ${item.partNumber ?? '-'} | ${item.quantity.value} | $${item.unitPrice.value.toLocaleString()} | $${item.totalPrice.value.toLocaleString()} |`
      );
    }
    lines.push('');
    lines.push(`**Quoted Subtotal: $${bom.totalQuoted.value.toLocaleString()} ${bom.currency}**`);
    lines.push('');
  }

  if (bom.estimatedItems.length > 0) {
    lines.push('## Estimated Items *(values are LLM estimates — not quotes)*');
    lines.push('');
    lines.push('| Category | Description | Qty | Est. Unit Price | Est. Total |');
    lines.push('|----------|-------------|-----|-----------------|------------|');
    for (const item of bom.estimatedItems) {
      lines.push(
        `| ${item.category} | ${item.description} | ${item.quantity.value} | ~$${item.unitPrice.value.toLocaleString()} | ~$${item.totalPrice.value.toLocaleString()} |`
      );
    }
    lines.push('');
    lines.push(`**Estimated Subtotal: ~$${bom.totalEstimated.value.toLocaleString()} ${bom.currency}** *(estimate)*`);
    lines.push('');
  }

  if (bom.quotedItems.length > 0 || bom.estimatedItems.length > 0) {
    lines.push(`---`);
    lines.push(`**Grand Total: ~$${bom.grandTotal.value.toLocaleString()} ${bom.currency}**`);
    if (bom.estimatedItems.length > 0) {
      lines.push(`*(includes estimates — subject to vendor quotes)*`);
    }
  } else {
    lines.push('*No BOM items have been generated yet. Provide more plan details to generate a BOM.*');
  }

  return lines.join('\n');
}

/**
 * Build a cost summary breakdown.
 */
export function buildCostSummary(plan: CanonicalPlanState): string {
  const { costSummary, bom } = plan;
  const cost = costSummary.value;
  const lines: string[] = [
    '# Cost Summary',
    '',
    `*Provenance: ${costSummary.provenance.sourceType} (${costSummary.provenance.confidence} confidence)*`,
    '',
  ];

  if (cost.capex) {
    lines.push(`## Capital Expenditure (CapEx)`);
    lines.push(`**Total CapEx: ~$${cost.capex.toLocaleString()}**`);
    lines.push('');
  }

  if (cost.opexMonthly || cost.opexAnnual) {
    lines.push(`## Operating Expenditure (OpEx)`);
    if (cost.opexMonthly) {
      lines.push(`- Monthly: ~$${cost.opexMonthly.toLocaleString()}`);
    }
    if (cost.opexAnnual) {
      lines.push(`- Annual: ~$${cost.opexAnnual.toLocaleString()}`);
    }
    lines.push('');
  }

  if (cost.costPerRack) {
    lines.push(`## Unit Economics`);
    lines.push(`- Cost per rack: ~$${cost.costPerRack.toLocaleString()}`);
    if (cost.costPerGPU) {
      lines.push(`- Cost per GPU: ~$${cost.costPerGPU.toLocaleString()}`);
    }
    lines.push('');
  }

  if (cost.breakdownByCategory && Object.keys(cost.breakdownByCategory).length > 0) {
    lines.push(`## Breakdown by Category`);
    lines.push('');
    lines.push('| Category | Amount |');
    lines.push('|----------|--------|');
    for (const [category, amount] of Object.entries(cost.breakdownByCategory)) {
      lines.push(`| ${category} | ~$${(amount as number).toLocaleString()} |`);
    }
    lines.push('');
  }

  if (bom.grandTotal.value > 0) {
    lines.push(`## BOM Grand Total`);
    lines.push(`~$${bom.grandTotal.value.toLocaleString()} ${bom.currency}`);
    lines.push('');
  }

  if (cost.notes) {
    lines.push(`## Notes`);
    lines.push(cost.notes);
  }

  lines.push('');
  lines.push('> **Disclaimer:** All cost figures are estimates unless explicitly marked as quotes. Engage vendors for binding quotations.');

  return lines.join('\n');
}

/**
 * Build a narrative architecture writeup.
 */
export async function buildArchitectureWriteup(plan: CanonicalPlanState): Promise<string> {
  const planSummary = summarizePlanForPrompt(plan);
  
  const result = await createChatCompletion(
    'artifact_generation',
    [
      {
        role: 'system',
        content: `You are a senior infrastructure architect. Write a detailed architecture description for an AI data center plan.
Cover: physical layout, compute infrastructure, network topology, storage architecture, power and cooling, management services.
Use technical language appropriate for architects and engineers. Flag assumptions clearly.`,
      },
      {
        role: 'user',
        content: `Write an architecture description for this plan:\n\n${planSummary}`,
      },
    ],
    { temperature: 0.2 }
  );
  
  return result.content;
}

/**
 * Build a full markdown export of the plan.
 */
export function buildMarkdownExport(plan: CanonicalPlanState): string {
  const lines: string[] = [
    `# ${plan.project.value.name} — AI Data Center Plan`,
    '',
    `*Version ${plan.version} | Updated ${new Date(plan.updatedAt).toLocaleString()}*`,
    '',
    '---',
    '',
    '## Project Overview',
    '',
    `**Name:** ${plan.project.value.name}`,
    plan.project.value.description ? `**Description:** ${plan.project.value.description}` : '',
    plan.project.value.phase ? `**Phase:** ${plan.project.value.phase}` : '',
    plan.project.value.targetDate ? `**Target Date:** ${plan.project.value.targetDate}` : '',
    '',
    '## Site Information',
    '',
  ];

  const site = plan.site.value;
  if (site.city || site.state || site.country) {
    lines.push(`**Location:** ${[site.city, site.state, site.country].filter(Boolean).join(', ')}`);
  }
  if (site.region) lines.push(`**Region:** ${site.region}`);
  if (site.notes) lines.push(`**Notes:** ${site.notes}`);
  lines.push('');

  lines.push('## Infrastructure Summary');
  lines.push('');
  lines.push(`| Parameter | Value | Confidence |`);
  lines.push(`|-----------|-------|------------|`);
  lines.push(`| Rack Count | ${plan.rackCount.value} | ${plan.rackCount.provenance.confidence} |`);
  lines.push(`| Power per Rack | ${plan.rackPowerDensity.value} kW | ${plan.rackPowerDensity.provenance.confidence} |`);
  lines.push(`| Total Power | ${plan.totalPower.value} kW | ${plan.totalPower.provenance.confidence} |`);
  lines.push('');

  if (plan.computeInventory.value.length > 0) {
    lines.push('## Compute Inventory');
    lines.push('');
    lines.push('| Type | Vendor | Model | Qty | Per Rack |');
    lines.push('|------|--------|-------|-----|----------|');
    for (const item of plan.computeInventory.value) {
      lines.push(`| ${item.type} | ${item.vendor ?? '-'} | ${item.model ?? '-'} | ${item.quantity ?? '-'} | ${item.perRack ?? '-'} |`);
    }
    lines.push('');
  }

  if (plan.assumptions.length > 0) {
    lines.push('## Assumptions');
    lines.push('');
    for (const assumption of plan.assumptions) {
      lines.push(`- **${assumption.field}**: ${String(assumption.value)} *(${assumption.sourceType}, ${assumption.confidence})*`);
      if (assumption.reasoning) {
        lines.push(`  - Reasoning: ${assumption.reasoning}`);
      }
    }
    lines.push('');
  }

  if (plan.risks.length > 0) {
    lines.push('## Risks');
    lines.push('');
    for (const risk of plan.risks) {
      lines.push(`### ${risk.severity.toUpperCase()}: ${risk.category}`);
      lines.push(risk.description);
      if (risk.mitigation) lines.push(`**Mitigation:** ${risk.mitigation}`);
      lines.push('');
    }
  }

  if (plan.openQuestions.length > 0) {
    lines.push('## Open Questions');
    lines.push('');
    for (const q of plan.openQuestions) {
      lines.push(`- ${q}`);
    }
    lines.push('');
  }

  return lines.filter((l) => l !== undefined).join('\n');
}

/**
 * Build a clean JSON export of the plan.
 */
export function buildJSONExport(plan: CanonicalPlanState): string {
  return JSON.stringify(plan, null, 2);
}

// Helper: create a concise text summary of the plan for prompts
function summarizePlanForPrompt(plan: CanonicalPlanState): string {
  const site = plan.site.value;
  const network = plan.networkArchitecture.value;
  const cooling = plan.coolingAssumptions.value;
  const topology = plan.topologyRelationships.value;

  return [
    `Project: ${plan.project.value.name}`,
    site.city ? `Location: ${[site.city, site.state, site.country].filter(Boolean).join(', ')}` : '',
    `Rack count: ${plan.rackCount.value} (${plan.rackCount.provenance.confidence} confidence)`,
    `Power per rack: ${plan.rackPowerDensity.value} kW`,
    `Total power: ${plan.totalPower.value} kW`,
    cooling.type ? `Cooling: ${cooling.type}, PUE: ${cooling.pue ?? 'unknown'}` : '',
    network.architecture ? `Network: ${network.architecture}` : '',
    topology.spines ? `Topology: ${topology.spines} spines, ${topology.leaves} leaves` : '',
    plan.computeInventory.value.length > 0
      ? `Compute: ${plan.computeInventory.value.map((c) => `${c.quantity ?? '?'}x ${c.model ?? c.type}`).join(', ')}`
      : '',
    plan.assumptions.length > 0
      ? `Key assumptions: ${plan.assumptions.slice(0, 3).map((a) => `${a.field}=${String(a.value)}`).join(', ')}`
      : '',
    plan.risks.length > 0
      ? `Risks: ${plan.risks.length} identified`
      : '',
    plan.openQuestions.length > 0
      ? `Open questions: ${plan.openQuestions.length}`
      : '',
  ]
    .filter(Boolean)
    .join('\n');
}
