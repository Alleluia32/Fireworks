// Shim for requestAnimationFrame - Improved compatibility
window.requestAnimFrame = (function() {
    return window.requestAnimationFrame ||
           window.webkitRequestAnimationFrame ||
           window.mozRequestAnimationFrame ||
           function(callback) {
               window.setTimeout(callback, 1000 / 60);
           };
})();

var canvas = document.getElementById('canvas'),
    ctx = canvas.getContext('2d'),
    cw = window.innerWidth,
    ch = window.innerHeight,
    launchers = [],
    particles = [],
    hue = 0,
    // Tăng tốc độ bắn pháo tự động và giới hạn click để có nhiều pháo hơn
    limiterTotal = 3, // Bắn được nhiều pháo hơn khi click nhanh
    limiterTick = 0,
    timerTotal = 40, // Tăng tần suất tự động bắn pháo (thay vì 60)
    timerTick = 0,
    mousedown = false,
    mx, my;

canvas.width = cw;
canvas.height = ch;

window.addEventListener('resize', function() {
    cw = window.innerWidth;
    ch = window.innerHeight;
    canvas.width = cw;
    canvas.height = ch;
});

function random(min, max) {
    return Math.random() * (max - min) + min;
}

function calculateDistance(p1x, p1y, p2x, p2y) {
    var xDistance = p1x - p2x,
        yDistance = p1y - p2y;
    return Math.sqrt(Math.pow(xDistance, 2) + Math.pow(yDistance, 2));
}

// --- Launcher Class (Pháo hoa bay lên) ---
function Launcher(sx, sy, tx, ty) {
    this.x = sx;
    this.y = sy;
    this.sx = sx;
    this.sy = sy;
    this.tx = tx;
    this.ty = ty;

    this.distanceToTarget = calculateDistance(sx, sy, tx, ty);
    this.distanceTraveled = 0;

    this.coordinates = [];
    this.coordinateCount = 3;
    while (this.coordinateCount--) {
        this.coordinates.push([this.x, this.y]);
    }

    this.angle = Math.atan2(ty - sy, tx - sx);
    this.speed = random(2, 4); // Tăng tốc độ bay lên ban đầu
    this.acceleration = 1.05;
    this.brightness = random(60, 80); // Sáng hơn một chút
    this.alpha = 1;
    this.decay = 0.02;
}

Launcher.prototype.update = function(index) {
    this.coordinates.pop();
    this.coordinates.unshift([this.x, this.y]);

    this.speed *= this.acceleration;
    var vx = Math.cos(this.angle) * this.speed,
        vy = Math.sin(this.angle) * this.speed;

    this.distanceTraveled = calculateDistance(this.sx, this.sy, this.x + vx, this.y + vy);

    if (this.distanceTraveled >= this.distanceToTarget) {
        createExplosion(this.tx, this.ty);
        launchers.splice(index, 1);
    } else {
        this.x += vx;
        this.y += vy;
        this.alpha -= this.decay;
        if (this.alpha < 0) this.alpha = 0;
    }
};

Launcher.prototype.draw = function() {
    ctx.beginPath();
    ctx.moveTo(this.coordinates[this.coordinates.length - 1][0], this.coordinates[this.coordinates.length - 1][1]);
    ctx.lineTo(this.x, this.y);
    ctx.strokeStyle = 'hsla(' + hue + ', 100%, ' + this.brightness + '%, ' + this.alpha + ')';
    ctx.stroke();
};

// --- Particle Class (Hạt pháo sau khi nổ) ---
function Particle(x, y, particleType = 'normal', parentHue = hue) { // Thêm parentHue để màu hạt gần với màu pháo ban đầu
    this.x = x;
    this.y = y;
    this.coordinates = [];
    this.coordinateCount = 5;
    while (this.coordinateCount--) {
        this.coordinates.push([this.x, this.y]);
    }

    this.angle = random(0, Math.PI * 2);
    this.speed = random(2, 10); // Tăng tốc độ tối đa của hạt để bay xa hơn
    this.friction = 0.93; // Giảm ma sát một chút để hạt bay xa hơn
    this.gravity = 0.7; // Giảm trọng lực để hạt không rơi quá nhanh
    
    // Tạo dải màu cực rộng hơn cho mỗi vụ nổ, dựa trên parentHue
    this.hue = random(parentHue - 70, parentHue + 70);
    this.brightness = random(60, 95); // Tăng độ sáng lên rất cao
    this.alpha = 1;
    this.decay = random(0.01, 0.02); // Điều chỉnh tốc độ mờ của hạt

    // Điều chỉnh thuộc tính dựa trên loại hạt
    if (particleType === 'sparkle') {
        this.speed = random(0.8, 4); // Tốc độ nhanh hơn cho sparkle
        this.gravity = 0.2;
        this.decay = random(0.005, 0.015); // Sparkle mờ chậm hơn nhiều, kéo dài ánh sáng
        this.brightness = random(80, 100); // Sparkle sáng chói hơn
        this.coordinateCount = 3;
    }
    if (particleType === 'fizz') { // Loại hạt mới: fizz, tạo cảm giác hơi khói
        this.speed = random(0.1, 1);
        this.gravity = 0.05;
        this.decay = random(0.03, 0.05); // Fizz mờ nhanh hơn
        this.brightness = random(30, 50); // Mờ hơn, tạo hiệu ứng khói
        this.coordinateCount = 1;
    }
    if (particleType === 'trail_fire') { // Loại hạt mới: tạo vệt lửa nhỏ
        this.speed = random(1.5, 6);
        this.gravity = 0.5;
        this.decay = random(0.01, 0.02);
        this.brightness = random(70, 100);
        this.coordinateCount = 8; // Đuôi dài hơn
    }
}

Particle.prototype.update = function(index) {
    this.coordinates.pop();
    this.coordinates.unshift([this.x, this.y]);
    this.speed *= this.friction;
    this.x += Math.cos(this.angle) * this.speed;
    this.y += Math.sin(this.angle) * this.speed + this.gravity;
    this.alpha -= this.decay;

    if (this.alpha <= this.decay) {
        particles.splice(index, 1);
    }
};

Particle.prototype.draw = function() {
    ctx.beginPath();
    // Vẽ đuôi hạt (line)
    ctx.moveTo(this.coordinates[this.coordinates.length - 1][0], this.coordinates[this.coordinates.length - 1][1]);
    ctx.lineTo(this.x, this.y);
    ctx.strokeStyle = 'hsla(' + this.hue + ', 100%, ' + this.brightness + '%, ' + this.alpha + ')';
    ctx.stroke();

    // Vẽ hạt chính (arc/circle)
    ctx.beginPath();
    ctx.arc(this.x, this.y, 2, 0, Math.PI * 2); // Tăng kích thước hạt lên 2 (thay vì 1.5)
    ctx.fillStyle = 'hsla(' + this.hue + ', 100%, ' + this.brightness + '%, ' + this.alpha + ')';
    ctx.fill();
};

// --- Create Explosion Logic ---
function createExplosion(x, y) {
    var numParticles = random(150, 300); // Tăng số lượng hạt lên RẤT NHIỀU
    var explosionType = Math.random(); 

    if (explosionType < 0.4) { // Nổ thông thường, cực kỳ nhiều hạt
        for (let i = 0; i < numParticles; i++) {
            particles.push(new Particle(x, y, 'normal', hue));
        }
    } else if (explosionType < 0.7) { // Nổ kết hợp sparkle và normal
        var sparkleCount = random(50, 150);
        var normalCount = numParticles - sparkleCount;
        for (let i = 0; i < normalCount; i++) {
            particles.push(new Particle(x, y, 'normal', hue));
        }
        for (let i = 0; i < sparkleCount; i++) {
            particles.push(new Particle(x, y, 'sparkle', hue));
        }
    } else if (explosionType < 0.9) { // Nổ lớn với các chấm nhỏ fizz và trail_fire
        var fizzCount = random(20, 50);
        var trailFireCount = random(30, 80);
        var normalCount = numParticles - fizzCount - trailFireCount;

        for (let i = 0; i < normalCount; i++) {
            particles.push(new Particle(x, y, 'normal', hue));
        }
        for (let i = 0; i < fizzCount; i++) {
            particles.push(new Particle(x, y, 'fizz', hue));
        }
        for (let i = 0; i < trailFireCount; i++) {
            particles.push(new Particle(x, y, 'trail_fire', hue));
        }
    } else { // Nổ siêu rực rỡ (tất cả các loại)
        var sparkleCount = random(80, 200);
        var fizzCount = random(30, 80);
        var trailFireCount = random(40, 100);
        var normalCount = numParticles - sparkleCount - fizzCount - trailFireCount;
        if (normalCount < 0) normalCount = 0; // Đảm bảo không âm

        for (let i = 0; i < normalCount; i++) {
            particles.push(new Particle(x, y, 'normal', hue));
        }
        for (let i = 0; i < sparkleCount; i++) {
            particles.push(new Particle(x, y, 'sparkle', hue));
        }
        for (let i = 0; i < fizzCount; i++) {
            particles.push(new Particle(x, y, 'fizz', hue));
        }
        for (let i = 0; i < trailFireCount; i++) {
            particles.push(new Particle(x, y, 'trail_fire', hue));
        }
    }
}


// --- Main animation loop ---
function loop() {
    requestAnimFrame(loop);

    hue += 1.5; // Tăng tốc độ thay đổi màu sắc nhanh hơn nữa
    if (hue >= 360) hue = 0;

    // Clear canvas with trailing effect
    ctx.globalCompositeOperation = 'destination-out';
    ctx.fillStyle = 'rgba(0, 0, 0, 0.04)'; // Giảm alpha xuống 0.04 để đuôi dài hơn và mượt hơn
    ctx.fillRect(0, 0, cw, ch);
    ctx.globalCompositeOperation = 'lighter'; // Giúp màu sắc chồng lên nhau và sáng hơn

    // Update and draw launchers
    for (var i = launchers.length - 1; i >= 0; i--) {
        launchers[i].draw();
        launchers[i].update(i);
    }
    
    // Update and draw particles
    for (var i = particles.length - 1; i >= 0; i--) {
        particles[i].draw();
        particles[i].update(i);
    }

    // Auto-launch fireworks when mouse is not pressed
    if (timerTick >= timerTotal) {
        if (!mousedown) {
            launchers.push(new Launcher(cw / 2, ch, random(0, cw), random(ch * 0.1, ch / 2))); // Bắn lên cao hơn một chút
            timerTick = 0;
        }
    } else {
        timerTick++;
    }

    // Launch fireworks on mouse click, with a limiter
    if (limiterTick >= limiterTotal) {
        if (mousedown) {
            launchers.push(new Launcher(cw / 2, ch, mx, my));
            limiterTick = 0;
        }
    } else {
        limiterTick++;
    }
}

// Mouse event bindings
canvas.addEventListener('mousemove', function(e) {
    mx = e.pageX - canvas.offsetLeft;
    my = e.pageY - canvas.offsetTop;
});

canvas.addEventListener('mousedown', function(e) {
    e.preventDefault();
    mousedown = true;
});

canvas.addEventListener('mouseup', function(e) {
    e.preventDefault();
    mousedown = false;
});

window.onload = loop;