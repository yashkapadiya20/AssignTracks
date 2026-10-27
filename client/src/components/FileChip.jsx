import { useState } from 'react';
import { Download, Eye, FileText, X } from 'lucide-react';
import FilePreviewModal, { previewType } from './FilePreviewModal.jsx';
import { downloadFile } from '../lib/api.js';
import { formatSize } from '../lib/format.js';
import { useToast } from '../toast.jsx';

// Shows an attached file. Pass `submissionId` to allow preview/download, `onRemove` to allow removing.
export default function FileChip({ name, size, submissionId, onRemove }) {
  const toast = useToast();
  const [previewing, setPreviewing] = useState(false);
  const canPreview = submissionId && previewType(name);

  async function download() {
    try {
      await downloadFile(`/submissions/${submissionId}/file`, name);
    } catch (err) {
      toast(err.message, 'error');
    }
  }

  return (
    <div className="file-chip">
      <span className="file-icon">
        <FileText size={18} />
      </span>
      <div className="file-meta">
        <span className="truncate">{name}</span>
        {size != null && <span className="muted small">{formatSize(size)}</span>}
      </div>
      {canPreview && (
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => setPreviewing(true)}>
          <Eye size={15} /> Preview
        </button>
      )}
      {submissionId && (
        <button type="button" className="icon-btn" onClick={download} title="Download" aria-label={`Download ${name}`}>
          <Download size={17} />
        </button>
      )}
      {onRemove && (
        <button type="button" className="icon-btn" onClick={onRemove} title="Remove file" aria-label={`Remove ${name}`}>
          <X size={17} />
        </button>
      )}
      {previewing && <FilePreviewModal submissionId={submissionId} name={name} onClose={() => setPreviewing(false)} />}
    </div>
  );
}
