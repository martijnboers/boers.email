var NUM_PARTICLES = ( ( ROWS = 105 ) * ( COLS = 250 ) ),
    THICKNESS = Math.pow( 115, 1.75 ),
    SPACING = 5,
    MARGIN = 30,
    COLOR = 180,
    DRAG = 0.95,
    EASE = 0.25,

    container,
    continueLoop,
    particle,
    canvas,
    list,
    ctx,
    tog,
    man,
    dx, dy,
    mx, my,
    d, t, f,
    a, b,
    i, n,
    w, h,
    p, s,
    r, c
;

particle = {
    vx: 0,
    vy: 0,
    x: 0,
    y: 0
};

function init() {

    container = document.getElementById( 'container' );
    canvas = document.createElement( 'canvas' );

    ctx = canvas.getContext( '2d' );
    man = false;
    tog = true;

    list = [];

    w = canvas.width = COLS * SPACING + MARGIN * 2;
    h = canvas.height = ROWS * SPACING + MARGIN * 2;

    container.style.width = w + "px";
    container.style.height = h + "px";

    for ( i = 0; i < NUM_PARTICLES; i++ ) {

        p = Object.create( particle );
        p.x = p.ox = MARGIN + SPACING * ( i % COLS );
        p.y = p.oy = MARGIN + SPACING * Math.floor( i / COLS );

        list[i] = p;
    }

    container.addEventListener( 'mousemove', function(e) {
        clearInterval(continueLoop)

        bounds = container.getBoundingClientRect();
        mx = e.clientX - bounds.left;
        my = e.clientY - bounds.top;
        man = true;

        continueLoop = setInterval(function() {
            man = false;
        }, 2000);

    });

    container.appendChild( canvas );
}

function step() {

    if ( tog = !tog ) {

        if ( !man ) {

            t = +new Date() * 0.001;
            mx = w * 0.5 + ( Math.cos( t * 1.4 ) * Math.cos( t * 0.9 ) * w * 0.45 );
            my = h * 0.5 + ( Math.sin( t * 2.5 ) * Math.tan( Math.sin( t * 0.8 ) ) * h * 0.45 );
        }

        for ( i = 0; i < NUM_PARTICLES; i++ ) {

            p = list[i];

            d = ( dx = mx - p.x ) * dx + ( dy = my - p.y ) * dy;
            f = -THICKNESS / d;

            if ( d < THICKNESS ) {
                t = Math.atan2( dy, dx );
                p.vx += f * Math.cos(t);
                p.vy += f * Math.sin(t);
            }

            p.x += ( p.vx *= DRAG ) + (p.ox - p.x) * EASE;
            p.y += ( p.vy *= DRAG ) + (p.oy - p.y) * EASE;

        }

    } else {

        b = ( a = ctx.createImageData( w, h ) ).data;

        for ( i = 0; i < NUM_PARTICLES; i++ ) {

            p = list[i];
            b[n = ( ~~p.x + ( ~~p.y * w ) ) * 4] = b[n+1] = b[n+2] = COLOR, b[n+3] = 255;
        }

        ctx.putImageData( a, 0, 0 );
    }

    requestAnimationFrame( step );
}

init();
step();
