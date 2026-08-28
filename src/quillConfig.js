import { Quill } from 'react-quill';
import ImageResize from 'quill-image-resize-module-react';
import QuillBetterTable from 'quill-better-table';
import 'quill-better-table/dist/quill-better-table.css';

// Register modules once, silently (won't overwrite if already registered)
Quill.register('modules/imageResize', ImageResize, true);
Quill.register({
  'modules/better-table': QuillBetterTable
}, true);