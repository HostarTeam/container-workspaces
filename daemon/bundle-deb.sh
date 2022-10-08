cd ./cw-tools/
poetry install
poetry run pyinstaller --onefile cw_tools/__init__.py
cd -
mkdir -p build/usr/bin
mv cw-tools/dist/__init__ build/usr/bin/cw-tools
