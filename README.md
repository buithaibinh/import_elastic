# Import csv to elastic
npm i

cd /bin

node elastic-import.js input.csv localhost:9200 <index> <type> --csv -h -p -b 10000

node elastic-import.js input.csv {URL} <index> <type> --csv -h -p -b 10000

node elastic-import.js users.csv {URL} <index> <type> --csv -h -p -b 10000