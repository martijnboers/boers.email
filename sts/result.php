<html>
<?php
session_start();

$url = $_GET["url"];
if (empty($url) === true){
	$_SESSION['error']="No (valid) URL given";
	header( 'Location: index.php' ) ;
}
preg_match_all("/(.*)<(.*)/", $url, $hack);

if  ($hack[0][0] != ""){
	$_SESSION['error']="plz don't h4ck me";
	$url = "";
	error_log("Hacking attempt", 0);
	header( 'Location: index.php' ) ;
}
$c = curl_init();
curl_setopt( $c, CURLOPT_RETURNTRANSFER, true );
curl_setopt( $c, CURLOPT_NOBODY, true);
curl_setopt( $c, CURLOPT_HEADER, 1 );
curl_setopt( $c, CURLOPT_NOBODY, true );
curl_setopt( $c, CURLOPT_FOLLOWLOCATION, true);
curl_setopt( $c, CURLOPT_URL, $url );

$res = curl_exec( $c );
error_log("Send curl request", 0);
preg_match_all("/(.*)Strict(.*)/", $res, $getLine);
$_SESSION['output'] = htmlentities($getLine[0][0]);
if ($_SESSION['output'] == "") {
	$_SESSION['output'] = "Geen STS Header ontvangen";
}
$isEnabled = strpos($res, 'Strict-Transport-Security');
$urlStripped = str_replace('https://', '', $url);
$file = 'sessions/' . session_id() . '.json';
$current = json_decode(file_get_contents($file), true);
$preList = file_get_contents("preloaded.json");
$hosts = json_decode($preList, true);
$preload = false;
$preload = "";

/* foreach ($hosts["entries"] as $entry) {
        preg_match_all("/(.*)". $entry["name"] . "(.*)/", $urlStripped, $preloaded);
	if ($preloaded[0][0] != "") {
		$output = array($urlStripped => '<img src="images/preload.png" height=20 length=20>');
		//$output2 = $output1 + $current;
		$contentToFile = json_encode($output);
		$_SESSION['preloaded']="Site is <a href='http://dev.chromium.org/sts'> preloaded </a>!";
		$preload = true;
		error_log("Site is preloaded, skipping to return", 0);
		break;
	}
} */

if (empty($isEnabled) === true and $preload === false) {
	$output1 = array($urlStripped => '<img src="images/error.png" height=20 length=20>');
	//$output2 = $output1 + $current;
	error_log("Site ". $urlStripped ." doesn't have sts", 0);
	$contentToFile = json_encode($output1);
}
elseif ($preloaded === false){
	$output3 = array($urlStripped => '<img src="images/vinkje.png" height=20 length=20>');
	error_log("Site ". $urlStripped ." does have sts", 0);
	$contentToFile = json_encode($output3);
}
file_put_contents($file, $contentToFile);
header( 'Location: index.php' ) ;
?>
</html>
