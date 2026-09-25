# Lets the tests import the backend modules (calculator, model, main...).
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
