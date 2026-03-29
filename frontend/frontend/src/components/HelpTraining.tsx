import React from 'react';
import { useTranslation } from 'react-i18next';
import { 
  BookOpen, 
  FileText, 
  Upload, 
  CheckCircle2, 
  AlertCircle, 
  Database,
  ArrowRight
} from 'lucide-react';

const HelpCard = ({ title, children, icon: Icon, colorClass = "text-primary" }: { title: string, children: React.ReactNode, icon: any, colorClass?: string }) => (
  <div className="card bg-base-100 shadow-sm border border-base-300 rounded-2xl overflow-hidden hover:shadow-md transition-all h-full">
    <div className="card-body p-6">
      <div className="flex items-center gap-3 mb-4">
        <div className={`p-2 bg-base-100 rounded-xl border border-base-200 shadow-sm ${colorClass}`}>
          <Icon className="w-5 h-5" />
        </div>
        <h3 className="text-sm font-black uppercase tracking-widest text-base-content/70">{title}</h3>
      </div>
      <div className="space-y-3 text-base-content/80 text-sm leading-relaxed">
        {children}
      </div>
    </div>
  </div>
);

const HelpTraining = () => {
  const { t } = useTranslation(['help', 'common']);

  return (
    <div className="min-h-screen bg-base-200/50 md:p-6 p-3 space-y-6 font-sans">
      {/* Header */}
      <div className="w-full max-w-6xl mx-auto px-1">
        <div className="flex items-center gap-3 mb-3">
          <div className="bg-primary/20 text-primary p-2.5 rounded-2xl shadow-sm">
            <BookOpen className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl md:text-3xl font-black text-base-content tracking-tight">
              {t('title')}
            </h1>
            <p className="text-base-content/50 text-xs md:text-sm font-medium mt-0.5">
              {t('subtitle')}
            </p>
          </div>
        </div>

        <div className="h-px bg-gradient-to-r from-base-300 via-base-200 to-transparent w-full mt-6 mb-8"></div>

        {/* Section: Product Import */}
        <section className="space-y-6">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-1.5 h-6 bg-primary rounded-full"></div>
            <h2 className="text-xl font-bold text-base-content">{t('import.title')}</h2>
          </div>
          
          <p className="max-w-3xl text-base-content/60 font-medium">
            {t('import.description')}
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Formats Card */}
            <HelpCard title={t('import.format.title')} icon={FileText} colorClass="text-blue-500">
              <ul className="space-y-2">
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                  <span>{t('import.format.csv')}</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                  <span>{t('import.format.excel')}</span>
                </li>
              </ul>
              <div className="mt-4 p-3 bg-blue-50 rounded-xl border border-blue-100 text-blue-700 text-xs font-medium">
                <div className="flex items-center gap-2 mb-1">
                  <AlertCircle className="w-3.5 h-3.5" />
                  <span className="font-bold">Délimiteur CSV</span>
                </div>
                {t('import.logic.delimiter')}
              </div>
            </HelpCard>

            {/* Required Columns Card */}
            <HelpCard title={t('import.columns.required')} icon={Database} colorClass="text-orange-500">
              <p className="font-bold text-xs mb-2 text-base-content/50">{t('import.columns.required_details')}</p>
              <div className="flex flex-wrap gap-2">
                {['nom', 'prix_public', 'prix_cession'].map(field => (
                  <span key={field} className="px-2.5 py-1 bg-base-200 rounded-lg text-[11px] font-black border border-base-300">
                    {t(`import.columns.${field}`)}
                  </span>
                ))}
              </div>
              <div className="mt-4 p-3 bg-emerald-50 rounded-xl border border-emerald-100 text-emerald-700 text-xs font-medium">
                <div className="flex items-center gap-2 mb-1">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span className="font-bold">Mise à jour Intelligente</span>
                </div>
                {t('import.logic.update')}
              </div>
            </HelpCard>

            {/* Optional Columns Card */}
            <HelpCard title={t('import.columns.optional')} icon={Upload} colorClass="text-emerald-500">
              <div className="grid grid-cols-1 gap-2">
                {['stock', 'cip', 'tva', 'expire_date'].map(field => (
                  <div key={field} className="flex items-center gap-2 text-xs">
                    <ArrowRight className="w-3 h-3 text-base-content/30" />
                    <span className="font-bold">{t(`import.columns.${field}`)}</span>
                  </div>
                ))}
              </div>
              <div className="mt-4 p-3 bg-amber-50 rounded-xl border border-amber-100 text-amber-700 text-xs font-medium">
                <div className="flex items-center gap-2 mb-1">
                  <AlertCircle className="w-3.5 h-3.5" />
                  <span className="font-bold">Gestion des Taxes</span>
                </div>
                {t('import.logic.tva')}
              </div>
            </HelpCard>
          </div>
        </section>

        <div className="h-px bg-gradient-to-r from-base-300 via-base-200 to-transparent w-full my-12"></div>

        {/* Section: Guide Visuel & Vidéo */}
        <section className="space-y-8">
          <div className="flex items-center justify-between gap-2 mb-2">
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-6 bg-emerald-500 rounded-full"></div>
              <h2 className="text-xl font-bold text-base-content">{t('billing.guide.title')}</h2>
            </div>
            <div className="badge badge-outline badge-sm text-[10px] font-bold opacity-50 uppercase tracking-widest">Tutoriel Vidéo</div>
          </div>

          {/* Video Player Placeholder */}
          <div className="w-full max-w-4xl mx-auto">
            <div className="relative aspect-video rounded-3xl overflow-hidden bg-slate-900 border-4 border-base-100 shadow-2xl group">
              <video 
                className="w-full h-full object-cover"
                controls
                poster="/assets/help/step1.png"
              >
                <source src="/assets/help/how-to-sell.mp4" type="video/mp4" />
                Votre navigateur ne supporte pas la lecture de vidéos.
              </video>
              <div className="absolute inset-0 flex items-center justify-center bg-black/40 group-hover:bg-black/20 transition-all pointer-events-none">
                <div className="p-5 bg-white/10 backdrop-blur-md rounded-full border border-white/20 group-hover:scale-110 transition-transform">
                  <ArrowRight className="w-8 h-8 text-white rotate-[-45deg]" />
                </div>
              </div>
            </div>
            <p className="mt-4 text-center text-xs text-base-content/40 italic font-medium">
              Astuce : Pour remplacer cette vidéo, déposez votre fichier record dans <code className="bg-base-300 px-1 rounded">public/assets/help/how-to-sell.mp4</code>
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 pt-8">
            {[1, 2, 3].map((step) => (
              <div key={step} className="flex flex-col space-y-4">
                <div className="relative group">
                  <div className="absolute -top-3 -left-3 w-8 h-8 bg-emerald-500 text-white rounded-full flex items-center justify-center font-bold z-10 shadow-lg">
                    {step}
                  </div>
                  <div className="aspect-video rounded-2xl overflow-hidden border border-base-300 shadow-sm group-hover:shadow-md transition-shadow">
                    <img 
                      src={`/assets/help/step${step}.png`} 
                      alt={`Étape ${step}`} 
                      className="w-full h-full object-cover"
                    />
                  </div>
                </div>
                <div>
                  <h3 className="font-bold text-base-content mb-1">
                    {t(`billing.guide.step${step}.title`)}
                  </h3>
                  <p className="text-xs text-base-content/60 leading-relaxed font-medium">
                    {t(`billing.guide.step${step}.description`)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>

        <div className="h-px bg-gradient-to-r from-base-300 via-base-200 to-transparent w-full my-12"></div>

        {/* Section: Billing / Facturation */}
        <section className="space-y-6">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-1.5 h-6 bg-secondary rounded-full"></div>
            <h2 className="text-xl font-bold text-base-content">{t('billing.title')}</h2>
          </div>
          
          <p className="max-w-3xl text-base-content/60 font-medium">
            {t('billing.description')}
          </p>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Zero Mouse Shortcuts */}
            <div className="card bg-base-100 shadow-sm border border-base-300 rounded-2xl overflow-hidden">
              <div className="card-body p-0">
                <div className="p-4 bg-base-200/50 border-b border-base-300 flex items-center gap-2">
                  <div className="p-1.5 bg-secondary/10 text-secondary rounded-lg">
                    <ArrowRight className="w-4 h-4" />
                  </div>
                  <h3 className="text-xs font-black uppercase tracking-widest text-base-content/70">{t('billing.shortcuts.title')}</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="table table-sm w-full">
                    <thead>
                      <tr className="bg-base-100 text-[10px] uppercase font-bold text-base-content/40 border-b border-base-200">
                        <th className="py-3 px-4">Action</th>
                        <th className="py-3 px-4 text-right">Raccourci</th>
                      </tr>
                    </thead>
                    <tbody className="text-xs">
                      {[
                        { label: t('billing.shortcuts.f2'), key: 'F2' },
                        { label: t('billing.shortcuts.slash'), key: '/' },
                        { label: t('billing.shortcuts.f4'), key: 'F4' },
                        { label: t('billing.shortcuts.f9'), key: 'F9', highlight: true },
                        { label: t('billing.shortcuts.ctrl_s'), key: 'Ctrl + S' },
                        { label: t('billing.shortcuts.alt_z'), key: 'Alt + Z' },
                        { label: t('billing.shortcuts.esc'), key: 'Esc' },
                      ].map((item, i) => (
                        <tr key={i} className="hover:bg-base-200/30 border-b border-base-200/50 transition-colors">
                          <td className="py-2.5 px-4 font-medium text-base-content/70">{item.label}</td>
                          <td className="py-2.5 px-4 text-right">
                            <kbd className={`kbd kbd-xs font-sans ${item.highlight ? 'bg-secondary text-white border-secondary' : 'bg-base-200 border-base-300'}`}>
                              {item.key}
                            </kbd>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Productivity Tips */}
            <div className="space-y-4">
               {['qty_shortcut', 'navigation', 'search'].map((tipKey) => (
                 <div key={tipKey} className="group p-4 bg-base-100 rounded-2xl border border-base-300 hover:border-secondary/30 hover:shadow-md transition-all">
                    <div className="flex items-start gap-3">
                      <div className="p-2 bg-secondary/5 text-secondary rounded-xl group-hover:bg-secondary group-hover:text-white transition-colors">
                        {tipKey === 'qty_shortcut' ? <Upload className="w-4 h-4" /> : 
                         tipKey === 'navigation' ? <ArrowRight className="w-4 h-4" /> : 
                         <CheckCircle2 className="w-4 h-4" />}
                      </div>
                      <div>
                        <h4 className="font-bold text-sm text-base-content mb-1">{t(`billing.tips.${tipKey}.title`)}</h4>
                        <p className="text-xs text-base-content/60 leading-relaxed font-medium">
                          {t(`billing.tips.${tipKey}.description`)}
                        </p>
                      </div>
                    </div>
                 </div>
               ))}
            </div>
          </div>
        </section>

        {/* Placeholder for future sections */}
        <div className="mt-12 p-8 border-2 border-dashed border-base-300 rounded-3xl flex flex-col items-center justify-center text-center space-y-3 opacity-60">
          <BookOpen className="w-12 h-12 text-base-content/20" />
          <div>
            <h3 className="text-lg font-bold text-base-content/40">D'autres guides arrivent bientôt</h3>
            <p className="text-sm text-base-content/30 italic">Gestion des stocks, facturation avancée, etc.</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default HelpTraining;
