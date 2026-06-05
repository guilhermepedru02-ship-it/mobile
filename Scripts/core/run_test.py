import subprocess, sys
result = subprocess.run(
    ['node', 'test_embeddings.mjs'],
    cwd='/storage/emulated/0/Workspace/Scripts/core',
    capture_output=True,
    text=True,
    timeout=120
)
print(result.stdout)
if result.stderr:
    print('STDERR:', result.stderr[:500])
