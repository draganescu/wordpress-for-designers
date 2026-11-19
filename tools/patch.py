"""Whitespace-insensitive text replacement for source edits.

Usage (from Python): from patch import Patch; p = Patch(path); p.rep(old, new); p.save()
"""
import re


class Patch:
    def __init__(self, path):
        self.path = path
        self.text = open(path).read()

    def rep(self, old, new):
        tokens = [re.escape(t) for t in old.split()]
        pattern = re.compile(r"\s*".join(tokens))
        matches = pattern.findall(self.text)
        assert len(matches) >= 1, "not found: " + old[:70]
        self.text = pattern.sub(lambda m: new, self.text, count=1)
        return self

    def save(self):
        open(self.path, "w").write(self.text)
