path = r'c:\Projet Fullstack\fullstack_produits\frontend\frontend\src\components\dashboard\reports\ReportFilters.tsx'
with open(path, 'r', encoding='utf-8') as f:
    lines = f.readlines()

marker = "t('common:active', { defaultValue: 'Activé' })"
fixed = False
for i, line in enumerate(lines):
    if marker in line and '}},{' in line:
        prefix = line[:line.index(marker) + len(marker)]
        lines[i] = prefix + " }\n"
        fixed = True
        break

with open(path, 'w', encoding='utf-8') as f:
    f.writelines(lines)

with open(r'c:\Projet Fullstack\fullstack_produits\log_smart.txt', 'w', encoding='utf-8') as log:
    log.write('FIXED=' + str(fixed) + '\n')
