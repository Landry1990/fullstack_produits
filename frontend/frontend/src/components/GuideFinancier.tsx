import React from 'react';
import { useTranslation } from 'react-i18next';
import { 
  BookOpen, 
  TrendingUp, 
  Users, 
  Package, 
  ShieldCheck, 
  AlertTriangle, 
  Lightbulb,
  ArrowRight,
  Info
} from 'lucide-react';

const GuideFinancier: React.FC = () => {
  const { t } = useTranslation(['finance', 'common']);

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      {/* Hero Header */}
      <div className="bg-gradient-to-r from-primary to-secondary rounded-3xl p-8 text-white shadow-xl relative overflow-hidden">
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-4">
            <div className="bg-white/20 p-2 rounded-xl backdrop-blur-md">
              <BookOpen className="w-6 h-6" />
            </div>
            <span className="text-sm font-bold uppercase tracking-widest opacity-80">Documentation</span>
          </div>
          <h1 className="text-4xl font-black mb-2">{t('guide.title')}</h1>
          <p className="text-lg opacity-90 max-w-2xl">
            {t('guide.subtitle')}
          </p>
        </div>
        <div className="absolute right-[-10%] top-[-20%] opacity-10">
          <TrendingUp className="w-64 h-64" />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Navigation Rapide */}
        <div className="md:col-span-1 space-y-4">
          <div className="card bg-base-100 shadow-sm border border-base-200 sticky top-24">
            <div className="card-body p-4">
              <h3 className="font-bold text-xs uppercase tracking-widest text-base-content/40 mb-4">{t('guide.summary')}</h3>
              <nav className="space-y-1">
                <a href="#vendeurs" className="flex items-center justify-between p-3 rounded-xl hover:bg-base-200 transition-colors group">
                  <div className="flex items-center gap-3">
                    <Users className="w-4 h-4 text-primary" />
                    <span className="text-sm font-bold">{t('guide.sections.seller_ranking.title')}</span>
                  </div>
                  <ArrowRight className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-all -translate-x-2 group-hover:translate-x-0" />
                </a>
                <a href="#fournisseurs" className="flex items-center justify-between p-3 rounded-xl hover:bg-base-200 transition-colors group">
                  <div className="flex items-center gap-3">
                    <Package className="w-4 h-4 text-secondary" />
                    <span className="text-sm font-bold">{t('guide.sections.supplier_purchases.title')}</span>
                  </div>
                  <ArrowRight className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-all -translate-x-2 group-hover:translate-x-0" />
                </a>
                <a href="#scoring" className="flex items-center justify-between p-3 rounded-xl hover:bg-base-200 transition-colors group">
                  <div className="flex items-center gap-3">
                    <ShieldCheck className="w-4 h-4 text-success" />
                    <span className="text-sm font-bold">{t('guide.sections.scoring_performance.title')}</span>
                  </div>
                  <ArrowRight className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-all -translate-x-2 group-hover:translate-x-0" />
                </a>
                <a href="#opportunites" className="flex items-center justify-between p-3 rounded-xl hover:bg-base-200 transition-colors group">
                  <div className="flex items-center gap-3">
                    <Lightbulb className="w-4 h-4 text-warning" />
                    <span className="text-sm font-bold">{t('guide.sections.advanced_analysis.title')}</span>
                  </div>
                  <ArrowRight className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-all -translate-x-2 group-hover:translate-x-0" />
                </a>
              </nav>
            </div>
          </div>
        </div>

        {/* Content Area */}
        <div className="md:col-span-2 space-y-12">
          
          {/* Section 1: Classement Vendeurs */}
          <section id="vendeurs" className="scroll-mt-24">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center">
                <Users className="w-5 h-5 text-primary" />
              </div>
              <h2 className="text-2xl font-black">{t('guide.sections.seller_ranking.title')}</h2>
            </div>
            <div className="prose prose-sm max-w-none text-base-content/80 leading-relaxed">
              <p>
                {t('guide.sections.seller_ranking.desc')}
              </p>
              <div className="bg-base-200/50 rounded-2xl p-6 my-6 border border-base-300">
                <h4 className="flex items-center gap-2 text-primary font-bold mb-3 uppercase tracking-tighter text-xs">
                  <Info className="w-4 h-4" /> {t('guide.sections.seller_ranking.methodology')}
                </h4>
                <ul className="list-disc list-inside space-y-2 text-sm">
                  <li>{t('guide.sections.seller_ranking.methodology_desc')}</li>
                  <li className="font-bold mt-2">{t('guide.sections.seller_ranking.calculation')}</li>
                  <li className="ml-4">{t('guide.sections.seller_ranking.basket_desc')}</li>
                  <li className="ml-4">{t('guide.sections.seller_ranking.evolution_desc')}</li>
                </ul>
              </div>
            </div>
          </section>

          {/* Section 2: Achats Fournisseurs */}
          <section id="fournisseurs" className="scroll-mt-24">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-2xl bg-secondary/10 flex items-center justify-center">
                <Package className="w-5 h-5 text-secondary" />
              </div>
              <h2 className="text-2xl font-black">{t('guide.sections.supplier_purchases.title')}</h2>
            </div>
            <div className="prose prose-sm max-w-none text-base-content/80">
              <p>
                {t('guide.sections.supplier_purchases.desc')}
              </p>
              <div className="bg-base-200/50 rounded-2xl p-6 my-6 border border-base-300">
                <h4 className="flex items-center gap-2 text-secondary font-bold mb-3 uppercase tracking-tighter text-xs">
                  <Info className="w-4 h-4" /> {t('guide.sections.supplier_purchases.methodology')}
                </h4>
                <p className="text-sm mb-4">
                  {t('guide.sections.supplier_purchases.methodology_desc')}
                </p>
                <h4 className="text-xs font-bold uppercase tracking-widest opacity-50 mb-2">{t('guide.sections.supplier_purchases.calculation')}</h4>
                <div className="mb-4 font-mono p-4 bg-base-300/30 rounded-xl text-center font-bold text-sm">
                  {t('guide.sections.supplier_purchases.formula')}
                </div>
              </div>
            </div>
          </section>

          {/* Section 3: Scoring Performance */}
          <section id="scoring" className="scroll-mt-24">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-2xl bg-success/10 flex items-center justify-center">
                <ShieldCheck className="w-5 h-5 text-success" />
              </div>
              <h2 className="text-2xl font-black">{t('guide.sections.scoring_performance.title')}</h2>
            </div>
            <div className="space-y-6">
              <p className="text-sm text-base-content/80">
                {t('guide.sections.scoring_performance.desc')}
              </p>
              <h4 className="text-xs font-bold uppercase tracking-widest opacity-50">{t('guide.sections.scoring_performance.criteria')}</h4>
              <div className="grid grid-cols-1 gap-4">
                <div className="flex gap-4 p-4 rounded-2xl bg-base-100 border border-base-200">
                  <div className="font-black text-2xl text-base-content/10">30%</div>
                  <div>
                    <h4 className="font-bold">{t('guide.sections.scoring_performance.volume')}</h4>
                    <p className="text-xs opacity-70">{t('guide.sections.scoring_performance.volume_desc')}</p>
                  </div>
                </div>
                <div className="flex gap-4 p-4 rounded-2xl bg-base-100 border border-base-200">
                  <div className="font-black text-2xl text-base-content/10">30%</div>
                  <div>
                    <h4 className="font-bold">{t('guide.sections.scoring_performance.quality')}</h4>
                    <p className="text-xs opacity-70">{t('guide.sections.scoring_performance.quality_desc')}</p>
                  </div>
                </div>
                <div className="flex gap-4 p-4 rounded-2xl bg-base-100 border border-base-200">
                  <div className="font-black text-2xl text-base-content/10">40%</div>
                  <div>
                    <h4 className="font-bold">{t('guide.sections.scoring_performance.regularity')}</h4>
                    <p className="text-xs opacity-70">{t('guide.sections.scoring_performance.regularity_desc')}</p>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Section 4: Analyse Avancée */}
          <section id="opportunites" className="scroll-mt-24 pb-12">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-2xl bg-warning/10 flex items-center justify-center">
                <Lightbulb className="w-5 h-5 text-warning" />
              </div>
              <h2 className="text-2xl font-black">{t('guide.sections.advanced_analysis.title')}</h2>
            </div>
            <div className="prose prose-sm max-w-none text-base-content/80">
              <p>{t('guide.sections.advanced_analysis.desc')}</p>
              
              <div className="grid grid-cols-1 gap-4 mt-6">
                <div className="alert alert-warning border shadow-sm">
                  <AlertTriangle className="w-5 h-5" />
                  <div>
                    <h4 className="font-bold">{t('guide.sections.advanced_analysis.low_margin')}</h4>
                    <p className="text-xs">{t('guide.sections.advanced_analysis.low_margin_desc')}</p>
                  </div>
                </div>

                <div className="alert border shadow-sm bg-base-100">
                  <Lightbulb className="w-5 h-5 text-success" />
                  <div>
                    <h4 className="font-bold">{t('guide.sections.advanced_analysis.price_optimization')}</h4>
                    <p className="text-xs">{t('guide.sections.advanced_analysis.price_optimization_desc')}</p>
                  </div>
                </div>
              </div>

              {/* Note sur les tableaux vides */}
              <div className="bg-blue-50 border border-blue-100 rounded-2xl p-6 mt-8">
                <h4 className="flex items-center gap-2 text-blue-700 font-bold mb-3 uppercase tracking-tighter text-xs">
                  <Info className="w-4 h-4" /> {t('guide.sections.advanced_analysis.empty_table_title')}
                </h4>
                <p className="text-sm text-blue-800/80 mb-4">
                  {t('guide.sections.advanced_analysis.empty_table_desc')}
                </p>
                <ul className="space-y-3 text-sm text-blue-900/70">
                  <li className="flex gap-2">
                    <span className="font-bold text-blue-600">01.</span>
                    <span>{t('guide.sections.advanced_analysis.reason_1')}</span>
                  </li>
                  <li className="flex gap-2">
                    <span className="font-bold text-blue-600">02.</span>
                    <span>{t('guide.sections.advanced_analysis.reason_2')}</span>
                  </li>
                  <li className="flex gap-2">
                    <span className="font-bold text-blue-600">03.</span>
                    <span>{t('guide.sections.advanced_analysis.reason_3')}</span>
                  </li>
                </ul>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};

export default GuideFinancier;
