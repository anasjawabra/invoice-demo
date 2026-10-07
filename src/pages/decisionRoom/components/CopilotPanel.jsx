import React, { useState } from 'react';
import { matchCopilotQuestion, parseWhatIf, applyWhatIf, CFO_DEFAULT_ANSWER_KEY } from '../../../data/cfoCopilot';
import CopilotAnswerCard from './CopilotAnswerCard';

// Input box + history for the scripted AI Financial Planning Copilot. On
// ask: tries parseWhatIf() first (applies the parsed assumption change via
// onAssumptionsChange and shows a confirmation card), else matches a known
// question pattern, else shows the default "what I can answer" message.
export default function CopilotPanel({ t, money, model, assumptions, onAssumptionsChange }) {
  const [input, setInput] = useState('');
  const [history, setHistory] = useState([]);

  const ask = () => {
    const question = input.trim();
    if (!question) return;
    setInput('');

    const whatIf = parseWhatIf(question);
    if (whatIf) {
      onAssumptionsChange(applyWhatIf(assumptions, whatIf));
      setHistory((prev) => [...prev, {
        question,
        answer: {
          finding: t('cfo_copilot_whatif_applied'),
          driver: t('cfo_copilot_whatif_driver'),
          impact: [],
          scenario: t('cfo_copilot_whatif_scenario'),
          action: t('cfo_copilot_whatif_action'),
          basis: 'cfoCopilot.parseWhatIf → onAssumptionsChange'
        }
      }]);
      return;
    }

    const matched = matchCopilotQuestion(question);
    if (matched) {
      setHistory((prev) => [...prev, { question, answer: matched.build(model, money, t) }]);
    } else {
      setHistory((prev) => [...prev, {
        question,
        answer: { finding: t(CFO_DEFAULT_ANSWER_KEY), driver: '', impact: [], scenario: '', action: '', basis: '—' }
      }]);
    }
  };

  return (
    <div className="card card-pad">
      <div className="page-title" style={{ fontSize: 'var(--text-md)' }}>{t('cfo_copilot_title')}</div>
      <div className="page-sub">{t('cfo_copilot_sub')}</div>
      <p className="muted" style={{ fontSize: 'var(--text-2xs)', marginTop: 'var(--spacing-xs)' }}>{t('cfo_copilot_disclosure')}</p>

      <div style={{ display: 'flex', gap: 'var(--spacing-md)', marginTop: 'var(--spacing-md)' }}>
        <input
          className="input" value={input} placeholder={t('cfo_copilot_placeholder')}
          aria-label={t('cfo_copilot_placeholder')}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && ask()}
        />
        <button type="button" className="btn btn-sm btn-primary" onClick={ask}>{t('cfo_copilot_ask')}</button>
      </div>

      {history.length === 0 ? (
        <p className="muted" style={{ marginTop: 'var(--spacing-md)' }}>{t('cfo_copilot_empty')}</p>
      ) : (
        [...history].reverse().map((h, i) => <CopilotAnswerCard key={i} question={h.question} answer={h.answer} t={t} />)
      )}
    </div>
  );
}
