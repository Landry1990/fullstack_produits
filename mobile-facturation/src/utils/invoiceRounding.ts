export const tiersPayantSplit = (totalTtc: number, tauxCouverture: number) => {
  const base = (totalTtc < 0 ? -1 : 1) * Math.round(Math.abs(totalTtc));
  const coverage = Math.max(0, Math.min(100, tauxCouverture));
  const weighted = base * (10000 - Math.round(coverage * 100));
  const cents = Math.floor(Math.abs(weighted) / 100);
  const remainder = Math.abs(weighted) % 100;
  const patientCents = Math.sign(weighted) * (cents + (remainder > 50 || (remainder === 50 && cents % 2 !== 0) ? 1 : 0));
  const originalPatient = patientCents / 100;
  const partPatient = originalPatient > 0 ? Math.round(originalPatient / 5) * 5 : originalPatient;
  const ecartArrondi = Math.round((partPatient - originalPatient) * 100) / 100;
  return {
    partPatient,
    partAssurance: (base * 100 - patientCents) / 100,
    totalTtc: Math.round((base + ecartArrondi) * 100) / 100,
    ecartArrondi,
  };
};
