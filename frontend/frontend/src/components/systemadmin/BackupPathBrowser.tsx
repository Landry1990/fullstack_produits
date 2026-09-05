import { useState, useEffect, useCallback } from 'react';
import { Folder, File, ChevronUp, HardDrive, X } from 'lucide-react';
import api from '../../services/api';
import { gooeyToast } from 'goey-toast';
import { Button } from '../shadcn/button';
import { Input } from '../shadcn/input';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '../shadcn/dialog';

interface BrowseEntry {
  name: string;
  path: string;
  type: 'directory' | 'file';
  size_mb?: number;
}

interface BrowseResponse {
  path: string;
  parent: string | null;
  entries: BrowseEntry[];
}

interface BackupPathBrowserProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (path: string) => void;
  t: (key: string) => string;
}

const QUICK_ROOTS = ['/', '/mnt', '/media', '/opt', '/backups'];

export function BackupPathBrowser({ open, onOpenChange, onSelect, t }: BackupPathBrowserProps) {
  const [path, setPath] = useState('/');
  const [manualPath, setManualPath] = useState('/');
  const [entries, setEntries] = useState<BrowseEntry[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async (target: string) => {
    setLoading(true);
    try {
      const res = await api.get<BrowseResponse>(`/system-admin/browse/?path=${encodeURIComponent(target)}`);
      setPath(res.data.path);
      setManualPath(res.data.path);
      setEntries(res.data.entries);
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      gooeyToast.error(detail || t('backup.browse.load_error'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    if (open) {
      load('/');
    }
  }, [open, load]);

  const handleGo = async () => {
    await load(manualPath);
  };

  const handleParent = async () => {
    const parent = path === '/' ? '/' : path.substring(0, path.lastIndexOf('/')) || '/';
    await load(parent);
  };

  const handleSelect = () => {
    onSelect(path);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <HardDrive className="size-5 text-indigo-600" />
            {t('backup.browse.title')}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          {/* Barre de chemin */}
          <div className="flex items-center gap-2">
            <Input
              value={manualPath}
              onChange={(e) => setManualPath(e.target.value)}
              className="flex-1 text-sm"
              onKeyDown={(e) => { if (e.key === 'Enter') handleGo(); }}
            />
            <Button size="sm" variant="outline" onClick={handleGo} disabled={loading}>
              {t('backup.browse.go')}
            </Button>
            <Button size="sm" variant="outline" onClick={handleParent} disabled={loading || path === '/'}>
              <ChevronUp className="size-4" />
            </Button>
          </div>

          {/* Racines rapides */}
          <div className="flex flex-wrap gap-2">
            {QUICK_ROOTS.map((root) => (
              <Button
                key={root}
                size="sm"
                variant={path === root ? 'default' : 'outline'}
                onClick={() => load(root)}
                disabled={loading}
              >
                {root}
              </Button>
            ))}
          </div>

          {/* Liste */}
          <div className="border border-slate-200 rounded-lg overflow-hidden max-h-80 overflow-y-auto">
            {loading ? (
              <div className="p-4 text-center text-sm text-slate-500">{t('backup.browse.loading')}</div>
            ) : entries.length === 0 ? (
              <div className="p-4 text-center text-sm text-slate-400">{t('backup.browse.empty')}</div>
            ) : (
              <div className="divide-y divide-slate-100">
                {entries.filter((e) => e.type === 'directory').map((entry) => (
                  <button
                    key={entry.path}
                    type="button"
                    onClick={() => load(entry.path)}
                    className="w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-slate-50 transition-colors"
                  >
                    <Folder className="size-4 text-amber-500 shrink-0" />
                    <span className="text-sm text-slate-700 flex-1 truncate">{entry.name}</span>
                  </button>
                ))}
                {entries.filter((e) => e.type === 'file').map((entry) => (
                  <div
                    key={entry.path}
                    className="flex items-center gap-3 px-3 py-2 text-slate-400"
                  >
                    <File className="size-4 text-slate-300 shrink-0" />
                    <span className="text-sm flex-1 truncate">{entry.name}</span>
                    <span className="text-xs">{entry.size_mb} MB</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              <X className="size-4" />
              {t('backup.browse.cancel')}
            </Button>
            <Button onClick={handleSelect} disabled={loading}>
              {t('backup.browse.select')}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
