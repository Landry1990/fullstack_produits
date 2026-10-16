import { BackupCard } from './BackupCard';
import { RestoreCard } from './RestoreCard';
import { CodeManagementCard } from './CodeManagementCard';
import { ManualUpdateCard } from './ManualUpdateCard';
import type { UseBackupRestoreReturn } from './useBackupRestore';
import type { UseManualUpdateReturn } from './useManualUpdate';

interface BackupsTabProps {
  backup: UseBackupRestoreReturn;
  update: UseManualUpdateReturn;
}

export function BackupsTab({ backup, update }: BackupsTabProps) {
  return (
    <div className="flex flex-col gap-4">
      {/* Backup Section */}
      <BackupCard backup={backup} />

      {/* Restoration Section */}
      <RestoreCard backup={backup} />

      {/* Source Code Management Section */}
      <CodeManagementCard />

      {/* Mise à jour manuelle */}
      <ManualUpdateCard update={update} />
    </div>
  );
}
