import { Copy } from 'lucide-react';
import { useToast } from '../toast.jsx';

// navigator.clipboard only exists on HTTPS or localhost; on plain HTTP fall back to
// copying from a temporary textarea.
async function copyText(text) {
  if (window.isSecureContext && navigator.clipboard) {
    await navigator.clipboard.writeText(text);
    return;
  }
  const area = Object.assign(document.createElement('textarea'), { value: text, readOnly: true });
  area.style.cssText = 'position:fixed;top:0;left:0;opacity:0';
  document.body.appendChild(area);
  area.select();
  const ok = document.execCommand('copy');
  area.remove();
  if (!ok) throw new Error('Copy failed');
}

export default function CopyCode({ code, compact }) {
  const toast = useToast();

  async function copy(e) {
    e.preventDefault();
    e.stopPropagation();
    try {
      await copyText(code);
      toast(`Class code ${code} copied`);
    } catch {
      toast(`Could not copy. Class code: ${code}`, 'error');
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
