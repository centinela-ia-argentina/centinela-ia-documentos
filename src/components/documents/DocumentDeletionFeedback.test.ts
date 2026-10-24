/** @vitest-environment jsdom */
import React from 'react';
import { afterEach, it, expect } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { DocumentDeletionFeedback } from './DocumentDeletionFeedback';
afterEach(cleanup);
it('only confirmed completion is announced as success',()=>{render(React.createElement(DocumentDeletionFeedback,{result:'ok'}));expect(screen.getByRole('status').textContent).toContain('eliminado correctamente');});
for(const result of ['failed','partial','audit'])it('explicit warning: '+result,()=>{render(React.createElement(DocumentDeletionFeedback,{result}));expect(screen.getByRole('alert')).toBeDefined();expect(screen.queryByRole('status')).toBeNull();});
it('partial does not claim rollback or complete deletion',()=>{render(React.createElement(DocumentDeletionFeedback,{result:'partial'}));expect(screen.getByRole('alert').textContent).toContain('Puede haberse borrado');expect(screen.getByRole('alert').textContent).toContain('no se confirma una eliminación completa');});
it('unknown provider errors are not reflected into the page',()=>{render(React.createElement(DocumentDeletionFeedback,{result:'private/path <script>'}));expect(document.body.textContent).toBe('');});
