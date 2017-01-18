<?php
header ( 'Access-Control-Allow-Origin: *' );
header ( 'Content-Type: application/json' );

if (isset($_GET["id"])){
	echo json_encode(getQuote($_GET["id"]));
} else {
	echo json_encode(getRandom());
}

function getRandom() {
	$db = new SQLite3 ( 'plebian.db' );
	$amount = $db->querySingle ( 'SELECT COUNT(*) FROM quotes' );
	$data = $db->querySingle ( "SELECT ID, QUOTE, AUTHOR FROM quotes WHERE ID=" . mt_rand ( 1, $amount ), true );
	$data ['QUOTE'] = htmlentities ( $data ['QUOTE'] );
	$data ['AUTHOR'] = htmlentities ( $data ['AUTHOR'] );
	return $data;
}
function getQuote($id) {
	$db = new SQLite3 ( 'plebian.db' );
	$data = $db->querySingle ( "SELECT ID, QUOTE, AUTHOR FROM quotes WHERE ID=" . $id, true );
	if (isset ( $data ['QUOTE'])) {
		$data ['QUOTE'] = htmlentities ( $data ['QUOTE'] );
		$data ['AUTHOR'] = htmlentities ( $data ['AUTHOR'] );
		return $data;
	} else {
		return getRandom();
	}
}
?>
