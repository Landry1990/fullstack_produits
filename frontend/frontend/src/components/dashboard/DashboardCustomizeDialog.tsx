import { useTranslation } from 'react-i18next';
import { RotateCcw, SlidersHorizontal } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '../shadcn/dialog';
import { Switch } from '../shadcn/switch';
import { Button } from '../shadcn/button';
import { useDashboardPrefs, DASHBOARD_WIDGET_GROUPS } from '../../hooks/useDashboardPrefs';

interface DashboardCustomizeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function DashboardCustomizeDialog({ open, onOpenChange }: DashboardCustomizeDialogProps) {
  const { t } = useTranslation(['dashboard', 'common']);
  const { isVisible, setVisible, resetAll } = useDashboardPrefs();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <SlidersHorizontal className="size-4 text-slate-500" />
            {t('customize.title')}
          </DialogTitle>
          <DialogDescription>{t('customize.subtitle')}</DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {DASHBOARD_WIDGET_GROUPS.map((group) => (
            <div key={group.group}>
              <h3 className="text-micro font-bold text-slate-400 uppercase tracking-widest mb-2">
                {t(group.groupLabelKey)}
              </h3>
              <div className="space-y-1">
                {group.widgets.map((widget) => (
                  <label
                    key={widget.key}
                    className="flex items-center justify-between gap-3 px-3 py-2 rounded-lg hover:bg-slate-50 cursor-pointer"
                  >
                    <span className="text-sm font-medium text-slate-700">
                      {t(widget.labelKey)}
                    </span>
                    <Switch
                      checked={isVisible(widget.key)}
                      onCheckedChange={(checked) => setVisible(widget.key, checked)}
                      aria-label={t(widget.labelKey)}
                    />
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            size="sm"
            onClick={() => resetAll()}
            className="gap-2"
          >
            <RotateCcw className="size-3.5" />
            {t('customize.reset')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
