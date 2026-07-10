'use client';

import { describeStep, stepTone, type AppLang } from '@/domain/agent-transcript';
import type { TranscriptStep } from '@/domain/agents';

/**
 * The one merchant-facing renderer for an agent thinking chain (UI-alignment pass, Multica-inspired:
 * tone-colored type pill + one human sentence per step; raw payloads live behind a "查看数据" expander,
 * never inline). Used by BOTH the 今日 reasoning sheet and the /merchant/agents run page, so the same
 * run reads identically wherever the merchant meets it.
 */
export function TranscriptChain({ steps, language }: { steps: TranscriptStep[]; language: AppLang }) {
  const dataLabel = language === 'zh-CN' ? '查看数据' : 'View data';
  return (
    <ol className="agent-chain">
      {steps.map((step, i) => {
        const d = describeStep(step, language);
        const tone = stepTone(step.kind);
        return (
          <li key={i} className={`agent-chain-step agent-chain-tone-${tone}`}>
            <span className={`agent-chain-pill agent-chain-pill-${tone}`}>{d.label}</span>
            <p className="agent-chain-text">{d.summary}</p>
            {d.detail ? (
              <details className="agent-chain-details">
                <summary>{dataLabel}</summary>
                <pre>{d.detail}</pre>
              </details>
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}
