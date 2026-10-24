import { Download, FileText, X } from 'lucide-react';
import { downloadFile } from '../lib/api.js';
import { formatSize } from '../lib/format.js';
import { useToast } from '../toast.jsx';

// Shows an attached file. Pass `submissionId` to allow downloading, `onRemove` to allow removing.
export default function FileChip({ name, size, submissionId, onRemove }) {
  const toast = useToast();

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
    </div>
  );
}
