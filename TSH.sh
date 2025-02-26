#!/bin/bash

source env/bin/activate

python3.10 -m pip install pipenv
python3.10 -m pipenv install -r dependencies/requirements.txt
python3.10 -m pipenv run python main.py
