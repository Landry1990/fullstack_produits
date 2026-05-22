import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Calculator, Info, Scale, Ruler, Activity, Baby, User } from 'lucide-react';

interface BMIResult {
  value: number;
  category: string;
  color: string;
  description: string;
}

const BMICalculator: React.FC = () => {
  const { t } = useTranslation(['clients', 'common']);
  const [activeTab, setActiveTab] = useState<'adult' | 'child'>('adult');
  
  // Adult BMI State
  const [weight, setWeight] = useState<number | ''>('');
  const [height, setHeight] = useState<number | ''>('');
  const [result, setResult] = useState<BMIResult | null>(null);

  // Child Weight State
  const [age, setAge] = useState<number | ''>('');
  const [ageUnit, setAgeUnit] = useState<'months' | 'years'>('years');
  const [childWeightResult, setChildWeightResult] = useState<number | null>(null);

  // Calculate Adult BMI
  const calculateBMI = () => {
    if (weight && height) {
      const heightInMeters = height / 100;
      const bmiValue = weight / (heightInMeters * heightInMeters);
      const roundedBMI = Math.round(bmiValue * 10) / 10;

      let category = '';
      let color = '';
      let description = '';

      if (roundedBMI < 18.5) {
        category = t('bmi.categories.underweight');
        color = 'text-blue-400 bg-blue-400/10 border-blue-400/20';
        description = t('bmi.descriptions.underweight');
      } else if (roundedBMI >= 18.5 && roundedBMI <= 24.9) {
        category = t('bmi.categories.normal');
        color = 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20';
        description = t('bmi.descriptions.normal');
      } else if (roundedBMI >= 25 && roundedBMI <= 29.9) {
        category = t('bmi.categories.overweight');
        color = 'text-yellow-400 bg-yellow-400/10 border-yellow-400/20';
        description = t('bmi.descriptions.overweight');
      } else if (roundedBMI >= 30 && roundedBMI <= 34.9) {
        category = t('bmi.categories.obesity_1');
        color = 'text-orange-400 bg-orange-400/10 border-orange-400/20';
        description = t('bmi.descriptions.obesity_1');
      } else if (roundedBMI >= 35 && roundedBMI <= 39.9) {
        category = t('bmi.categories.obesity_2');
        color = 'text-red-400 bg-red-400/10 border-red-400/20';
        description = t('bmi.descriptions.obesity_2');
      } else {
        category = t('bmi.categories.obesity_3');
        color = 'text-purple-400 bg-purple-400/10 border-purple-400/20';
        description = t('bmi.descriptions.obesity_3');
      }

      setResult({
        value: roundedBMI,
        category,
        color,
        description
      });
    } else {
      setResult(null);
    }
  };

  // Calculate Child Weight (APLS Formula)
  const calculateChildWeight = () => {
    if (age === '' || age === 0) {
      setChildWeightResult(null);
      return;
    }

    let estimatedWeight = 0;
    if (ageUnit === 'months') {
      // < 1 year: (0.5 * age in months) + 4
      estimatedWeight = (0.5 * age) + 4;
    } else {
      if (age < 1) {
        estimatedWeight = (0.5 * (age * 12)) + 4;
      } else if (age >= 1 && age <= 5) {
        // 1-5 years: (2 * age in years) + 8
        estimatedWeight = (2 * age) + 8;
      } else if (age > 5 && age <= 12) {
        // 6-12 years: (3 * age in years) + 7
        estimatedWeight = (3 * age) + 7;
      } else {
        // > 12 years: Age * 4 (very rough estimation or just cap it)
        estimatedWeight = (age * 3) + 7;
      }
    }
    setChildWeightResult(Math.round(estimatedWeight * 10) / 10);
  };

  useEffect(() => {
    if (activeTab === 'adult') calculateBMI();
    else calculateChildWeight();
  }, [weight, height, age, ageUnit, activeTab]);

  const bmiRanges = [
    { label: '< 18.5', text: t('bmi.categories.underweight'), color: 'bg-blue-400' },
    { label: '18.5 - 25', text: t('bmi.categories.normal'), color: 'bg-emerald-400' },
    { label: '25 - 30', text: t('bmi.categories.overweight'), color: 'bg-yellow-400' },
    { label: '30 - 35', text: t('bmi.categories.obesity_1'), color: 'bg-orange-400' },
    { label: '35 - 40', text: t('bmi.categories.obesity_2'), color: 'bg-red-400' },
    { label: '> 40', text: t('bmi.categories.obesity_3'), color: 'bg-purple-400' },
  ];

  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
        <div className="flex items-center gap-4">
          <div className="size-10 md:w-12 md:h-12 rounded-xl md:rounded-2xl bg-emerald-500/20 flex items-center justify-center text-emerald-500 shadow-lg shadow-emerald-500/10">
            <Calculator className="size-5 md:w-6 md:h-6" />
          </div>
          <div>
            <h2 className="text-xl md:text-2xl font-black text-base-content dark:text-white tracking-tight">{t('bmi.title')}</h2>
            <p className="text-base-content/60 dark:text-white/50 text-[10px] md:text-sm font-medium">{t('bmi.subtitle')}</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex bg-base-200 p-1 rounded-xl md:rounded-2xl border border-base-300">
          <button
            onClick={() => setActiveTab('adult')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg md:rounded-xl text-xs md:text-sm font-bold transition-all ${activeTab === 'adult' ? 'bg-base-100 dark:bg-slate-800 text-emerald-500 shadow-sm' : 'text-base-content/60 hover:text-base-content'}`}
          >
            <User className="size-4" />
            {t('bmi.tab_adult')}
          </button>
          <button
            onClick={() => setActiveTab('child')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg md:rounded-xl text-xs md:text-sm font-bold transition-all ${activeTab === 'child' ? 'bg-base-100 dark:bg-slate-800 text-emerald-500 shadow-sm' : 'text-base-content/60 hover:text-base-content'}`}
          >
            <Baby className="size-4" />
            {t('bmi.tab_child')}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8">
        {/* Input Section */}
        <div className="pharma-card p-6 md:p-8 space-y-6">
          {activeTab === 'adult' ? (
            <div className="space-y-4">
              <label className="block">
                <span className="text-[10px] md:text-xs font-black text-base-content/50 uppercase tracking-widest mb-2 block">{t('bmi.weight')}</span>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-base-content/30 group-focus-within:text-primary transition-colors">
                    <Scale className="size-4 md:w-5 md:h-5" />
                  </div>
                  <input
                    type="number"
                    inputMode="decimal"
                    value={weight}
                    onChange={(e) => setWeight(e.target.value === '' ? '' : parseFloat(e.target.value))}
                    placeholder={t('bmi.weight_placeholder')}
                    className="w-full bg-base-200 border border-base-300 rounded-xl md:rounded-2xl py-3 md:py-4 pl-10 md:pl-12 pr-4 text-base-content text-lg md:text-xl font-bold placeholder:text-base-content/10 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50 transition-all"
                  />
                </div>
              </label>

              <label className="block">
                <span className="text-[10px] md:text-xs font-black text-base-content/50 uppercase tracking-widest mb-2 block">{t('bmi.height')}</span>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-base-content/30 group-focus-within:text-primary transition-colors">
                    <Ruler className="size-4 md:w-5 md:h-5" />
                  </div>
                  <input
                    type="number"
                    inputMode="decimal"
                    value={height}
                    onChange={(e) => setHeight(e.target.value === '' ? '' : parseFloat(e.target.value))}
                    placeholder={t('bmi.height_placeholder')}
                    className="w-full bg-base-200 border border-base-300 rounded-xl md:rounded-2xl py-3 md:py-4 pl-10 md:pl-12 pr-4 text-base-content text-lg md:text-xl font-bold placeholder:text-base-content/10 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50 transition-all"
                  />
                </div>
              </label>
            </div>
          ) : (
            <div className="space-y-4">
              <label className="block">
                <span className="text-[10px] md:text-xs font-black text-base-content/50 uppercase tracking-widest mb-2 block">{t('bmi.age')}</span>
                <div className="flex gap-2">
                  <div className="relative group flex-1">
                  <input
                    type="number"
                    inputMode="decimal"
                    value={age}
                    onChange={(e) => setAge(e.target.value === '' ? '' : parseFloat(e.target.value))}
                    placeholder={t('bmi.age_placeholder', 'Ex: 4')}
                    className="w-full bg-base-200 border border-base-300 rounded-xl md:rounded-2xl py-3 md:py-4 px-4 text-base-content text-lg md:text-xl font-bold focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50 transition-all"
                  />
                  </div>
                  <select
                    value={ageUnit}
                    onChange={(e) => setAgeUnit(e.target.value as 'months' | 'years')}
                    className="bg-base-200 border border-base-300 rounded-xl md:rounded-2xl px-4 text-xs font-bold text-base-content focus:outline-none focus:ring-2 focus:ring-primary/50"
                  >
                    <option value="years">{t('bmi.age_unit_years')}</option>
                    <option value="months">{t('bmi.age_unit_months')}</option>
                  </select>
                </div>
              </label>
            </div>
          )}

          <div className="p-3 md:p-4 bg-base-200 border border-base-300 rounded-xl md:rounded-2xl flex gap-3">
            <Info className="size-4 md:w-5 md:h-5 text-primary shrink-0 mt-0.5" />
            <p className="text-[10px] md:text-xs text-base-content/60 leading-relaxed">
              {activeTab === 'adult' ? t('bmi.info_text') : t('bmi.child_info_text')}
            </p>
          </div>
        </div>

        {/* Result Section */}
        <div className="flex flex-col gap-6">
          {activeTab === 'adult' ? (
            result ? (
              <div className={`flex-1 rounded-2xl md:rounded-3xl border p-6 md:p-8 flex flex-col items-center justify-center text-center transition-all duration-500 shadow-lg ${result.color}`}>
                <div className="text-5xl md:text-[64px] font-black leading-none mb-2 tracking-tighter">{result.value}</div>
                <div className="text-[10px] font-black uppercase tracking-[0.2em] mb-4 text-base-content/70">{t('bmi.your_bmi')}</div>
                <div className="h-px w-10 md:w-12 bg-current text-base-content/20 mb-4 md:mb-6"></div>
                <div className="text-lg md:text-xl font-bold mb-2 md:mb-3">{result.category}</div>
                <p className="text-xs md:text-sm font-medium opacity-80 leading-relaxed max-w-[280px]">{result.description}</p>
                <div className="mt-6 md:mt-8 w-full">
                  <div className="h-1.5 md:h-2 w-full bg-base-100/10 rounded-full overflow-hidden flex">
                    {bmiRanges.map((range, idx) => (
                      <div 
                        key={idx} 
                        className={`h-full ${range.color} transition-all duration-700`}
                        style={{ 
                          width: '16.66%',
                          opacity: result.value >= (idx === 0 ? 0 : parseFloat(range.label.split('-')[0]) || 40) ? 1 : 0.2
                        }}
                      />
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex-1 bg-base-100 border border-dashed border-base-300 rounded-2xl md:rounded-3xl p-8 flex flex-col items-center justify-center text-center">
                <Activity className="size-10 md:w-12 md:h-12 text-base-content/10 mb-4" />
                <p className="text-xs md:text-sm text-base-content/30 font-medium px-4">{t('bmi.empty_state')}</p>
              </div>
            )
          ) : (
            childWeightResult ? (
              <div className="flex-1 rounded-2xl md:rounded-3xl border border-emerald-500/20 bg-emerald-500/5 p-6 md:p-8 flex flex-col items-center justify-center text-center transition-all duration-500 shadow-lg">
                <div className="text-5xl md:text-[64px] font-black leading-none mb-2 tracking-tighter text-emerald-500">
                  {childWeightResult} <span className="text-2xl md:text-3xl">{t('bmi.unit_kg', 'kg')}</span>
                </div>
                <div className="text-[10px] font-black uppercase tracking-[0.2em] mb-4 text-emerald-500/60">{t('bmi.estimated_weight')}</div>
                <div className="h-px w-10 md:w-12 bg-emerald-500/20 mb-4 md:mb-6"></div>
                <div className="p-4 bg-emerald-500/10 rounded-2xl border border-emerald-500/10">
                  <p className="text-xs md:text-sm font-bold text-success">
                    {age} {ageUnit === 'years' ? t('bmi.age_unit_years') : t('bmi.age_unit_months')}
                  </p>
                </div>
              </div>
            ) : (
              <div className="flex-1 bg-base-100 border border-dashed border-base-300 rounded-2xl md:rounded-3xl p-8 flex flex-col items-center justify-center text-center">
                <Baby className="size-10 md:w-12 md:h-12 text-base-content/10 mb-4" />
                <p className="text-xs md:text-sm text-base-content/30 font-medium px-4">{t('bmi.empty_state')}</p>
              </div>
            )
          )}

          {/* Reference Table (Only for Adult BMI) */}
          {activeTab === 'adult' && (
            <div className="pharma-card p-5 md:p-6">
              <h3 className="text-[9px] md:text-[10px] font-black text-base-content/40 uppercase tracking-[0.2em] mb-3 md:mb-4">{t('bmi.oms_classification')}</h3>
              <div className="grid grid-cols-1 gap-1 md:gap-2">
                {bmiRanges.map((range, idx) => (
                  <div key={idx} className="flex items-center justify-between p-2 md:p-2.5 rounded-lg md:rounded-xl hover:bg-base-200 transition-colors">
                    <div className="flex items-center gap-2 md:gap-3">
                      <div className={`size-1.5 md:w-2 md:h-2 rounded-full ${range.color}`}></div>
                      <span className="text-[10px] md:text-xs font-semibold text-base-content/70">{range.text}</span>
                    </div>
                    <span className="text-[9px] md:text-[10px] font-black text-base-content/40 tabular-nums">{range.label}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default BMICalculator;
