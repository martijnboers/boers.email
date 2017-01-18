<?php
$msg = (isset($_POST["payload"])) ? json_decode($_POST["payload"])->commits : "leeg";
$gendocs = false;

foreach ($msg as $commit) {
	if (strpos($commit->message, 'GENDOCS') !== false) {
		$gendocs = true;
}
}
var_dump($msg);

if ( $gendocs ){
	exec("sudo ./update.sh GENDOCS > /dev/null &");
	echo "gen tags";
} else {
	exec("sudo ./update.sh > /dev/null &");
	echo "no tags";
}
echo "<pre>done</pre>";
?>
