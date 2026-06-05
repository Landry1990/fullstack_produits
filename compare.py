with open(r'c:\Projet Fullstack\fullstack_produits\frontend\frontend\src\components\dashboard\reports\ReportFilters.tsx', 'r', encoding='utf-8') as f:
    lines = f.readlines()
file_line = lines[441]
my_old = "                                    {t(`params.${param.key}_active`, { defaultValue: t('common:active', { defaultValue: 'Activé' }) })}}},{" + chr(10)

with open(r'c:\Projet Fullstack\fullstack_produits\log_compare.txt', 'w', encoding='utf-8') as out:
    out.write('FILE_LEN=' + str(len(file_line)) + '\n')
    out.write('MY_LEN=' + str(len(my_old)) + '\n')
    min_len = min(len(file_line), len(my_old))
    for i in range(min_len):
        if file_line[i] != my_old[i]:
            out.write(f'DIFF at {i}: file={repr(file_line[i])} old={repr(my_old[i])}\n')
            break
    else:
        if len(file_line) != len(my_old):
            out.write(f'LEN_DIFF: file={len(file_line)} old={len(my_old)}\n')
        else:
            out.write('IDENTICAL\n')
