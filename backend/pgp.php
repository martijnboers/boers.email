<?php
$db = new SQLite3 ( 'plebian.db' );
$stmt = $db->prepare ( 'SELECT * FROM pgp WHERE id=:id' );
$stmt->bindValue ( ':id', $_GET ['id'], SQLITE3_INTEGER );

$result = $stmt->execute ();
$data = $result->fetchArray(SQLITE3_ASSOC);

header('Content-Disposition: attachment; filename="'.$data["name"].'"');
header('Content-Type: text/plain');
header('Content-Length: ' . strlen($data['pgp']));
header('Connection: close');

echo $data['pgp'];
?>