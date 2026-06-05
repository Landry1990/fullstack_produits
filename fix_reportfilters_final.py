with open(r'c:\Projet Fullstack\fullstack_produits\frontend\frontend\src\components\dashboard\reports\ReportFilters.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

old = "                                    {t(`params.${param.key}_active`, { defaultValue: t('common:active', { defaultValue: 'Activé' }) })}}},{" + chr(10)
new = "                                    {t(`params.${param.key}_active`, { defaultValue: t('common:active', { defaultValue: 'Activé' }) })}" + chr(10)

with open(r'c:\Projet Fullstack\fullstack_produits\log_final.txt', 'w', encoding='utf-8') as log:
    log.write('START' + chr(10))
    log.write('OLD_LEN=' + str(len(old)) + chr(10))
    log.write('OLD_IN_CONTENT=' + str(old in content) + chr(10))
    if old in content:
        content = content.replace(old, new)
        with open(r'c:\Projet Fullstack\fullstack_produits\frontend\frontend\src\components\dashboard\reports\ReportFilters.tsx', 'w', encoding='utf-8') as f:
            f.write(content)
        log.write('Fixed' + chr(10))
    else:
        log.write('Not found' + chr(10))
    log.write('DONE' + chr(10))
