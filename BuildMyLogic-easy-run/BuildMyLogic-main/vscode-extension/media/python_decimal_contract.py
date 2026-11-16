"""Run only one learner-selected function, not its module. No imports or ambient I/O."""
import ast
import pathlib
import sys

root = pathlib.Path.cwd().resolve()
source = (root / sys.argv[1]).resolve()
if not source.is_relative_to(root) or source.suffix != '.py' or source.stat().st_size > 32000:
    raise SystemExit('Unsupported source path or size. No assertion passed.')
tree = ast.parse(source.read_text(encoding='utf-8'))
functions = [n for n in tree.body if isinstance(n, ast.FunctionDef) and n.name == sys.argv[2]]
if len(functions) != 1:
    raise SystemExit('Selected function missing or ambiguous. No assertion passed.')
fn = functions[0]
if fn.decorator_list or fn.returns or len(fn.args.args) != 1 or fn.args.args[0].annotation or fn.args.defaults or fn.args.kw_defaults or fn.args.kwonlyargs or fn.args.posonlyargs or fn.args.vararg or fn.args.kwarg:
    raise SystemExit('Keep one unannotated standalone argument and no decorators/defaults.')
for node in ast.walk(fn):
    if isinstance(node, (ast.Import, ast.ImportFrom, ast.Global, ast.Nonlocal)) or isinstance(node, ast.Attribute) and node.attr.startswith('_') or isinstance(node, ast.Name) and node.id.startswith('__'):
        raise SystemExit('Unsupported side effects or introspection. No assertion passed.')
safe = {k: getattr(__import__('builtins'), k) for k in ['int','str','bool','float','isinstance','type','ValueError','TypeError','len','all','any','ord','range']}
namespace = {'__builtins__': safe}
exec(compile(ast.Module(body=[fn], type_ignores=[]), '<selected-function>', 'exec'), namespace)
function = namespace[fn.name]
valid = [(0,0), (-7,-7), ('23',23), (' +4 ',4), ('-5',-5), ('0',0)]
invalid = [True,False,2.5,'','  ','1.2','abc',None]
for value, expected in valid:
    actual = function(value)
    if type(actual) is not int or actual != expected:
        raise SystemExit('Valid decimal case failed: ' + repr(value))
for value in invalid:
    try:
        function(value)
    except ValueError:
        continue
    except Exception as error:
        raise SystemExit('Expected ValueError for ' + repr(value) + ', got ' + type(error).__name__)
    raise SystemExit('Invalid input accepted: ' + repr(value))
print('BML_DECIMAL_CONTRACT_14_PASS')
