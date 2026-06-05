old = "                                    {t(`params.${param.key}_active`, { defaultValue: t('common:active', { defaultValue: 'Activé' }) })}}},{
"
with open(r'c:\Projet Fullstack\fullstack_produits\log_old.txt', 'w', encoding='utf-8') as f:
    f.write('OLD=' + repr(old) + '\n')
    f.write('LEN=' + str(len(old)) + '\n')
