# Lets the tests import the backend modules (calculator, model, main...).
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# pycel (used to recalculate the Excel export in tests) still calls ast.Str,
# which Python 3.14 removed. ast.Constant is its replacement.
import ast

if not hasattr(ast, "Str"):
    ast.Str = lambda s=None, **kwargs: ast.Constant(value=s if s is not None else kwargs.get("value"))
