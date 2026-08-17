import { useTranslation } from 'react-i18next';
import { Button } from '../shadcn/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '../shadcn/dialog';

interface CommandeDeleteModalsProps {
    productToDelete: number | null;
    isDeletingMultiple: boolean;
    selectedRowsSize: number;
    onClearProductToDelete: () => void;
    onConfirmDeleteProduct: (index: number) => void;
    onClearDeletingMultiple: () => void;
    onConfirmDeleteMultiple: () => void;
}

export function CommandeDeleteModals({
    productToDelete,
    isDeletingMultiple,
    selectedRowsSize,
    onClearProductToDelete,
    onConfirmDeleteProduct,
    onClearDeletingMultiple,
    onConfirmDeleteMultiple,
}: CommandeDeleteModalsProps) {
    const { t } = useTranslation(['orders', 'common']);

    return (
        <>
            <Dialog open={productToDelete !== null} onOpenChange={(open) => { if (!open) onClearProductToDelete(); }}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle className="text-red-600">{t('common:confirm_deletion', 'Confirmer la suppression')}</DialogTitle>
                        <DialogDescription>{t('orders:messages.remove_product_confirm', 'Êtes-vous sûr de vouloir retirer ce produit de la commande ?')}</DialogDescription>
                    </DialogHeader>
                    <div className="flex justify-end gap-3 pt-4">
                        <Button type="button" variant="ghost" onClick={onClearProductToDelete}>{t('common:cancel')}</Button>
                        <Button type="button" variant="destructive" onClick={() => {
                            if (productToDelete !== null) onConfirmDeleteProduct(productToDelete);
                            onClearProductToDelete();
                        }}>{t('common:confirm')}</Button>
                    </div>
                </DialogContent>
            </Dialog>

            <Dialog open={isDeletingMultiple} onOpenChange={(open) => { if (!open) onClearDeletingMultiple(); }}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle className="text-red-600">{t('orders:bulk_delete_title', 'Confirmer la suppression multiple')}</DialogTitle>
                        <DialogDescription>{t('orders:bulk_delete_confirm_minimal', { count: selectedRowsSize })}</DialogDescription>
                    </DialogHeader>
                    <div className="flex justify-end gap-3 pt-4">
                        <Button type="button" variant="ghost" onClick={onClearDeletingMultiple}>{t('common:cancel')}</Button>
                        <Button type="button" variant="destructive" onClick={() => {
                            onConfirmDeleteMultiple();
                            onClearDeletingMultiple();
                        }}>{t('common:confirm')}</Button>
                    </div>
                </DialogContent>
            </Dialog>
        </>
    );
}
