"""Bounded decimal contract inspector/evaluator. Never import learner modules/tests."""
import ast
import hashlib
import json
import math
import pathlib
import sys

VALID = [(0,0), (-7,-7), ('23',23), (' +4 ',4), ('-5',-5), ('0',0)]
INVALID = [True,False,2.5,'','  ','1.2','abc',None]
SAFE_CALLABLES = {'int','str','bool','float','isinstance','type','ValueError','TypeError'}

def read_file(relative):
    root = pathlib.Path.cwd().resolve()
    path = (root / relative).resolve()
    if not path.is_relative_to(root) or path.suffix != '.py' or path.stat().st_size > 32000:
        raise ValueError('Unsupported source/test path or size.')
    raw = path.read_bytes()
    return raw, ast.parse(raw.decode('utf-8'))

def selected(tree, name):
    found = [n for n in tree.body if isinstance(n, ast.FunctionDef) and n.name == name]
    if len(found) != 1:
        raise ValueError('Selected function missing or ambiguous.')
    fn = found[0]
    args = fn.args
    if fn.name in SAFE_CALLABLES or any(arg.arg in SAFE_CALLABLES for arg in ast.walk(args) if isinstance(arg, ast.arg)):
        raise ValueError('Selected function/argument shadows an evaluator builtin.')
    if fn.decorator_list or fn.returns or len(args.args) != 1 or args.args[0].annotation or args.defaults or args.kw_defaults or args.kwonlyargs or args.posonlyargs or args.vararg or args.kwarg:
        raise ValueError('Use one unannotated standalone argument, no decorators/defaults.')
    if len(list(ast.walk(fn))) > 128 or len(ast.unparse(fn)) > 8000:
        raise ValueError('Selected function exceeds node/text budget.')
    return fn

def canonical_baseline(fn):
    if len(fn.body) != 1 or not isinstance(fn.body[0], ast.Return):
        raise ValueError('Baseline must return int(argument) or int(argument.strip()).')
    value = fn.body[0].value
    if not isinstance(value, ast.Call) or not isinstance(value.func, ast.Name) or value.func.id != 'int' or len(value.args) != 1 or value.keywords:
        raise ValueError('Unsupported baseline conversion.')
    arg = value.args[0]
    name = fn.args.args[0].arg
    if isinstance(arg, ast.Name) and arg.id == name:
        suffix = name
    elif isinstance(arg, ast.Call) and isinstance(arg.func, ast.Attribute) and isinstance(arg.func.value, ast.Name) and arg.func.value.id == name and arg.func.attr == 'strip' and not arg.args and not arg.keywords:
        suffix = name + '.strip()'
    else:
        raise ValueError('Baseline depends on unsupported code.')
    return 'def ' + fn.name + '(' + name + '):\n    return int(' + suffix + ')'

def contract(value):
    if type(value) is int:
        return int(value)
    if type(value) is str and value.strip() and value.strip().lstrip('+-').isascii() and value.strip().lstrip('+-').isdigit():
        return int(value)
    raise ValueError('invalid decimal')

def literal(node):
    if len(list(ast.walk(node))) > 5:
        raise ValueError('Only bounded scalar literals are supported in project tests.')
    value = ast.literal_eval(node)
    if type(value) not in (int, float, str, bool, type(None)) or isinstance(value, str) and len(value) > 64 or type(value) in (int,float) and (not math.isfinite(value) or abs(value) > 1000000):
        raise ValueError('Project test literal is out of bounds.')
    return value

def project_cases(tree, source_path, fn_name):
    module = str(pathlib.PurePosixPath(source_path).with_suffix('')).replace('/', '.')
    aliases = set()
    pytest_aliases = set()
    for node in tree.body:
        if isinstance(node, ast.ImportFrom) and node.module == module and node.level == 0:
            aliases.update(alias.asname or alias.name for alias in node.names if alias.name == fn_name)
        if isinstance(node, ast.Import):
            pytest_aliases.update(alias.asname or alias.name for alias in node.names if alias.name == 'pytest')
    cases = []
    skipped = 0
    def call_value(node):
        if not isinstance(node, ast.Call) or not isinstance(node.func, ast.Name) or node.func.id not in aliases or len(node.args) != 1 or node.keywords:
            raise ValueError('Test does not directly target selected imported function.')
        return literal(node.args[0])
    def add(node):
        nonlocal skipped
        try:
            if isinstance(node, ast.Assert) and isinstance(node.test, ast.Compare) and len(node.test.ops) == 1 and isinstance(node.test.ops[0], ast.Eq) and len(node.test.comparators) == 1:
                value, expected = call_value(node.test.left), literal(node.test.comparators[0])
                actual = contract(value)
                if type(expected) is not int or actual != expected:
                    raise ValueError('Existing expectation disagrees with authored decimal contract.')
                cases.append({'input':value, 'expected':expected})
            elif isinstance(node, ast.With) and len(node.items) == 1 and len(node.body) == 1 and isinstance(node.body[0], ast.Expr):
                manager = node.items[0].context_expr
                if not isinstance(manager, ast.Call) or not isinstance(manager.func, ast.Attribute) or not isinstance(manager.func.value, ast.Name) or manager.func.value.id not in pytest_aliases or manager.func.attr != 'raises' or len(manager.args) != 1 or manager.keywords or not isinstance(manager.args[0], ast.Name) or manager.args[0].id != 'ValueError' or node.items[0].optional_vars:
                    raise ValueError('Unsupported exception assertion.')
                value = call_value(node.body[0].value)
                try:
                    contract(value)
                except ValueError:
                    cases.append({'input':value, 'raises':'ValueError'})
                else:
                    raise ValueError('Existing exception expectation disagrees with decimal contract.')
            else:
                skipped += 1
        except (ValueError, TypeError, SyntaxError):
            skipped += 1
    for node in tree.body:
        if isinstance(node, (ast.Import, ast.ImportFrom)):
            continue
        if isinstance(node, ast.FunctionDef) and node.name.startswith('test_') and not node.decorator_list and not node.args.args and not node.args.vararg and not node.args.kwarg and not node.args.kwonlyargs and not node.args.posonlyargs:
            for statement in node.body:
                add(statement)
        else:
            add(node)
    if not aliases or len(cases) < 2 or len(cases) > 32:
        raise ValueError('Need 2-32 bounded matching literal assertions from this module import.')
    if len({json.dumps(c, sort_keys=True) for c in cases}) != len(cases):
        raise ValueError('Duplicate cases do not establish additional evidence.')
    return cases, skipped

def load_function(fn):
    # Finite syntax, no loops, dynamic attributes, imports or external names.
    allowed = (ast.FunctionDef, ast.arguments, ast.arg, ast.If, ast.Return, ast.Raise, ast.Try, ast.ExceptHandler, ast.Pass, ast.Expr, ast.Constant, ast.Call, ast.Name, ast.Load, ast.Compare, ast.Is, ast.IsNot, ast.Eq, ast.NotEq, ast.UnaryOp, ast.Not, ast.USub, ast.UAdd, ast.BoolOp, ast.And, ast.Or, ast.Tuple, ast.Attribute)
    names = {fn.args.args[0].arg} | SAFE_CALLABLES
    for node in ast.walk(fn):
        if isinstance(node, ast.Name) and isinstance(node.ctx, (ast.Store, ast.Del)) or isinstance(node, ast.NamedExpr) or isinstance(node, ast.ExceptHandler) and node.name:
            raise ValueError('Local bindings and named exception targets are unsupported.')
        if isinstance(node, ast.Call) and isinstance(node.func, ast.Name) and node.func.id == fn.name:
            raise ValueError('Selected function recursion is unsupported.')
        if not isinstance(node, allowed):
            raise ValueError('Unsupported function grammar: ' + type(node).__name__)
        if isinstance(node, ast.Name) and node.id not in names:
            raise ValueError('External/local dependency is not allowed.')
        if isinstance(node, ast.Attribute) and not (node.attr == 'strip' and isinstance(node.value, ast.Name) and node.value.id == fn.args.args[0].arg):
            raise ValueError('Unsupported attribute access.')
        if isinstance(node, ast.Call):
            if node.keywords or len(node.args) > 2 or not (isinstance(node.func, ast.Name) and node.func.id in names - {fn.args.args[0].arg} or isinstance(node.func, ast.Attribute) and node.func.attr == 'strip' and not node.args):
                raise ValueError('Unsupported function call.')
        if isinstance(node, ast.ExceptHandler) and node.name:
            raise ValueError('Named exception handlers unsupported.')
        if isinstance(node, ast.Constant) and (type(node.value) not in (str,int,float,bool,type(None)) or isinstance(node.value,str) and len(node.value) > 256 or type(node.value) in (int,float) and (not math.isfinite(node.value) or abs(node.value)>1000000)):
            raise ValueError('Unsupported function constant.')
    safe = {name: getattr(__import__('builtins'), name) for name in names - {fn.args.args[0].arg}}
    namespace = {'__builtins__':safe}
    exec(compile(ast.Module(body=[fn], type_ignores=[]), '<selected-function-only>', 'exec'), namespace)
    return namespace[fn.name]

def failures(function, cases):
    result = []
    for index, case in enumerate(cases):
        try:
            actual = function(case['input'])
            ok = 'raises' not in case and type(actual) is int and actual == case['expected']
        except ValueError:
            ok = case.get('raises') == 'ValueError'
        except Exception:
            ok = False
        if not ok:
            result.append(index)
    return result

def main():
    inspect = sys.argv[1] == '--inspect'
    args = sys.argv[2:] if inspect else sys.argv[1:]
    source_path, fn_name = args[:2]
    _, tree = read_file(source_path)
    fn = selected(tree, fn_name)
    cases = None
    test_path = args[2] if len(args) > 2 else None
    if test_path:
        raw, tests = read_file(test_path)
        digest = hashlib.sha256(raw).hexdigest()
        if not inspect and (len(args) < 4 or digest != args[3]):
            raise ValueError('Project test digest changed. Start a newly inspected session; no result recorded.')
        cases, skipped = project_cases(tests, source_path, fn_name)
    if inspect:
        if not test_path:
            raise ValueError('An existing project test file is required for repair inspection.')
        snippet = canonical_baseline(fn)
        failed = failures(load_function(fn), cases)
        if not failed:
            raise ValueError('Approved project tests already pass. No repair task was fabricated.')
        print(json.dumps({'path':source_path,'source':snippet,'test_path':test_path,'test_digest':digest,'cases':cases,'skipped':skipped,'baseline_failures':len(failed)}))
        return
    function = load_function(fn)
    if cases and failures(function, cases):
        raise ValueError('Approved existing project assertions still fail.')
    authored = [{'input':v,'expected':e} for v,e in VALID] + [{'input':v,'raises':'ValueError'} for v in INVALID]
    if failures(function, authored):
        raise ValueError('Authored decimal contract failed. Inspect valid/invalid inputs.')
    print('BML_DECIMAL_CONTRACT_14_PASS')
    if test_path:
        print('BML_PINNED_TEST_' + digest)

try:
    main()
except (ValueError, SyntaxError, OSError, UnicodeError) as error:
    message = str(error)
    print(message, file=sys.stderr)
    # Invalid provenance/unsupported syntax is a blocked evaluation, not failed skill evidence.
    sys.exit(1 if message in ('Approved existing project assertions still fail.', 'Authored decimal contract failed. Inspect valid/invalid inputs.') else 3)
