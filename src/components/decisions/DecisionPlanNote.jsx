// The source of the Decision Room's plan items: the configured reference plan (name + version) — or, when there is none to read, WHY (ambiguous · none · reference_invalid · not loaded · no access) with the link to the plans page.
// An unavailable plan is a visible state, never an empty list that reads as «no deviation». Reads `context.plan` of src/data/decisionRoom.js.
import React from 'react';
import { Link } from 'react-router-dom';
import { useAr } from '../../utils/useAr';

export default function DecisionPlanNote({ plan }) {
  const { L, B } = useAr();
  if (!plan) return null;
  if (plan.available === false) {
    return (
      <div className="rv-callout rv-callout--warn" role="status" data-plan-state={plan.state}>
        <b>{L('بنود الخطة غير متاحة', 'Plan items are unavailable')}</b>
        <div>{plan.notice ? B(plan.notice) : null}</div>
        <Link className="btn btn-sm" to={plan.link || '/planning'}>{L('فتح خطط الإيرادات', 'Open the revenue plans')}</Link>
      </div>
    );
  }
  if (!plan.source) return null;
  return (
    <p className="muted dr-basisnote" data-plan-source={plan.source.versionId}>
      {L('مصدر بنود الخطة: ', 'Source of the plan items: ')}<Link to={`/planning/${plan.source.planId}`}>{B(plan.source.label)}</Link>
      {plan.restricted ? ` — ${L('إجمالي الجهات المتاحة لك', 'total of the entities available to you')}` : ''}
    </p>
  );
}
