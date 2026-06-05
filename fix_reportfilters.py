import codecs

path = r'c:\Projet Fullstack\fullstack_produits\frontend\frontend\src\components\dashboard\reports\ReportFilters.tsx'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

old = "                                    {t(`params.${param.key}_active`, { defaultValue: t('common:active', { defaultValue: 'Activé' }) })}}},{\n"
new = "                                    {t(`params.${param.key}_active`, { defaultValue: t('common:active', { defaultValue: 'Activé' }) })}\n"

if old in content:
    content = content.replace(old, new)
    with open(path, 'w', encoding='utf-8') as f:
        f.write(content)
    print('Fixed')
else:
    print('Not found')
