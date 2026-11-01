import React from 'react';
import { Pdf01Icon, Doc01Icon, Xls01Icon, Csv01Icon, Ppt01Icon, Image01Icon, FileUnknownIcon } from '@hugeicons/core-free-icons';
import UIIcon from './UIIcon';

// The adjacent filename/type label supplies the accessible name.
const icons = { pdf: Pdf01Icon, doc: Doc01Icon, docx: Doc01Icon, sheet: Xls01Icon, xls: Xls01Icon, xlsx: Xls01Icon, csv: Csv01Icon, ppt: Ppt01Icon, pptx: Ppt01Icon, image: Image01Icon };

export default function FileTypeIcon({ kind, size = 22 }) {
  return <UIIcon icon={icons[kind] || FileUnknownIcon} size={size} />;
}
