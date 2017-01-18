#/bin/bash
gen="$1"
cd /opt/storytime-backend/
sudo git pull
sudo pkill -9 -f storytime-backend-0.0.1-SNAPSHOT-jar-with-dependencies.jar
mvn clean compile assembly:single

if [ "$gen" = "GENDOCS" ]
then
	echo "gen detected"
	sudo apidoc -i src/view -o apidoc/
	sudo git add .
	sudo git commit -m "[bot] updated docs"
	sudo git push
fi

java -jar target/storytime-backend-0.0.1-SNAPSHOT-jar-with-dependencies.jar
exit
