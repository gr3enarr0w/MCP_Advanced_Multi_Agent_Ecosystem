def test_import_server():
    # Ensure the server module imports without side effects raising errors.
    import context_persistence.server  # noqa: F401
