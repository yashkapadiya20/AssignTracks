import { useEffect, useRef, useState } from 'react';
import { Download } from 'lucide-react';
import Modal from './Modal.jsx';
import { Spinner, ErrorBox } from './ui.jsx';
import { downloadFile, fetchFile } from '../lib/api.js';
import { useToast } from '../toast.jsx';

export const previewType = (name = '') => {
  const ext = name.split('.').pop().toLowerCase();
  return ext === 'pdf' || ext === 'docx' ? ext : null;
};

// Shows a submitted PDF (browser viewer) or DOCX (rendered with docx-preview) in a modal.
export default function FilePreviewModal({ submissionId, name, onClose }) {
  const toast = useToast();
  const type = previewType(name);
  const docxRef = useRef(null);
  const [pdfUrl, setPdfUrl] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const path = `/submissions/${submissionId}/file`;

  useEffect(() => {
    let cancelled = false;
    let url = null;
    setLoading(true);
    setError('');
    (async () => {
      try {
        const blob = await fetchFile(path);
        if (cancelled) return;
        if (type === 'pdf') {
          url = URL.createObjectURL(new Blob([blob], { type: 'application/pdf' }));
          setPdfUrl(url);
        } else {
          // Loaded only when needed, so it doesn't slow down the rest of the app.
          const { renderAsync } = await import('docx-preview');
          if (cancelled) return;
          await renderAsync(blob, docxRef.current, null, { inWrapper: true, ignoreLastRenderedPageBreak: true });
        }
      } catch (err) {
        if (!cancelled) setError(type === 'docx' ? 'Could not open this document. Try downloading it.' : err.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [path, type, attempt]);

  async function download() {
    try {
      await downloadFile(path, name);
    } catch (err) {
      toast(err.message, 'error');
    }
  }

  return (
    <Modal
      title={name}
      onClose={onClose}
      className="modal-preview"
      footer={
        <button className="btn btn-secondary" onClick={download}>
          <Download size={16} /> Download
        </button>
      }
    >
      {loading && <Spinner />}
      {error && <ErrorBox message={error} onRetry={() => setAttempt((n) => n + 1)} />}
      {type === 'pdf' && pdfUrl && <iframe className="preview-frame" src={pdfUrl} title={name} />}
      {type === 'docx' && <div ref={docxRef} className="preview-docx" hidden={loading || !!error} />}
    </Modal>
  );
}
