import React from 'react';
import { useL } from '../../utils/bi';
import { NA } from '../../components/furas/FurasParts';

// The Investment contracts pages read the Databank exports from a local folder. Where that folder is not configured (always on a deployment) nothing is shown.
export default function FurasUnavailable() {
  const { L } = useL();
  return (
    <div className="fu-page"><div className="fu-card" role="status">
      <h1 className="fu-title"><NA /></h1>
      <p>{L('The Investment contracts pages read the Databank exports from a local folder; the exports are never committed, built or deployed. They are not configured on this server, so no contract is shown.', 'تقرأ صفحات العقود الاستثمارية تصديرات بنك البيانات من مجلد محلي؛ ولا تُرفع التصديرات إلى Git ولا تدخل أي إصدار ولا تُنشر. وهي غير مهيّأة على هذا الخادم، فلا يُعرض أي عقد.')}</p>
      <p className="muted">{L('To enable them on your machine, put the folder path in the git-ignored file furas-exports.local (or set FURAS_EXPORT_DIR) and restart the data service.', 'لتفعيلها على جهازك ضع مسار المجلد في الملف furas-exports.local (المستثنى من Git) أو اضبط FURAS_EXPORT_DIR ثم أعد تشغيل خدمة البيانات.')}</p>
    </div></div>
  );
}
