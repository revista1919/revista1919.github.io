import { Quill } from 'react-quill';
import ImageResize from 'quill-image-resize-module-react';

// Register ImageResize module once, silently (won't overwrite if already registered)
Quill.register('modules/imageResize', ImageResize, true);