import { useTranslation } from 'react-i18next';
import { Package, RefreshCw, FileUp, FileDown, Loader2, Trash2 } from 'lucide-react';
import { Button } from '../shadcn/button';
import { Checkbox } from '../shadcn/checkbox';
import { downloadRapport } from './utils';
import type { UseProductsMaintenanceReturn } from './useProductsMaintenance';

interface ProductsCardProps {
  products: UseProductsMaintenanceReturn;
}

export function ProductsCard({ products }: ProductsCardProps) {
  const { t } = useTranslation(['maintenance', 'common']);

  return (
    <div className="bg-white shadow-xl rounded-2xl border border-indigo-500/20">
      <div className="p-6 space-y-4">
        <h2 className="text-lg font-bold flex items-center gap-2">
          <Package className="size-5 text-indigo-500" />
          {t('products_title')}
        </h2>

        {/* Compteur */}
        <div className="flex items-center justify-between bg-slate-100/50 rounded-lg px-4 py-2">
          <span className="text-sm text-slate-500">{t('products_in_db')}</span>
          <div className="flex items-center gap-2">
            <span className="font-bold text-lg text-indigo-500">
              {products.produitsCount === null ? '...' : products.produitsCount.toLocaleString()}
            </span>
            <Button variant="ghost" size="sm" className="h-auto p-1" onClick={products.refreshProduitsCount}>
              <RefreshCw className="size-3" />
            </Button>
          </div>
        </div>

        <div className="border-t border-slate-200 my-0 text-xs text-center text-slate-400 py-1">{t('maintenance:section_import')}</div>

        {/* Import Excel */}
        <div className="space-y-2">
          <p className="text-xs text-slate-500">{t('import_description')}</p>
          <div className="w-full">
            <input
              type="file"
              accept=".xlsx,.xls,.csv"
              className="block w-full text-sm text-slate-500 file:mr-3 file:py-1 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-medium file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100 cursor-pointer"
              onChange={e => products.handleImportFileChange(e.target.files?.[0] || null)}
            />
          </div>
          <Button
            variant="default"
            size="sm"
            className="w-full gap-2 !whitespace-normal"
            onClick={products.handleImportProduits}
            disabled={products.importing || !products.importFile}
          >
            {products.importing ? <Loader2 className="size-4 animate-spin" /> : <FileUp className="size-4" />}
            {products.importing ? t('importing') : t('import_button')}
          </Button>

          {products.importing && (
            <div className="space-y-1 animate-in fade-in duration-300">
              <div className="flex justify-between text-xs text-slate-500">
                <span className="italic">{products.importMessage}</span>
                <span className="font-bold text-indigo-500">{products.importProgress}%</span>
              </div>
              <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
                <div className="h-full bg-indigo-600 rounded-full transition-all" style={{ width: `${products.importProgress}%` }} />
              </div>
            </div>
          )}

          {/* Résultat import */}
          {products.importResult && (
            <div className="bg-slate-100 rounded-lg p-3 space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-500">{t('import_result.created')}</span>
                <span className="font-bold text-emerald-600">{products.importResult.created}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">{t('import_result.updated')}</span>
                <span className="font-bold text-blue-600">{products.importResult.updated}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">{t('import_result.errors')}</span>
                <span className={`font-bold ${products.importResult.errors > 0 ? 'text-red-600' : 'text-slate-400'}`}>{products.importResult.errors}</span>
              </div>
              {products.importResult.rapport_xlsx && (
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full gap-1 mt-2 border-emerald-500 text-emerald-600 hover:bg-emerald-50"
                  onClick={() => downloadRapport(products.importResult!.rapport_xlsx as string, t)}
                >
                  <FileDown className="size-3" /> {t('download_excel_report')}
                </Button>
              )}
              {products.importResult.rapport_txt && (
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full gap-1"
                  onClick={() => downloadRapport(products.importResult!.rapport_txt as string, t)}
                >
                  <FileDown className="size-3" /> {t('download_text_report')}
                </Button>
              )}
            </div>
          )}
        </div>

        <div className="border-t border-slate-200 my-0 text-xs text-center text-slate-400 py-1">{t('maintenance:section_export')}</div>

        {/* Export Excel */}
        <div className="space-y-2">
          <p className="text-xs text-slate-500">{t('maintenance:export_description')}</p>
          <Button
            variant="outline"
            size="sm"
            className="w-full gap-2 border-emerald-500 text-emerald-600 hover:bg-emerald-50"
            onClick={products.handleExportProduits}
            disabled={products.exportingProduits || products.produitsCount === 0}
          >
            {products.exportingProduits ? <Loader2 className="size-4 animate-spin" /> : <FileDown className="size-4" />}
            {products.exportingProduits ? t('maintenance:exporting') : t('maintenance:export_button')}
          </Button>
        </div>

        <div className="border-t border-slate-200 my-0 text-xs text-center text-slate-400 py-1">{t('maintenance:section_purge')}</div>

        {/* Purge */}
        {products.purgeResult && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 text-sm">
            <p className="font-bold text-emerald-600">✅ {t('purge_result_deleted', { count: products.purgeResult.deleted })}</p>
            {products.purgeResult.conserves > 0 && (
              <p className="text-xs text-slate-500">{t('purge_result_kept', { count: products.purgeResult.conserves })}</p>
            )}
          </div>
        )}
        <div className="space-y-1">
          <p className="text-xs text-slate-500">{t('purge_products_desc')}</p>
          <label className="flex items-center gap-2 text-xs cursor-pointer">
            <Checkbox
              checked={products.purgeSansVentes}
              onCheckedChange={(checked) => products.setPurgeSansVentes(!!checked)}
            />
            {t('keep_products_with_sales')}
          </label>
          <Button
            variant="destructive"
            size="sm"
            className="w-full gap-2 !whitespace-normal"
            onClick={products.openPurgeModal}
          >
            <Trash2 className="size-4" />
            {t('purge_products_btn')}
          </Button>
        </div>
      </div>
    </div>
  );
}
