"""Finite scalar utility contract evaluator, not an arbitrary Python sandbox.
Only selected validated function AST runs. Module/test code is parsed, never imported.
"""
import ast
import hashlib
import json
import math
import operator
import pathlib
import sys

BUILTINS = {'abs', 'len', 'int', 'float', 'str', 'bool'}
METHODS = {'strip', 'lower', 'upper'}
RESERVED = BUILTINS | {'__builtins__', '_bml_bin', '_bml_unary', '_bml_call', '_bml_method'}
BINARY = {ast.Add: operator.add, ast.Sub: operator.sub, ast.Mult: operator.mul, ast.Div: operator.truediv, ast.FloorDiv: operator.floordiv, ast.Mod: operator.mod}

class Blocked(ValueError):
    pass

def scalar(value):
    if type(value) not in (str,int,float,bool,type(None)):
        raise Blocked('Only exact scalar values are supported.')
    if type(value) is str and len(value)>256:
        raise Blocked('String value exceeds256characters.')
    if type(value) in (int,float) and (abs(value)>1000000 or type(value) is float and not math.isfinite(value)):
        raise Blocked('Numeric value exceeds finite +/-1000000 bounds.')
    return value

def read(relative):
    root=pathlib.Path.cwd().resolve()
    path=(root/relative).resolve()
    if not path.is_relative_to(root) or path.suffix!='.py' or path.stat().st_size>32000:
        raise Blocked('Source/test must be a <=32KB Python file inside this workspace.')
    raw=path.read_bytes()
    try:
        tree=ast.parse(raw.decode('utf-8'))
    except (SyntaxError,UnicodeError,RecursionError):
        raise Blocked('Source/test syntax is invalid or too deeply nested.')
    if len(list(ast.walk(tree)))>5000:
        raise Blocked('Source/test AST exceeds inspection budget.')
    return raw,tree

def selected(tree,name,signature=None):
    found=[n for n in tree.body if isinstance(n,ast.FunctionDef) and n.name==name]
    if len(found)!=1:
        raise Blocked('Selected top-level function missing or ambiguous.')
    fn=found[0]; a=fn.args
    names=[arg.arg for arg in a.args]
    if not 1<=len(names)<=3 or len(set(names))!=len(names) or any(n in RESERVED or n.startswith('_') for n in [fn.name]+names) or fn.name in names:
        raise Blocked('Function/argument names shadow evaluator names or unsupported signature.')
    if fn.decorator_list or fn.returns or a.defaults or a.kw_defaults or a.kwonlyargs or a.posonlyargs or a.vararg or a.kwarg or any(arg.annotation for arg in a.args):
        raise Blocked('Decorators/defaults/annotations/variadic or keyword-only arguments unsupported.')
    if signature is not None and names!=signature:
        raise Blocked('Selected function signature changed. No attempt recorded.')
    if len(ast.unparse(fn))>8000 or len(list(ast.walk(fn)))>128:
        raise Blocked('Selected function exceeds8KB/128ASTnode bound.')
    return fn,names

def safe_bin(kind,left,right):
    if type(left) not in (int,float) or type(right) not in (int,float):
        raise Blocked('Arithmetic is numeric-only; string repetition/formatting is unsupported.')
    scalar(left);scalar(right)
    try:
        result=BINARY[getattr(ast,kind)](left,right)
    except (ZeroDivisionError,OverflowError):
        raise ValueError('Arithmetic cannot be evaluated for this case.')
    return scalar(result)

def safe_unary(kind,value):
    if type(value) not in (int,float):
        raise Blocked('Unary numeric operation requires a number.')
    return scalar(-value if kind=='USub' else +value)

def safe_call(name,value):
    scalar(value)
    if name=='abs' and type(value) not in (int,float) or name=='len' and type(value) is not str:
        raise Blocked('Builtin argument type unsupported.')
    try:
        result={'abs':abs,'len':len,'int':int,'float':float,'str':str,'bool':bool}[name](value)
    except (ValueError,TypeError,OverflowError):
        raise ValueError('Conversion failed for this approved case.')
    return scalar(result)

def safe_method(name,value):
    if type(value) is not str:
        raise Blocked('String operation on non-string value is unsupported.')
    return scalar({'strip':str.strip,'lower':str.lower,'upper':str.upper}[name](value))

class BoundExpressions(ast.NodeTransformer):
    def visit_BinOp(self,node):
        return ast.copy_location(ast.Call(func=ast.Name(id='_bml_bin',ctx=ast.Load()),args=[ast.Constant(type(node.op).__name__),self.visit(node.left),self.visit(node.right)],keywords=[]),node)
    def visit_UnaryOp(self,node):
        if isinstance(node.op,ast.Not):
            return self.generic_visit(node)
        return ast.copy_location(ast.Call(func=ast.Name(id='_bml_unary',ctx=ast.Load()),args=[ast.Constant(type(node.op).__name__),self.visit(node.operand)],keywords=[]),node)
    def visit_Call(self,node):
        if isinstance(node.func,ast.Name):
            name='_bml_call'; args=[ast.Constant(node.func.id),self.visit(node.args[0])]
        else:
            name='_bml_method';args=[ast.Constant(node.func.attr),self.visit(node.func.value)]
        return ast.copy_location(ast.Call(func=ast.Name(id=name,ctx=ast.Load()),args=args,keywords=[]),node)

def load(fn,names):
    allowed=(ast.FunctionDef,ast.arguments,ast.arg,ast.Return,ast.If,ast.Constant,ast.Name,ast.Load,ast.Call,ast.Attribute,ast.BinOp,ast.Add,ast.Sub,ast.Mult,ast.Div,ast.FloorDiv,ast.Mod,ast.UnaryOp,ast.Not,ast.USub,ast.UAdd,ast.Compare,ast.Eq,ast.NotEq,ast.Lt,ast.LtE,ast.Gt,ast.GtE,ast.Is,ast.IsNot,ast.BoolOp,ast.And,ast.Or)
    for node in ast.walk(fn):
        if isinstance(node,ast.FunctionDef) and node is not fn:
            raise Blocked('Nested functions/local bindings unsupported.')
        if not isinstance(node,allowed):
            raise Blocked('Unsupported selected function grammar: '+type(node).__name__)
        if isinstance(node,ast.Name) and node.id not in set(names)|BUILTINS:
            raise Blocked('External names/recursion/local bindings unsupported.')
        if isinstance(node,ast.Constant):scalar(node.value)
        if isinstance(node,ast.Call):
            if node.keywords:
                raise Blocked('Keyword calls unsupported.')
            if isinstance(node.func,ast.Name):
                if node.func.id not in BUILTINS or len(node.args)!=1:
                    raise Blocked('Only named safe scalar conversion builtins supported.')
            elif not (isinstance(node.func,ast.Attribute) and node.func.attr in METHODS and not node.args):
                raise Blocked('Only zero-argument strip/lower/upper methods supported.')
        if isinstance(node,ast.Attribute) and node.attr not in METHODS:
            raise Blocked('Attribute access unsupported.')
    for parent in ast.walk(fn):
        for child in ast.iter_child_nodes(parent):
            if isinstance(child,ast.Name) and child.id in BUILTINS and not (isinstance(parent,ast.Call) and parent.func is child):
                raise Blocked('Bare builtin values unsupported.')
    # Prevent returning a bound method instead of calling it, without exposing ambient objects.
    for parent in ast.walk(fn):
        for child in ast.iter_child_nodes(parent):
            if isinstance(child,ast.Attribute) and not (isinstance(parent,ast.Call) and parent.func is child):
                raise Blocked('Bare attribute values unsupported.')
    bounded=BoundExpressions().visit(fn)
    module=ast.fix_missing_locations(ast.Module(body=[bounded],type_ignores=[]))
    ns={'__builtins__':{},'_bml_bin':safe_bin,'_bml_unary':safe_unary,'_bml_call':safe_call,'_bml_method':safe_method}
    exec(compile(module,'<selected-bounded-utility-only>','exec'),ns)
    return ns[fn.name]

def literal(node):
    if len(list(ast.walk(node)))>4:
        raise Blocked('Only bounded scalar test literals supported.')
    try:return scalar(ast.literal_eval(node))
    except (ValueError,TypeError,RecursionError):raise Blocked('Unsupported test literal.')

def cases_from(tree,path,name,arity):
    module=str(pathlib.PurePosixPath(path).with_suffix('')).replace('/','.')
    bindings={}
    for node in tree.body:
        if isinstance(node,ast.ImportFrom):
            for alias in node.names:
                key=alias.asname or alias.name
                value=(node.module,alias.name,node.level)
                if key in bindings and bindings[key]!=value:raise Blocked('Ambiguous imported test alias.')
                bindings[key]=value
        elif isinstance(node,ast.Import):
            for alias in node.names:
                key=alias.asname or alias.name.split('.')[0]
                if key in bindings:raise Blocked('Ambiguous imported test alias.')
                bindings[key]=(None,None,None)
    aliases={alias for alias,value in bindings.items() if value==(module,name,0)}
    if not aliases:raise Blocked('Test imports do not bind this exact module/function.')
    for node in ast.walk(tree):
        if isinstance(node,ast.Name) and isinstance(node.ctx,(ast.Store,ast.Del)) and node.id in aliases or isinstance(node,(ast.FunctionDef,ast.ClassDef)) and node.name in aliases:
            raise Blocked('Selected test alias is rebound, contract ambiguous.')
    top_imports={id(n) for n in tree.body if isinstance(n,(ast.Import,ast.ImportFrom))}
    for node in ast.walk(tree):
        if isinstance(node,(ast.Import,ast.ImportFrom)) and id(node) not in top_imports:
            keys={a.asname or a.name.split('.')[0] for a in node.names}
            if aliases & keys:raise Blocked('Nested import rebinds selected test alias.')
        if isinstance(node,ast.ExceptHandler) and node.name in aliases or isinstance(node,ast.AsyncFunctionDef) and node.name in aliases:
            raise Blocked('Selected test alias has another binding.')
        if isinstance(node,(ast.Assign,ast.AugAssign,ast.AnnAssign,ast.Delete)):
            if any(isinstance(n,ast.Name) and n.id in aliases for n in ast.walk(node)):
                raise Blocked('Mutation involving selected test alias is unsupported.')
    cases=[];skipped=0
    def add(statement):
        nonlocal skipped
        if not isinstance(statement,ast.Assert) or statement.msg or not isinstance(statement.test,ast.Compare) or len(statement.test.ops)!=1 or not isinstance(statement.test.ops[0],ast.Eq) or len(statement.test.comparators)!=1:
            skipped+=1;return
        call=statement.test.left
        if not isinstance(call,ast.Call) or not isinstance(call.func,ast.Name) or call.func.id not in aliases or len(call.args)!=arity or call.keywords:
            skipped+=1;return
        try:
            args=[literal(a) for a in call.args];expected=literal(statement.test.comparators[0])
        except Blocked:
            skipped+=1;return
        cases.append({'args':args,'expected':expected})
    for node in tree.body:
        if isinstance(node,(ast.Import,ast.ImportFrom)):continue
        if isinstance(node,ast.FunctionDef) and node.name.startswith('test_') and not node.decorator_list and not node.args.args and not node.args.kwonlyargs and not node.args.posonlyargs and not node.args.vararg and not node.args.kwarg:
            if all(isinstance(stmt,ast.Assert) for stmt in node.body):
                for stmt in node.body:add(stmt)
            else:skipped+=len(node.body)
        else:add(node)
    if len(json.dumps(cases,sort_keys=True,ensure_ascii=True))>2500:raise Blocked('Approved case payload exceeds2500character bound.')
    if not 2<=len(cases)<=32 or len({json.dumps(c,sort_keys=True) for c in cases})!=len(cases):raise Blocked('Need2-32distinct matching literal equality assertions.')
    return cases,skipped

def failed_cases(function,cases):
    failed=[]
    for index,case in enumerate(cases):
        try:
            actual=scalar(function(*case['args']))
            # Preserve the actual Python == oracle from approved project assertions.
            # Values are exact bounded scalars, so no user-defined equality executes.
            ok=actual==case['expected']
        except Blocked:raise
        except (ValueError,TypeError,ZeroDivisionError,OverflowError):ok=False
        if not ok:failed.append(index)
    return failed

def constructs_from(fn):
    result=[]
    if any(isinstance(n,ast.BinOp) for n in ast.walk(fn)):result.append('arithmetic')
    if any(isinstance(n,(ast.If,ast.Compare,ast.BoolOp)) for n in ast.walk(fn)):result.append('conditionals')
    if any(isinstance(n,ast.Attribute) and n.attr in METHODS for n in ast.walk(fn)):result.append('string-normalization')
    return result

def partition_cases(cases,cases_json):
    # Python-equal numeric/bool inputs are the same input, not fresh examples.
    seen=[]
    for case in cases:
        if case['args'] in seen:raise Blocked('Changed-input recheck needs distinct input tuples, not repeated or numeric-equivalent inputs.')
        seen.append(case['args'])
    if len(cases)<4:raise Blocked('Need at least4distinct inputs for2initial plus2reviewed changed-input cases.')
    indices={'initial_indices':list(range(len(cases)-2)),'recheck_indices':[len(cases)-2,len(cases)-1]}
    digest=hashlib.sha256((cases_json+'\n'+json.dumps(indices,separators=(',',':'))).encode()).hexdigest()
    return dict(indices,version=1,partition_digest=digest)

def main():
    if len(sys.argv)<2:raise Blocked('Missing evaluator arguments; no attempt recorded.')
    mode=sys.argv[1]
    inspect=mode in ('--inspect','--inspect-partition')
    recheck=mode=='--recheck'
    args=sys.argv[2:] if inspect or recheck else sys.argv[1:]
    if len(args) not in ((3,) if inspect else (7,) if recheck else (6,7)):raise Blocked('Invalid evaluator argument count; no attempt recorded.')
    path,name,test_path=args[:3]
    raw,tree=read(path);test_raw,test_tree=read(test_path)
    digest=hashlib.sha256(test_raw).hexdigest()
    signature=None if inspect else args[4].split(',')
    if not inspect and digest!=args[3]:raise Blocked('Pinned test digest changed; inspect new session, no attempt recorded.')
    fn,names=selected(tree,name,signature)
    snippet=ast.unparse(fn)
    constructs=constructs_from(fn)
    cases,skipped=cases_from(test_tree,path,name,len(names))
    cases_json=json.dumps(cases,sort_keys=True,separators=(',',':'),ensure_ascii=True,allow_nan=False)
    cases_digest=hashlib.sha256(cases_json.encode()).hexdigest()
    if not inspect and cases_digest!=args[5]:raise Blocked('Approved cases changed; no attempt recorded.')
    partition=partition_cases(cases,cases_json) if mode=='--inspect-partition' or not inspect and len(args)==7 else None
    if partition and not inspect and partition['partition_digest']!=args[6]:raise Blocked('Pinned case partition changed; no attempt recorded.')
    indices=partition['recheck_indices' if recheck else 'initial_indices'] if partition else list(range(len(cases)))
    failed=failed_cases(load(fn,names),[cases[i] for i in indices])
    if inspect:
        if not failed:raise Blocked('Approved initial project cases already pass; no repair task fabricated.')
        payload=json.dumps({'kind':'python-literal-repair-v1','path':path,'source':snippet,'function_name':name,'arguments':names,'test_path':test_path,'test_digest':digest,'cases_json':cases_json,'cases_digest':cases_digest,'baseline_failures':len(failed),'skipped':skipped,'constructs':constructs,**({'approved_partition':True,'partition':partition} if partition else {})},ensure_ascii=True)
        if len(payload)>5500:raise Blocked('Approved inspector payload exceeds5500character transport bound.')
        print(payload)
    elif failed:
        print(('Reviewed changed-input cases failed: ' if recheck else 'Approved finite project cases failed: ')+','.join(str(indices[i]+1) for i in failed));sys.exit(1)
    else:
        print(('BML_LITERAL_RECHECK_V1_PASS' if recheck else 'BML_LITERAL_REPAIR_V1_PASS')+'\nBML_PINNED_TEST_'+digest)
        if partition:print('BML_PARTITION_'+partition['partition_digest'])

try:main()
except (Blocked,SyntaxError,OSError,UnicodeError,IndexError,KeyError,RecursionError,TypeError) as error:
    print('BLOCKED: '+str(error),file=sys.stderr);sys.exit(3)
