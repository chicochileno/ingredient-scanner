import { useState } from 'react';
import { createShare, revokeShare, shareUrl } from './shareClient';

// props:
//  type: 'profile' | 'list'
//  refId: profile/list id
//  existingShareId: string | null
//  profiles: [{ id, name }]   (list shares only; for picking the child)
//  onClose
export default function ShareSheet({ type, refId, existingShareId, profiles = [], onClose }) {
  const [shareId, setShareId] = useState(existingShareId || null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const needsProfile = type === 'list' && profiles.length > 1;
  const [profileId, setProfileId] = useState(
    type === 'list' ? (profiles[0]?.id || null) : null
  );

  const url = shareId ? shareUrl(shareId) : '';

  async function create() {
    if (busy) return;
    setBusy(true);
    try {
      const id = await createShare(type, refId, type === 'list' ? profileId : null);
      setShareId(id);
    } catch (e) { console.error('Create share failed:', e); }
    finally { setBusy(false); }
  }
  async function revoke() {
    if (busy) return;
    setBusy(true);
    try { await revokeShare(type, refId, shareId); setShareId(null); }
    catch (e) { console.error('Revoke failed:', e); }
    finally { setBusy(false); }
  }
  async function copy() {
    try { await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 1500); }
    catch (e) { console.error('Copy failed:', e); }
  }
  async function nativeShare() {
    try { if (navigator.share) await navigator.share({ url }); else copy(); }
    catch { /* user cancelled */ }
  }

  return (
    <div className="allergen-sheet-backdrop" onClick={onClose}>
      <div className="allergen-sheet" onClick={(e) => e.stopPropagation()} onKeyDown={(e) => { if (e.key === 'Escape') onClose(); }} role="dialog" aria-modal="true" aria-label="Share">
        <div className="allergen-sheet-handle" />
        <h2 className="allergen-sheet-title">Share {type === 'profile' ? 'profile' : 'list'}</h2>

        {!shareId && needsProfile && (
          <>
            <label htmlFor="share-profile" className="pe-label">Safe for which child?</label>
            <select id="share-profile" className="allergen-input" value={profileId || ''}
              onChange={(e) => setProfileId(e.target.value)} autoFocus>
              {profiles.map((p) => <option key={p.id} value={p.id}>{p.name || 'Unnamed'}</option>)}
            </select>
          </>
        )}

        {!shareId ? (
          <button className="allergen-save-btn" onClick={create} disabled={busy} autoFocus>
            {busy ? 'Creating…' : 'Create link'}
          </button>
        ) : (
          <>
            <p className="pe-label">Anyone with this link can view it — no account needed.</p>
            <input className="allergen-input" value={url} readOnly aria-label="Share link"
              onFocus={(e) => e.target.select()} />
            <div className="share-actions">
              <button className="allergen-save-btn" onClick={nativeShare} autoFocus>Share</button>
              <button className="share-copy" onClick={copy}>{copied ? 'Copied ✓' : 'Copy'}</button>
            </div>
            <a className="share-preview" href={url} target="_blank" rel="noopener noreferrer">Preview</a>
            <button className="share-revoke" onClick={revoke} disabled={busy}>Stop sharing</button>
          </>
        )}
      </div>
    </div>
  );
}
