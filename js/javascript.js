var tableBody = $('div.post-content');
var loc = window.location.pathname;
var dir = loc.replace(/^\D+/g, '');
var toggle = $('a.toggle');

var audioCtx = new (window.AudioContext || window.webkitAudioContext)();
var audioElement = document.getElementById('audioElement');
var audioSrc = audioCtx.createMediaElementSource(audioElement);
var analyser = audioCtx.createAnalyser();
analyser.fftSize = 2048;
var audioContext = new AudioContext();
var sampleRate = audioContext.sampleRate;
var beatdetect = null;
var round = true;

var paused = true;
// Bind our analyser to the media element source.
audioSrc.connect(analyser);
audioSrc.connect(audioCtx.destination);

// var frequencyData = new Uint8Array(analyser.frequencyBinCount);
var frequencyData = new Uint8Array(200);

$(document).ready(function() {
	//
	// Welcome in the land of spaghetti code
	//

	// Slide in quotes bar
	$('.hidden').fadeIn(1000).removeClass('hidden');

	if (!navigator.userAgent.indexOf("Firefox") != -1){
		beatdetect = new FFT.BeatDetect(analyser.frequencyBinCount, sampleRate);
	}
	// Shortcuts
	var down = [];
	$(document).keydown(function(e) {
		down[e.keyCode] = true;
	}).keyup(function(e) {
		if (down[17] && down[16] && down[83]) {
			$("#stats").toggle("slow", function() {
			});
		}
		if (down[82]) {
			getQuotes(dir);
		}
		down[e.keyCode] = false;
	});

	if (getCookie("music") == "true") {
		audioElement.play();
		audioElement.loop = true;
		audioElement.volume = 0.7;
		paused = false;
	} else {
		toggle.empty();
		toggle.prepend("<i class=\"fa fa-play\"></i>");
	}
	toggle.click(function(e) {
		if (paused) {
			toggle.empty();
			toggle.prepend("<i class=\"fa fa-pause\"></i>");
			document.cookie = "music=true;";
			paused = false;
			audioElement.play();
		} else {
			toggle.empty();
			toggle.prepend("<i class=\"fa fa-play\"></i>");
			document.cookie = "music=false;";
			paused = true;
			audioElement.pause();
		}
		return false;
	});

	// Make birds fly to audio
	audioElement.addEventListener("timeupdate", function() {
		renderMove();
	});

	function renderMove() {
		var floats = new Float32Array(analyser.frequencyBinCount);
		analyser.getFloatTimeDomainData(floats);
		analyser.smoothingTimeConstant = 0.85

		beatdetect.detect(floats);
		beatdetect.setSensitivity(200)

		if (beatdetect.isKick()) {
			console.log("beat")
			moveAll();
		}
	}

	// Load the quotes
	getQuotes(dir);

	// Shake stuff
	var myShakeEvent = new Shake({
		threshold : 15, // optional shake strength threshold
		timeout : 1000
	});

	myShakeEvent.start();
	window.addEventListener('shake', shakeEventDidOccur, false);

	// function to call when shake occurs
	function shakeEventDidOccur(event) {
		getQuotes();
		moveAll();
	}

});

function getQuotes(id) {
	if (id != '') {
		var url = "backend/quotes.php?id=" + id;
	} else {
		var url = "backend/quotes.php";
	}

	$
			.ajax({
				type : "GET",
				url : url,

				beforeSend : function() {
					tableBody.empty();
					$(".empty").hide();
					$(".loading")
							.html(
									"<br> <center><img src=\"img/loading.gif\" alt=\"Loading please wait\" style=\"width: 60px; length: 60px;\"></center>")
					$('.loading').show();
				},
				complete : function() {
					$('.loading').hide();
				},

				success : function(data) {
					tableBody.prepend("<h2>" + data.QUOTE + "</h2> "
							+ "<p class=\"satisfy\">" + "<a>—  " + data.AUTHOR + "</a>" + "</p>");
				}
			});
}

function getCookie(cname) {
	var name = cname + "=";
	var ca = document.cookie.split(';');
	for (var i = 0; i < ca.length; i++) {
		var c = ca[i];
		while (c.charAt(0) == ' ')
			c = c.substring(1);
		if (c.indexOf(name) == 0)
			return c.substring(name.length, c.length);
	}
	return "";
}

var Boid = function() {

	var vector = new THREE.Vector3(), _acceleration, _width = 500, _height = 500, _depth = 200, _goal, _neighborhoodRadius = 100, _maxSpeed = 1.8, _maxSteerForce = 0.1, _avoidWalls = false;

	this.position = new THREE.Vector3();
	this.velocity = new THREE.Vector3();
	_acceleration = new THREE.Vector3();

	this.setGoal = function(target) {

		_goal = target;

	};

	this.setAvoidWalls = function(value) {

		_avoidWalls = value;

	};

	this.setWorldSize = function(width, height, depth) {

		_width = width;
		_height = height;
		_depth = depth;

	};

	this.run = function(boids) {

		if (_avoidWalls) {

			vector.set(-_width, this.position.y, this.position.z);
			vector = this.avoid(vector);
			vector.multiplyScalar(5);
			_acceleration.add(vector);

			vector.set(_width, this.position.y, this.position.z);
			vector = this.avoid(vector);
			vector.multiplyScalar(5);
			_acceleration.add(vector);

			vector.set(this.position.x, -_height, this.position.z);
			vector = this.avoid(vector);
			vector.multiplyScalar(5);
			_acceleration.add(vector);

			vector.set(this.position.x, _height, this.position.z);
			vector = this.avoid(vector);
			vector.multiplyScalar(5);
			_acceleration.add(vector);

			vector.set(this.position.x, this.position.y, -_depth);
			vector = this.avoid(vector);
			vector.multiplyScalar(5);
			_acceleration.add(vector);

			vector.set(this.position.x, this.position.y, _depth);
			vector = this.avoid(vector);
			vector.multiplyScalar(5);
			_acceleration.add(vector);

		}

		if (Math.random() > 0.5) {

			this.flock(boids);

		}

		this.move();

	};

	this.flock = function(boids) {

		if (_goal) {

			_acceleration.add(this.reach(_goal, 0.005));

		}

		_acceleration.add(this.alignment(boids));
		_acceleration.add(this.cohesion(boids));
		_acceleration.add(this.separation(boids));

	};

	this.move = function() {

		this.velocity.add(_acceleration);

		var l = this.velocity.length();

		if (l > _maxSpeed) {

			this.velocity.divideScalar(l / _maxSpeed);

		}

		this.position.add(this.velocity);
		_acceleration.set(0, 0, 0);

	};

	this.checkBounds = function() {

		if (this.position.x > _width)
			this.position.x = -_width;
		if (this.position.x < -_width)
			this.position.x = _width;
		if (this.position.y > _height)
			this.position.y = -_height;
		if (this.position.y < -_height)
			this.position.y = _height;
		if (this.position.z > _depth)
			this.position.z = -_depth;
		if (this.position.z < -_depth)
			this.position.z = _depth;

	};

	//

	this.avoid = function(target) {

		var steer = new THREE.Vector3();

		steer.copy(this.position);
		steer.sub(target);

		steer.multiplyScalar(1 / this.position.distanceToSquared(target));

		return steer;

	};

	this.repulse = function(target) {

		var distance = this.position.distanceTo(target);
		if (distance < 150) {

			var steer = new THREE.Vector3();
			steer.subVectors(this.position, target);
			steer.multiplyScalar(0.5 / distance);

			_acceleration.add(steer);

		}

	};

	this.randomMove = function(target) {
		var steer = new THREE.Vector3();
		var pos = Math.random() * (3 - 1) + 1;
		var way = Math.floor(Math.random() * (2 - 1 + 1)) + 1;
		if (way == 1){
		steer.subVectors(this.position, new THREE.Vector3(this.position.x + pos,
				this.position.y + pos, this.position.z));
		} else {
			steer.subVectors(this.position, new THREE.Vector3(this.position.x - pos,
					this.position.y - pos, this.position.z));
		}

		steer.multiplyScalar(0.25);
		_acceleration.add(steer);

	};

	this.reach = function(target, amount) {

		var steer = new THREE.Vector3();

		steer.subVectors(target, this.position);
		steer.multiplyScalar(amount);

		return steer;

	};

	this.alignment = function(boids) {

		var boid, velSum = new THREE.Vector3(), count = 0;

		for (var i = 0, il = boids.length; i < il; i++) {

			if (Math.random() > 0.6)
				continue;

			boid = boids[i];

			distance = boid.position.distanceTo(this.position);

			if (distance > 0 && distance <= _neighborhoodRadius) {

				velSum.add(boid.velocity);
				count++;

			}

		}

		if (count > 0) {
			velSum.divideScalar(count);

			var l = velSum.length();
			if (l > _maxSteerForce) {

				velSum.divideScalar(l / _maxSteerForce);

			}

		}

		return velSum;

	};

	this.cohesion = function(boids) {

		var boid, distance, posSum = new THREE.Vector3(), steer = new THREE.Vector3(), count = 0;

		for (var i = 0, il = boids.length; i < il; i++) {

			if (Math.random() > 0.6)
				continue;

			boid = boids[i];
			distance = boid.position.distanceTo(this.position);

			if (distance > 0 && distance <= _neighborhoodRadius) {

				posSum.add(boid.position);
				count++;

			}

		}

		if (count > 0) {

			posSum.divideScalar(count);

		}

		steer.subVectors(posSum, this.position);

		var l = steer.length();

		if (l > _maxSteerForce) {

			steer.divideScalar(l / _maxSteerForce);

		}

		return steer;

	};

	this.separation = function(boids) {

		var boid, distance, posSum = new THREE.Vector3(), repulse = new THREE.Vector3();

		for (var i = 0, il = boids.length; i < il; i++) {

			if (Math.random() > 0.6)
				continue;

			boid = boids[i];
			distance = boid.position.distanceTo(this.position);

			if (distance > 0 && distance <= _neighborhoodRadius) {

				repulse.subVectors(this.position, boid.position);
				repulse.normalize();
				repulse.divideScalar(distance);
				posSum.add(repulse);

			}
		}
		return posSum;

	}
}

var SCREEN_WIDTH = window.innerWidth, SCREEN_HEIGHT = window.innerHeight, SCREEN_WIDTH_HALF = SCREEN_WIDTH / 2, SCREEN_HEIGHT_HALF = SCREEN_HEIGHT / 2;

var camera, scene, renderer, birds, bird;

var boid, boids;

var stats;

init();
animate();

function init() {

	camera = new THREE.PerspectiveCamera(75, SCREEN_WIDTH / SCREEN_HEIGHT, 1,
			10000);
	camera.position.z = 450;

	scene = new THREE.Scene();

	birds = [];
	boids = [];

	for (var i = 0; i < 100; i++) {

		boid = boids[i] = new Boid();
		boid.position.x = Math.random() * 400 - 200;
		boid.position.y = Math.random() * 400 - 200;
		boid.position.z = Math.random() * 400 - 200;
		boid.velocity.x = Math.random() * 2 - 1;
		boid.velocity.y = Math.random() * 2 - 1;
		boid.velocity.z = Math.random() * 2 - 1;
		boid.setAvoidWalls(true);
		boid.setWorldSize(500, 500, 400);

		bird = birds[i] = new THREE.Mesh(new Bird(),
				new THREE.MeshBasicMaterial({
					color : Math.random() * 0xffffff,
					side : THREE.DoubleSide
				}));
		bird.phase = Math.floor(Math.random() * 62.83);
		scene.add(bird);

	}

	renderer = new THREE.CanvasRenderer();
	renderer.setClearColor(0x2b3e50, 0);
	renderer.setPixelRatio(window.devicePixelRatio);
	renderer.setSize(SCREEN_WIDTH, SCREEN_HEIGHT);

	document.addEventListener('mousemove', onDocumentMouseMove, false);
	document.body.appendChild(renderer.domElement);

	stats = new Stats();
	stats.domElement.style.position = 'absolute';
	stats.domElement.style.left = '0px';
	stats.domElement.style.top = '0px';

	document.getElementById('container').appendChild(stats.domElement);

	//

	window.addEventListener('resize', onWindowResize, false);

}

function onWindowResize() {

	camera.aspect = window.innerWidth / window.innerHeight;
	camera.updateProjectionMatrix();

	renderer.setSize(window.innerWidth, window.innerHeight);

}

function onDocumentMouseMove(event) {
	var vector = new THREE.Vector3(event.clientX - SCREEN_WIDTH_HALF,
			-event.clientY + SCREEN_HEIGHT_HALF, 0);

	for (var i = 0, il = boids.length; i < il; i++) {
		boid = boids[i];
		vector.z = boid.position.z;
		boid.repulse(vector);

	}

}

function moveAll() {

	for (var i = 0, il = boids.length; i < il; i++) {

		boid = boids[i];
		boid.randomMove();

	}

}

//

function animate() {

	requestAnimationFrame(animate);

	render();
	stats.update();

}

function render() {

	for (var i = 0, il = birds.length; i < il; i++) {

		boid = boids[i];
		boid.run(boids);

		bird = birds[i];
		bird.position.copy(boids[i].position);

		color = bird.material.color;
		color.r = color.g = color.b = (500 - bird.position.z) / 1000;

		bird.rotation.y = Math.atan2(-boid.velocity.z, boid.velocity.x);
		bird.rotation.z = Math.asin(boid.velocity.y / boid.velocity.length());

		bird.phase = (bird.phase + (Math.max(0, bird.rotation.z) + 0.1)) % 62.83;
		bird.geometry.vertices[5].y = bird.geometry.vertices[4].y = Math
				.sin(bird.phase) * 5;

	}

	renderer.render(scene, camera);

}
