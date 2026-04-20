import os


def pytest_configure(config):
    os.environ.setdefault("SECRET_KEY", "test-secret-key-for-pytest-only-not-for-production")
