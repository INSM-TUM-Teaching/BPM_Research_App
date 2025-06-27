cd src/simod/gui
npm run start &

sleep 5

cd ../../..
cd src/simod/server
python simod_wrapper.py --configuration configuration_test.yml
