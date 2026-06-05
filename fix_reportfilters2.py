with open(r'c:\Projet Fullstack\fullstack_produits\frontend\frontend\src\components\dashboard\reports\ReportFilters.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

old = "                                    {t(`params.${param.key}_active`, { defaultValue: t('common:active', { defaultValue: 'Activé' }) })}}},{\n"
new = "                                    {t(`params.${param.key}_active`, { defaultValue: t('common:active', { defaultValue: 'Activé' }) })}\n"

with open(r'c:\Projet Fullstack\fullstack_produits\log_fix.txt', 'w', encoding='utf-8') as log:
    log.write('START\n')
    log.write('OLD_LEN=' + str(len(old)) + '\n')
    log.write('OLD_IN_CONTENT=' + str(old in content) + '\n')
    if old in content:
        content = content.replace(old, new)
        with open(r'c:\Projet Fullstack\fullstack_produits\frontend\frontend\src\components\dashboard\reports\ReportFilters.tsx', 'w', encoding='utf-8') as f:
            f.write(content)
        log.write('Fixed\n')
    else:
        log.write('Not found\n')
    log.write('DONE\n')
