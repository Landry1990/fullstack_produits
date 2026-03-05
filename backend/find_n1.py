import ast
import os
import json

def check_file_for_n_plus_1(filepath):
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()
            tree = ast.parse(content, filename=filepath)
    except Exception as e:
        return None
    
    lines = content.split('\n')
    
    class LoopVisitor(ast.NodeVisitor):
        def __init__(self):
            self.loop_stack = []
            self.issues = []

        def visit_For(self, node):
            self.loop_stack.append(node)
            self.generic_visit(node)
            self.loop_stack.pop()
            
        def visit_While(self, node):
            self.loop_stack.append(node)
            self.generic_visit(node)
            self.loop_stack.pop()

        def visit_Call(self, node):
            if self.loop_stack:
                if isinstance(node.func, ast.Attribute):
                    attr_name = node.func.attr
                    db_methods = {'filter', 'get', 'aggregate', 'annotate', 'all', 'exclude', 'first', 'last', 'save', 'count', 'exists'}
                    if attr_name in db_methods:
                        self.issues.append((node.lineno, attr_name))
            self.generic_visit(node)

    visitor = LoopVisitor()
    visitor.visit(tree)
    
    if visitor.issues:
        results = []
        for lineno, method in sorted(set(visitor.issues)):
            try:
                code_line = lines[lineno - 1].strip()
                if '.objects' in code_line or '_set' in code_line or f'.{method}(' in code_line:
                    results.append({"line": lineno, "method": method, "code": code_line})
            except:
                pass
                
        if results:
            return {"file": os.path.relpath(filepath, start=r'C:\Projet Fullstack\fullstack_produits\backend'), "queries": results}
    return None

backend_dir = r'C:\Projet Fullstack\fullstack_produits\backend'
directories_to_scan = ['api/views', 'api/models']
all_results = []

for d in directories_to_scan:
    scan_path = os.path.join(backend_dir, d)
    for root, _, files in os.walk(scan_path):
        for f in files:
            if f.endswith('.py') and not root.endswith('migrations') and 'test' not in f.lower():
                res = check_file_for_n_plus_1(os.path.join(root, f))
                if res:
                    all_results.append(res)

with open('n1_report.json', 'w', encoding='utf-8') as f:
    json.dump(all_results, f, indent=2)
