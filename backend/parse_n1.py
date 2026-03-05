import json

try:
    with open('n1_report.json', 'r', encoding='utf-8') as f:
        data = json.load(f)

    for item in data:
        true_n1 = []
        for q in item['queries']:
            code = q['code']
            # Highly likely DB calls
            is_db_call = False
            if '.objects.' in code or '_set' in code or '.all(' in code or '.filter(' in code or '.annotate(' in code or '.aggregate(' in code:
                # ignore obvious dict gets
                if not ('.get(' in code and '.objects.' not in code):
                    is_db_call = True
                    
            if is_db_call:
                true_n1.append(q)
                
        if true_n1:
            print(f'\n--- {item["file"]} ---')
            for q in true_n1:
                print(f"  Line {q['line']}: {q['code']}")
except Exception as e:
    print("Error:", e)
