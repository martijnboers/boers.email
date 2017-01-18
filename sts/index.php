<?php
//error_reporting(-1);
//ini_set('display_errors', 'On');

session_start();
$file = 'sessions/' . session_id() . '.json';
$json = file_get_contents($file);
$data = json_decode($json, TRUE);
if (key($data) == "") {
	$empty = true;
}
else {
	$empty = false;
}
?>
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <title>HSTS</title>
    <meta name="description" content="Check hsts">
    <meta name="author" content="Martijn">

        <link href="../favicon.ico" rel="icon" type="image/x-icon" />
    <link href="css/bootstrap.css" rel="stylesheet">
        <link href="css/bootstrap-glyphicons.css" rel="stylesheet">
        <link href="css/custom.css" rel="stylesheet">

    </style>
<style type="text/css">
	.bs-example{
	margin: 20px;
	margin-left:-20px;
	}
</style>

</head>
<body>
  <div class="container">
    <div class="content">
      <div class="row">
        <div class="login-form" >
                  <h2 style=margin-left:45px;> Check HSTS </h2>
                  <hr style="margin-left:-30px;">
          <form class="form-horizontal" role="form" action="result.php" method="GET">
  <div class="form-group">
    <div class="col-sm-10">
      <input type="text" class="form-control" name="url" id="url" placeholder="https://site.com">
    </div>
  </div>
  <div class="form-group">
    <div class="col-sm-offset-2 col-sm-10" >
      <button style="width:110px; margin-left:15px;" type="submit" value="send" class="btn btn-default"></span> Test site</button>
    </div>
  </div>
</form>
<?php
if ($empty != true) {
echo '	<br><h4>Last scan result:</h4>
	<div style="margin-left:-20px;"class="btn-group btn-group-justified">
 	<div class="btn-group">
        <button style="width: 260px;margin-left: 4px;" type="button" class="btn btn-default">' . htmlentities(key($data)) . '</button>
  	</div>
  	<div class="btn-group">
    	<button style="width:50px; margin-left:100px;" type="button" class="btn btn-default">' .  reset($data) . '</button>'; 

if (empty($_SESSION['output'] != true)){
	echo '</div></div><button style="margin-left: -17px; margin-top: 6px; width: 316px;" type="button" class="btn btn-default">' . $_SESSION['output'] . '</button';
	$_SESSION['preloaded'] = "";
}
else {
	echo '</div></div>';
}
if (empty($_SESSION['preloaded'] != true)){
        echo '</div></div><button style="margin-left: 19px; margin-top: 6px; width: 316px;" type="button" class="btn btn-default">' . $_SESSION['preloaded'] . '</button';
	$_SESSION['preloaded'] = "";
}
else {
        echo '</div></div><button style="margin-left: 19px; margin-top: 6px; width: 316px;" type="button" class="btn btn-default">Site is <a href="http://dev.chromium.org/sts"> preloaded </a>!</button';
}
}
if ($_SESSION['error'] != "") {
echo 	'<div class="bs-example"><div class="alert alert-error">
    	<a href="#" class="close" data-dismiss="alert">&times;</a>
    	<strong>Error!</strong> ' . $_SESSION['error'] . '.
	</div></div>';
	$_SESSION['error']="";
}
?>
<script src="https://ajax.googleapis.com/ajax/libs/jquery/1.11.0/jquery.min.js"></script>
<script src="js/bootstrap-alert.js"></script>
<script src="js/bootstrap.min.js"></script>
</body>
</html>
