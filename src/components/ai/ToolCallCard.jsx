import React, { useState } from 'react';
import { useI18n } from '../../context/I18nContext';

/**
 * JsonView — pretty-print a JSON-serializable object as syntax-highlighted,
 * monospace text. Keys are tinted; string/number/boolean values get their own
 * tone. Purely presentational, safe for LTR & RTL (forced dir="ltr" on the
 * code block so JSON never mirrors).
 */
function JsonView({ value }) {
  const text = JSON.stringify(value, null, 2);
  const lines = text.split('\n');
  return (
    <pre className="tool-json" dir="ltr">
      {lines.map((line, i) => {
        const m = line.match(/^(\s*)"([^"]+)":\s*(.*)$/);
        if (m) {
          const [, indent, key, rest] = m;
          return (
            <div key={i} className="tool-json__line">
              {indent}
              <span className="tool-json__key">&quot;{key}&quot;</span>
              <span className="tool-json__punc">: </span>
              <JsonValue raw={rest} />
            </div>
          );
        }
        return (
          <div key={i} className="tool-json__line tool-json__punc">{line}</div>
        );
      })}
    </pre>
  );
}

function JsonValue({ raw }) {
  const trimmed = raw.replace(/,\s*$/, '');
  const comma = raw.endsWith(',') ? ',' : '';
  let cls = 'tool-json__num';
  if (/^".*"$/.test(trimmed)) cls = 'tool-json__str';
  else if (trimmed === 'true' || trimmed === 'false') cls = 'tool-json__bool';
  else if (trimmed === '{' || trimmed === '[' || trimmed === '}' || trimmed === ']') cls = 'tool-json__punc';
  else if (trimmed === 'null') cls = 'tool-json__bool';
  return (
    <>
      <span className={cls}>{trimmed}</span>
      <span className="tool-json__punc">{comma}</span>
    </>
  );
}

/**
 * ToolCallCard — a realistic tool/API invocation card (LangSmith-style):
 * tool name, a compact JSON request, a latency chip, and a collapsible,
 * pretty-printed JSON response. While `running`, shows a "tool running…"
 * spinner in place of the response; the parent TraceBlock resolves it.
 *
 * Props:
 *  - tool: string (e.g. "tahseel.query_invoice")
 *  - request: JSON-serializable object
 *  - response: JSON-serializable object
 *  - latency: number (ms)
 *  - running: boolean
 */
export default function ToolCallCard({ tool, request, response, latency, running }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(true);

  return (
    <div className={`tool-call${running ? ' tool-call--running' : ''}`}>
      <div className="tool-call__head">
        <span className="tool-call__badge">{t('trace_tool_call')}</span>
        <code className="tool-call__name" dir="ltr">{tool}</code>
        {!running && typeof latency === 'number' ? (
          <span className="tool-call__latency">{latency}ms</span>
        ) : null}
      </div>

      <div className="tool-call__section">
        <div className="tool-call__label">{t('trace_request')}</div>
        <JsonView value={request} />
      </div>

      {running ? (
        <div className="tool-call__running">
          <span className="ai-spinner" aria-hidden="true" />
          <span>{t('trace_running')}</span>
        </div>
      ) : (
        <div className="tool-call__section">
          <div className="tool-call__label tool-call__label--btn">
            <span>{t('trace_response')}</span>
            <button type="button" className="tool-call__toggle" onClick={() => setOpen((o) => !o)}>
              {open ? t('trace_hide') : t('trace_show')}
            </button>
          </div>
          {open ? <JsonView value={response} /> : null}
        </div>
      )}
    </div>
  );
}
