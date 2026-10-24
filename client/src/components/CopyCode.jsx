import { Copy } from 'lucide-react';
import { useToast } from '../toast.jsx';

export default function CopyCode({ code, compact }) {
  const toast = useToast();

  async function copy(e) {
    e.preventDefault();
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(code);
      toast(`Class code ${code} copied`);
    } catch {
      toast(`Class code: ${code}`);
    }
  }

  return (
    <button className={`code-chip ${compact ? 'compact' : ''}`} onClick={copy} title="Copy class code">
      {!compact && <span className="code-label">Class code</span>}
      <span className="code-value">{code}</span>
      <Copy size={14} />
    </button>
  );
}
