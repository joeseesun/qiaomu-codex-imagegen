"""Release-gate bridge: runs the Node test suite (tests/imagegen.test.mjs) under `python -m unittest`."""
import shutil
import subprocess
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


class NodeSuite(unittest.TestCase):
    @unittest.skipUnless(shutil.which("node"), "node is required")
    def test_node_tests_pass(self):
        result = subprocess.run(["node", "--test", "tests/imagegen.test.mjs"], cwd=ROOT, capture_output=True, text=True, timeout=120)
        self.assertEqual(result.returncode, 0, result.stdout[-2000:] + result.stderr[-2000:])


if __name__ == "__main__":
    unittest.main()
