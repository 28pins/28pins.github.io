"use strict";

// ---------------------------------------------------------------------------
// Deterministic pseudo‑random utilities
// ---------------------------------------------------------------------------
/** Simple string‑to‑int hash for seeding deterministic RNGs. */
function __hashString(str) {
    let h = 0;
    for (let i = 0; i < str.length; i++) {
        h = ((h << 5) - h + str.charCodeAt(i)) | 0; // keep 32‑bit signed
    }
    return h >>> 0; // unsigned
}

/** Mulberry32 based RNG returning values in [0,1). */
function __makeRng(seed) {
    let s = seed >>> 0;
    return function () {
        s = (s + 0x6d2b79f5) >>> 0;
        let t = Math.imul(s ^ (s >>> 15), 1 | s);
        t = (t ^ (t + Math.imul(t ^ (t >>> 7), t | 61))) >>> 0;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

/** Global deterministic RNG used for generic purposes (e.g., coin behavior). */
let __globalSeed = 0x12345678;
// Persistent deterministic RNG – reuse the same generator for every call.
let __rng = __makeRng(__globalSeed);
function __random() {
    return __rng();
}

// Global coin counters across all pools. The lever (dialLevel) now only
// influences the probability of exiting via an outlet; the total number of
// coins in the system is driven toward a target count (targetCoins) one per
// frame.
let totalCoins = 0;
let targetCoins = 30;
const S = 2;
const COIN_SCALE = 2;

function cubicBezier(t, firstControl, secondControl) {
    const inverseT = 1 - t;
    return 3 * inverseT * inverseT * t * firstControl
        + 3 * inverseT * t * t * secondControl
        + t * t * t;
}

class Coin {
    constructor(x, y, radius = 2 * S * COIN_SCALE) {
        this.x = x;
        this.y = y;
        this.radius = radius;
        this.velocityX = (Math.random() - 0.5) * 70;
        this.velocityY = (Math.random() - 0.5) * 70;
        this.maxVelocity = 200 + Math.random() * 75;
        this.rotation = Math.random() * Math.PI * 2;
        this.rotationSpeed = (Math.random() - 0.5) * 8;
        // Initialise acceleration timing used in update().
        this.accelerationTime = 0;
        this.accelerationDuration = 0.8;
        this.opacity = 0;
        this.removing = false;
        this.exiting = false;
        this.exitProgress = 0;
        this.exitStartX = x;
        this.exitStartY = y;
        this.exitTargetX = x;
        this.exitTargetY = y;
        this.exitStartingOpacity = 0;
        this.hasEnteredPool = false;
        this.exitPath = [];
        this.exitPathLengths = [];
        this.exitTotalLength = 0;
        this.exitDuration = 1.25;
        this.exitCallback = null;
        this.exitComplete = false;
        this.transferred = false;
    }

    update(deltaTime, bounds) {
        if (this.exiting) {
            this.exitProgress = Math.min(1, this.exitProgress + deltaTime / this.exitDuration);
            const exitCurve = cubicBezier(this.exitProgress, 0.15, 0.85);
            const distanceAlongPath = this.exitTotalLength * exitCurve;
            let remainingDistance = distanceAlongPath;
            for (let i = 0; i < this.exitPath.length - 1; i++) {
                const start = this.exitPath[i];
                const end = this.exitPath[i + 1];
                const segmentLength = this.exitPathLengths[i];
                if (remainingDistance <= segmentLength) {
                    const segmentProgress = segmentLength === 0 ? 1 : remainingDistance / segmentLength;
                    this.x = start.x + (end.x - start.x) * segmentProgress;
                    this.y = start.y + (end.y - start.y) * segmentProgress;
                    break;
                }
                remainingDistance -= segmentLength;
            }
            this.rotation += this.rotationSpeed * deltaTime;
            // Keep opacity steady during exit animation; remove fade effect.
            // const fadeProgress = Math.max(0, (this.exitProgress - 0.65) / 0.35);
            // this.opacity = this.exitStartingOpacity * (1 - fadeProgress);
            this.opacity = this.exitStartingOpacity;
            this.velocityX = __random() * 2 - 1;
            if (this.exitProgress >= 1) this.exitComplete = true;
            return;
        }

        const gravity = 360;
        const friction = Math.pow(0.12, deltaTime);
        this.accelerationTime = Math.min(this.accelerationTime + deltaTime, this.accelerationDuration);
        const accelerationProgress = this.accelerationTime / this.accelerationDuration;
        const accelerationCurve = cubicBezier(accelerationProgress, 0.15, 0.85);
        this.velocityY += gravity * accelerationCurve * deltaTime;
        this.velocityX *= friction;
        this.velocityY *= friction;
        this.rotationSpeed *= friction;
        const velocity = Math.hypot(this.velocityX, this.velocityY);
        if (velocity > this.maxVelocity) {
            const velocityScale = this.maxVelocity / velocity;
            this.velocityX *= velocityScale;
            this.velocityY *= velocityScale;
        }
        this.x += this.velocityX * deltaTime;
        this.y += this.velocityY * deltaTime;
        this.rotation += this.rotationSpeed * deltaTime;
        if (!this.hasEnteredPool && this.y + this.radius >= bounds.top) {
            this.hasEnteredPool = true;
        }

        if (this.x - this.radius < bounds.left) {
            this.x = bounds.left + this.radius;
            this.velocityX = Math.abs(this.velocityX) * 0.65;
            if (this.velocityX < 8) this.velocityX = 0;
        } else if (this.x + this.radius > bounds.right) {
            this.x = bounds.right - this.radius;
            this.velocityX = -Math.abs(this.velocityX) * 0.65;
            if (Math.abs(this.velocityX) < 8) this.velocityX = 0;
        }
        if (this.hasEnteredPool && this.y - this.radius < bounds.top && this.velocityY < 0) {
            this.y = bounds.top + this.radius;
            this.velocityY = Math.abs(this.velocityY) * 0.65;
            this.accelerationTime = 0;
            if (this.velocityY < 8) this.velocityY = 0;
        } else if (this.y + this.radius > bounds.bottom) {
            this.y = bounds.bottom - this.radius;
            this.velocityY = -Math.abs(this.velocityY) * 0.65;
            this.accelerationTime = 0;
            if (Math.abs(this.velocityY) < 8) this.velocityY = 0;
        }

        const fadeSpeed = 1 / 0.3;
        this.opacity += (this.removing ? -fadeSpeed : fadeSpeed) * deltaTime;
        this.opacity = Math.max(0, Math.min(1, this.opacity));
    }

    beginExit(path, onComplete = null) {
        this.exiting = true;
        this.removing = true;
        this.exitProgress = 0;
        this.exitComplete = false;
        this.exitPath = path;
        this.exitPathLengths = [];
        this.exitTotalLength = 0;
        for (let i = 0; i < path.length - 1; i++) {
            const segmentLength = Math.hypot(
                path[i + 1].x - path[i].x,
                path[i + 1].y - path[i].y
            );
            this.exitPathLengths.push(segmentLength);
            this.exitTotalLength += segmentLength;
        }
        this.exitDuration = Math.max(1.25, Math.min(3, this.exitTotalLength / (180 * S)));
        this.exitStartX = path[0].x;
        this.exitStartY = path[0].y;
        this.exitTargetX = path[path.length - 1].x;
        this.exitTargetY = path[path.length - 1].y;
        this.exitStartingOpacity = this.opacity;
        this.exitCallback = onComplete;
        this.velocityX = 0;
        this.velocityY = 0;
    }

    enterPool(x, y) {
        this.x = x;
        this.y = y;
        this.velocityX = 0;
        this.velocityY = 20;
        this.accelerationTime = 0;
        this.opacity = 0;
        this.removing = false;
        this.exiting = false;
        this.exitComplete = false;
        this.exitCallback = null;
        this.hasEnteredPool = false;
        this.transferred = false;
    }

    draw(ctx) {
        ctx.save();
        ctx.globalAlpha = this.opacity;
        ctx.translate(this.x, this.y);
        ctx.rotate(this.rotation);

        ctx.beginPath();
        ctx.fillStyle = 'rgb(218, 161, 0)';
        ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = 'rgb(255, 235, 70)';
        ctx.fillRect(-this.radius * 0.18, -this.radius * 0.72, this.radius * 0.36, this.radius * 1.44);
        ctx.restore();
    }
}

class Pool {
    id;
    x;
    y;
    inlets;
    inverseOutlets;
    outlets;
    name;
    color;
    dialLevel;
    leverX;
    leverY;
    targetDialLevel;
    coins;
    coinBounds;
    departureAccumulator;
    /**
     * Creates a new Pool instance.
     * @param {number} x - The x position of the pool on the canvas
     * @param {number} y - The y position of the pool on the canvas
     * @param {number} id - The unique identifier for the pool
     * @param {Array<number>} outlets - The list of outlet identifiers for the pool
     * @param {Array<number>} inverseOutlets - The list of inverse outlet identifiers for the pool
     * @param {string} name - The name of the pool
     * @param {string} color - The color of the pool in rgba format
     * @param {number} dialLevel - The level of the dial (0 to 1)
     */
    constructor(x, y, id, outlets, inverseOutlets, name, color, dialLevel = 0) {
        this.id = id;
        this.x = x;
        this.y = y;
        this.inlets = [];
        this.outlets = outlets;
        this.inverseOutlets = inverseOutlets;
        this.name = name;
        this.color = color;
        this.dialLevel = dialLevel;
        this.targetDialLevel = dialLevel;
        this.coins = [];
        this.departureAccumulator = 0;
        this.coinBounds = {
            left: this.x + 4 * S,
            right: this.x + 76 * S,
            top: this.y + 4 * S,
            bottom: this.y + 46 * S
        };
        const leverAngle = (1 - (0.6 + (0.8 * this.dialLevel))) * Math.PI;
        this.leverX = this.x + 100 * S + (35 * S * Math.cos(leverAngle));
        this.leverY = this.y + 25 * S + (35 * S * Math.sin(leverAngle));
    }
    get fillLevel() {
        return this.dialLevel;
    }
    update(deltaTime, pipeNetwork) {

        // Global coin limit applies to the whole system. Only the first pool (id===0) is allowed to spawn new coins.
        if (this.id === 0 && totalCoins < targetCoins) {
            const inletCount = Math.max(1, this.inlets.length);
            const inletIndex = this.coins.length % inletCount;
            const inletX = this.x + 15 * S + inletIndex * 20 * S;
            const coinsInInletQueue = Math.floor(this.coins.length / inletCount);
            const spawnY = this.y - 2 * S - coinsInInletQueue * 5 * S;
            const newCoin = new Coin(inletX, spawnY);
            newCoin.x += (__random() - 0.5) * 6 * S;
            newCoin.velocityX = (__random() - 0.5) * 20;
            newCoin.velocityY = 30;
            this.coins.push(newCoin);
            totalCoins++;
        } else if (totalCoins > targetCoins) {
            // If we have more coins than the global target, mark one for removal from the first pool.
            if (this.id === 0) {
                const coinToRemove = this.coins.find((c) => !c.removing && !c.transferred);
                if (coinToRemove) {
                    coinToRemove.removing = true;
                }
            }
        }

        // Count active (non‑removing, non‑transferred) coins in this pool for departure logic.
        const activeCoinCount = this.coins.filter((c) => !c.removing && !c.transferred).length;
        this.departureAccumulator += activeCoinCount * 0.005;
        const departureCount = Math.floor(this.departureAccumulator);
        this.departureAccumulator -= departureCount;
        const dispatchedCount = this.dispatchCoins(departureCount, pipeNetwork);
        this.departureAccumulator += departureCount - dispatchedCount;
        // Keep a reference to the coin list before we start processing this tick.
        const beforeCoins = this.coins.slice();

        for (const coin of this.coins) {
            coin.update(deltaTime, this.coinBounds);
        }
        for (let pass = 0; pass < 8; pass++) {
            for (let firstIndex = 0; firstIndex < this.coins.length; firstIndex++) {
                for (let secondIndex = firstIndex + 1; secondIndex < this.coins.length; secondIndex++) {
                    this.resolveCoinCollision(this.coins[firstIndex], this.coins[secondIndex]);
                }
            }
        }
        for (const coin of this.coins) {
            if (coin.exitComplete && coin.exitCallback) {
                const callback = coin.exitCallback;
                coin.exitCallback = null;
                callback(coin);
            }
        }
        // Remove coins that have finished exiting or have been transferred to another pool.
        this.coins = this.coins.filter((coin) => !coin.transferred && (coin.opacity > 0 || !coin.removing));

        // Determine which coins disappeared from the list.
        const removedCoins = beforeCoins.filter((c) => !this.coins.includes(c));
        // Decrease the global count only for coins that were genuinely removed (not transferred).
        const genuinelyRemoved = removedCoins.filter((c) => !c.transferred && c.removing);
        if (genuinelyRemoved.length > 0) {
            totalCoins = Math.max(0, totalCoins - genuinelyRemoved.length);
        }
    }
    dispatchCoins(departureCount, pipeNetwork) {
        const fillLevel = Math.max(0, Math.min(1, this.fillLevel));
        let dispatchedCount = 0;
        for (let departure = 0; departure < departureCount; departure++) {
            // Determine whether to use normal outlets (probability = fillLevel) or inverse outlets.
            let useOutlet = Math.random() < fillLevel;
            // If the chosen group has no ports, fall back to the other group.
            if (useOutlet && this.outlets.length === 0) continue; // No available ports in the chosen group.
            if (!useOutlet && this.inverseOutlets.length === 0) continue; // No available ports in the chosen group.
            const ports = useOutlet ? this.outlets : this.inverseOutlets;
            if (ports.length === 0) continue; // No available ports at all.

            // Choose a port uniformly within the selected group.
            const portIndex = Math.floor(Math.random() * ports.length);
            // Retrieve the concrete route for this selection.
            const route = pipeNetwork ? pipeNetwork.getRoute(this, portIndex, useOutlet) : null;
            if (!route) continue;
            // Compute the X coordinate based on the actual outlet index of the route.
            const targetX = useOutlet
                ? this.x + 15 * S + route.outletIndex * 20 * S
                : this.x + 85 * S - route.outletIndex * 20 * S;
            const candidates = this.coins.filter((coin) => (
                !coin.removing
                && coin.opacity > 0
                && coin.hasEnteredPool
                && coin.y >= this.coinBounds.top + coin.radius
                && coin.y <= this.coinBounds.bottom + coin.radius
            ));
            if (candidates.length === 0) break;
            const coin = candidates.reduce((nearest, candidate) => {
                const nearestDistance = Math.hypot(nearest.x - targetX, nearest.y - (this.y + 61 * S));
                const candidateDistance = Math.hypot(candidate.x - targetX, candidate.y - (this.y + 61 * S));
                return candidateDistance < nearestDistance ? candidate : nearest;
            });
            const pipePath = route ? pipeNetwork.getRoutePath(route) : null;
            const outletY = this.y + 61 * S;
            const outletX = useOutlet
                ? this.x + 15 * S + portIndex * 20 * S
                : this.x + 85 * S - portIndex * 20 * S;
            const path = pipePath
                ? [
                    { x: coin.x, y: coin.y },
                    { x: outletX, y: coin.y },
                    { x: outletX, y: outletY },
                    ...pipePath.slice(1)
                ]
                : [
                    { x: coin.x, y: coin.y },
                    { x: targetX, y: coin.y },
                    { x: targetX, y: outletY }
                ];
            // When a coin completes its exit animation, mark it as transferred before moving it.
            // The transferCoin method will reset the flag after placing the coin in the destination pool.
            const onComplete = route
                ? (completedCoin) => {
                    completedCoin.transferred = true;
                    pipeNetwork.transferCoin(completedCoin, route);
                }
                : null;
            coin.beginExit(path, onComplete);
            dispatchedCount++;
        }
        return dispatchedCount;
    }
    resolveCoinCollision(firstCoin, secondCoin) {
        // Prevent collision handling while coins are still traveling the pipe.
        // Only enforce non‑overlap once both coins have entered the pool.
        if (firstCoin.exiting || secondCoin.exiting) return;
        if (!firstCoin.hasEnteredPool || !secondCoin.hasEnteredPool) return;
        const deltaX = secondCoin.x - firstCoin.x;
        const deltaY = secondCoin.y - firstCoin.y;
        const minimumDistance = firstCoin.radius + secondCoin.radius;
        const distanceSquared = deltaX * deltaX + deltaY * deltaY;
        if (distanceSquared >= minimumDistance * minimumDistance) return;

        const distance = Math.sqrt(distanceSquared) || 0.001;
        const normalX = deltaX / distance;
        const normalY = deltaY / distance;
        const overlap = minimumDistance - distance;
        const correction = overlap / 2;
        firstCoin.x -= normalX * correction;
        firstCoin.y -= normalY * correction;
        secondCoin.x += normalX * correction;
        secondCoin.y += normalY * correction;

        // Simple bounce: exchange normal components of velocity with a damping factor.
        const damping = 0.8; // reduces energy on each collision
        const v1n = firstCoin.velocityX * normalX + firstCoin.velocityY * normalY;
        const v2n = secondCoin.velocityX * normalX + secondCoin.velocityY * normalY;
        const deltaV = (v2n - v1n) * damping;
        // Apply impulse along the normal to each coin.
        firstCoin.velocityX += deltaV * normalX;
        firstCoin.velocityY += deltaV * normalY;
        secondCoin.velocityX -= deltaV * normalX;
        secondCoin.velocityY -= deltaV * normalY;

        const relativeVelocityX = secondCoin.velocityX - firstCoin.velocityX;
        const relativeVelocityY = secondCoin.velocityY - firstCoin.velocityY;
        const separatingVelocity = relativeVelocityX * normalX + relativeVelocityY * normalY;
        if (separatingVelocity >= 0) return;

        const collisionRestitution = 0.05;
        const impulse = -separatingVelocity * (1 + collisionRestitution) / 2;
        firstCoin.velocityX -= impulse * normalX;
        firstCoin.velocityY -= impulse * normalY;
        secondCoin.velocityX += impulse * normalX;
        secondCoin.velocityY += impulse * normalY;

        const tangentX = -normalY;
        const tangentY = normalX;
        const tangentialVelocity = relativeVelocityX * tangentX + relativeVelocityY * tangentY;
        const frictionImpulse = tangentialVelocity * 0.45 / 2;
        firstCoin.velocityX += frictionImpulse * tangentX;
        firstCoin.velocityY += frictionImpulse * tangentY;
        secondCoin.velocityX -= frictionImpulse * tangentX;
        secondCoin.velocityY -= frictionImpulse * tangentY;
    }
    draw(ctx) {
        // Inlets and outlets as green pipe connectors (warp pipe style) on top and bottom of the pool
        for (let i = 0; i < this.inlets.length; i++) {
            const ix = this.x + 10 * S + (i * 20 * S);
            const iy = this.y - 11 * S;

            // 1. Draw Base Pipe (Green)
            ctx.fillStyle = 'rgba(0, 255, 0, 1)';
            ctx.fillRect(ix, iy, 10 * S, 10 * S); // Main stem
            ctx.fillRect(ix - 2 * S, iy, 14 * S, 4 * S); // Top lip

            // 2. Draw Shadow/Highlight on top (Dark Green)
            ctx.fillStyle = 'rgb(0, 0, 0)';
            ctx.fillRect(ix + 8 * S, iy + 4 * S, 1 * S, 6 * S); // Right-side shadow
            ctx.fillRect(ix + 10 * S, iy, 1 * S, 4 * S); // Right-side shadow
            ctx.fillRect(ix, iy + 4 * S, 10 * S, 0.5 * S);
        }
        for (let i = 0; i < this.inverseOutlets.length; i++) {
            const ix = this.x + 80 * S - (i * 20 * S);
            const iy = this.y + 51 * S;

            // 1. Draw Base Pipe (Green)
            ctx.fillStyle = 'rgba(0, 255, 0, 1)';
            ctx.fillRect(ix, iy, 10 * S, 10 * S); // Main stem
            ctx.fillRect(ix - 2 * S, iy + 6 * S, 14 * S, 4 * S); // Top lip

            // 2. Draw Shadow/Highlight on top (Dark Green)
            ctx.fillStyle = 'rgb(0, 0, 0)';
            ctx.fillRect(ix + 8 * S, iy, 1 * S, 6 * S); // Right-side shadow
            ctx.fillRect(ix + 10 * S, iy + 6 * S, 1 * S, 4 * S); // Right-side shadow
            ctx.fillRect(ix, iy + 5.5 * S, 10 * S, 0.5 * S);
            ctx.restore();
        }
        for (let i = 0; i < this.outlets.length; i++) {
            const ix = this.x + 10 * S + (i * 20 * S);
            const iy = this.y + 51 * S;

            // 1. Draw Base Pipe (Green)
            ctx.fillStyle = 'rgba(0, 255, 0, 1)';
            ctx.fillRect(ix, iy, 10 * S, 10 * S); // Main stem
            ctx.fillRect(ix - 2 * S, iy + 6 * S, 14 * S, 4 * S); // Top lip

            // 2. Draw Shadow/Highlight on top (Dark Green)
            ctx.fillStyle = 'rgb(0, 0, 0)';
            ctx.fillRect(ix + 8 * S, iy, 1 * S, 6 * S); // Right-side shadow
            ctx.fillRect(ix + 10 * S, iy + 6 * S, 1 * S, 4 * S); // Right-side shadow
            ctx.fillRect(ix, iy + 5.5 * S, 10 * S, 0.5 * S);
            ctx.restore();
        }
        // Lever on the side of the pool to set and show `dialLevel`
        // - Rectangle as vertical lever holder
        // - Rectangle as track
        // - Tilting rectangle as lever, tilted based on `dialLevel`
        // - Circle as knob on the end of the lever
        // - DialLevel as pct text on the lever holder
        // Smooth animation for dial level
        this.dialLevel = Math.round(this.dialLevel * 100) / 100; // Round to 2 decimal places
        this.targetDialLevel = Math.round(this.targetDialLevel * 100) / 100; // Round to 2 decimal places
        const angleDiff = this.targetDialLevel - this.dialLevel;
        this.dialLevel += angleDiff * 0.5; // Smooth transition factor
        if (this.dialLevel < 0) this.dialLevel = 0;
        if (this.dialLevel > 1) this.dialLevel = 1;
        const leverAngle = (1 - (0.6 + (0.8 * this.dialLevel))) * Math.PI;
        this.leverX = this.x + 100 * S + (35 * S * Math.cos(leverAngle));
        this.leverY = this.y + 25 * S + (35 * S * Math.sin(leverAngle));

        // ctx.beginPath();
        // ctx.fillStyle = 'rgb(70, 70, 70)';
        // ctx.fillRect(this.x + 80 * S, this.y + 25 * S, 30 * S, 26 * S);

        ctx.beginPath();
        ctx.fillStyle = 'rgba(0, 0, 0, 1)';
        ctx.arc(this.x + 100 * S, this.y + 25 * S, 10 * S, Math.PI * 1.5, Math.PI / 2);
        ctx.fill();

        ctx.beginPath();
        ctx.moveTo(this.x + 100 * S, this.y + 25 * S);
        ctx.lineTo(this.leverX, this.leverY);
        ctx.lineWidth = 4 * S;
        ctx.strokeStyle = 'rgb(125, 125, 125)';
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(this.leverX, this.leverY, 5 * S, 0, Math.PI * 2);
        ctx.fillStyle = 'rgb(80, 80, 80)';
        ctx.fill();

        ctx.beginPath();
        ctx.fillStyle = this.color;
        ctx.arc(this.x + 101 * S, this.y + 25 * S, 5 * S, Math.PI * 1.5, Math.PI / 2);
        ctx.fill();

        ctx.beginPath();
        ctx.strokeStyle = 'rgb(255, 255, 255)';
        ctx.lineWidth = S / 2;
        ctx.moveTo(this.x + 100 * S + (10 * S * Math.cos(leverAngle)), this.y + 25 * S + (10 * S * Math.sin(leverAngle)));
        ctx.lineTo(this.x + 100 * S + (5 * S * Math.cos(leverAngle)), this.y + 25 * S + (5 * S * Math.sin(leverAngle)));
        ctx.stroke();

        ctx.beginPath();
        ctx.font = `${6 * S}px 'Press Start 2P', sans-serif`;
        ctx.textAlign = 'center';
        ctx.fillText(`${Math.round(this.dialLevel * 100)}`, this.x + 110 * S, this.y + 48 * S);

        // Pool round rect, filled with inset to `fillPct` percent
        ctx.beginPath();
        ctx.lineWidth = 2 * S;
        ctx.roundRect(this.x, this.y, 100 * S, 50 * S, 12 * S);
        ctx.fillStyle = this.color;
        ctx.fill();

        ctx.save();
        ctx.beginPath();
        ctx.roundRect(this.x + 2 * S, this.y + 2 * S, 96 * S, 46 * S, 10 * S);
        ctx.clip();
        for (const coin of this.coins) {
            coin.draw(ctx);
        }
        ctx.restore();

        ctx.beginPath();
        ctx.strokeStyle = 'rgba(0, 0, 0, 1)';
        ctx.roundRect(this.x, this.y, 100 * S, 50 * S, 12 * S);
        ctx.stroke();

        // Label with name, to the right of the last inlet and above the pool
        const labelX = this.x + 10 * S + ((this.inlets.length + 1) * 30 * S);
        const labelY = this.y - 3 * S;
        ctx.beginPath();
        ctx.font = `${10 * S}px 'Press Start 2P', sans-serif`;
        ctx.textAlign = 'center';
        ctx.fillStyle = 'rgb(0, 0, 0)';
        ctx.fillText(this.name, labelX, labelY);
    }
}

class PipeNetwork {
    constructor(pools) {
        this.pools = pools;
        this.routes = [];
        this.rebuild();
    }

    rebuild() {
        this.routes = [];

        for (const pool of this.pools) {
            // Inlets are calculated from incoming routes, not configured manually.
            pool.inlets = [];
        }

        for (const pool of this.pools) {
            this.addRoutes(pool, pool.outlets, true);
            this.addRoutes(pool, pool.inverseOutlets, false);
        }

        for (let routeIndex = 0; routeIndex < this.routes.length; routeIndex++) {
            const route = this.routes[routeIndex];
            const previousPipeObstacles = this.routes
                .slice(0, routeIndex)
                .flatMap((previousRoute) => this.getPipeObstacles(previousRoute.path));
            route.path = this.calculateRoutePath(route, previousPipeObstacles);
        }
    }

    addRoutes(source, destinationIds, usesFillProbability) {
        for (let outletIndex = 0; outletIndex < destinationIds.length; outletIndex++) {
            const destination = this.pools.find((pool) => pool.id === destinationIds[outletIndex]);
            if (!destination || destination.id === source.id) continue;

            const inletIndex = destination.inlets.length;
            const route = {
                source,
                outletIndex,
                usesFillProbability,
                destination,
                inletIndex,
                routeIndex: this.routes.length
            };
            this.routes.push(route);
            destination.inlets.push(route);
        }
    }

    getRoute(sourcePool, outletIndex, usesFillProbability) {
        return this.routes.find((route) => (
            route.source.id === sourcePool.id
            && route.outletIndex === outletIndex
            && route.usesFillProbability === usesFillProbability
        ));
    }

    getObstacles(route) {
        const horizontalPadding = 1 * S;
        const verticalPadding = 1 * S;
        return this.pools
            .map((pool) => {
                const isEndpoint = pool.id === route.source.id || pool.id === route.destination.id;
                return {
                    left: pool.x - horizontalPadding,
                    right: pool.x + 100 * S + horizontalPadding,
                    top: pool.y - (isEndpoint ? 0 : verticalPadding),
                    bottom: pool.y + 50 * S + (isEndpoint ? 0 : verticalPadding)
                };
            });
    }

    segmentIsClear(start, end, obstacles) {
        const minX = Math.min(start.x, end.x);
        const maxX = Math.max(start.x, end.x);
        const minY = Math.min(start.y, end.y);
        const maxY = Math.max(start.y, end.y);

        return obstacles.every((obstacle) => {
            const horizontal = Math.abs(start.y - end.y) < 0.01;
            const vertical = Math.abs(start.x - end.x) < 0.01;
            if (horizontal) {
                return start.y <= obstacle.top || start.y >= obstacle.bottom
                    || maxX <= obstacle.left || minX >= obstacle.right;
            }
            if (vertical) {
                return start.x <= obstacle.left || start.x >= obstacle.right
                    || maxY <= obstacle.top || minY >= obstacle.bottom;
            }
            return true;
        });
    }

    pathIsClear(path, obstacles) {
        for (let index = 0; index < path.length - 1; index++) {
            if (!this.segmentIsClear(path[index], path[index + 1], obstacles)) return false;
        }
        return true;
    }

    compactPath(points) {
        return points.filter((point, index) => (
            index === 0
            || point.x !== points[index - 1].x
            || point.y !== points[index - 1].y
        ));
    }

    pathHasUTurn(path) {
        for (let index = 1; index < path.length - 1; index++) {
            const incomingX = path[index].x - path[index - 1].x;
            const incomingY = path[index].y - path[index - 1].y;
            const outgoingX = path[index + 1].x - path[index].x;
            const outgoingY = path[index + 1].y - path[index].y;
            if (incomingX * outgoingX + incomingY * outgoingY < 0) return true;
        }
        return false;
    }

    getPipeObstacles(path) {
        const horizontalPadding = 8 * S;
        const verticalPadding = 5 * S;
        const obstacles = [];
        for (let index = 0; index < path.length - 1; index++) {
            const start = path[index];
            const end = path[index + 1];
            obstacles.push({
                left: Math.min(start.x, end.x) - horizontalPadding,
                right: Math.max(start.x, end.x) + horizontalPadding,
                top: Math.min(start.y, end.y) - verticalPadding,
                bottom: Math.max(start.y, end.y) + verticalPadding
            });
        }
        return obstacles;
    }

    /** Return a cached deterministic path for the route; compute once on first call. */
    getRoutePath(route) {
        if (!route.path) {
            // Compute the deterministic best path and store it on the route object.
            route.path = this.calculateRoutePath(route, []);
        }
        return route.path;
    }

    // Helper to detect if two axis‑aligned segments (horizontal or vertical) share the same line
    // and overlap in any direction. This prevents pipes from running on top of each other.
    segmentsOverlapSameDirection(segA, segB) {
        // Use a slightly larger tolerance to account for floating‑point rounding.
        const epsilon = 1;
        // Horizontal colinear overlap
        if (Math.abs(segA.start.y - segA.end.y) < epsilon && Math.abs(segB.start.y - segB.end.y) < epsilon) {
            if (Math.abs(segA.start.y - segB.start.y) < epsilon) {
                const aMinX = Math.min(segA.start.x, segA.end.x);
                const aMaxX = Math.max(segA.start.x, segA.end.x);
                const bMinX = Math.min(segB.start.x, segB.end.x);
                const bMaxX = Math.max(segB.start.x, segB.end.x);
                return !(aMaxX <= bMinX || bMaxX <= aMinX);
            }
        }
        // Vertical colinear overlap
        if (Math.abs(segA.start.x - segA.end.x) < epsilon && Math.abs(segB.start.x - segB.end.x) < epsilon) {
            if (Math.abs(segA.start.x - segB.start.x) < epsilon) {
                const aMinY = Math.min(segA.start.y, segA.end.y);
                const aMaxY = Math.max(segA.start.y, segA.end.y);
                const bMinY = Math.min(segB.start.y, segB.end.y);
                const bMaxY = Math.max(segB.start.y, segB.end.y);
                return !(aMaxY <= bMinY || bMaxY <= aMaxY);
            }
        }
        return false;
    }

    // Determine if two axis‑aligned segments intersect at any point (including colinear overlap).
    segmentIntersects(segA, segB) {
        const eps = 0.5;
        const aHorizontal = Math.abs(segA.start.y - segA.end.y) < eps;
        const bHorizontal = Math.abs(segB.start.y - segB.end.y) < eps;
        const aVertical = Math.abs(segA.start.x - segA.end.x) < eps;
        const bVertical = Math.abs(segB.start.x - segB.end.x) < eps;

        // Colinear overlapping segments are considered intersecting.
        if (aHorizontal && bHorizontal && Math.abs(segA.start.y - segB.start.y) < eps) {
            const aMinX = Math.min(segA.start.x, segA.end.x);
            const aMaxX = Math.max(segA.start.x, segA.end.x);
            const bMinX = Math.min(segB.start.x, segB.end.x);
            const bMaxX = Math.max(segB.start.x, segB.end.x);
            return !(aMaxX <= bMinX || bMaxX <= aMinX);
        }
        if (aVertical && bVertical && Math.abs(segA.start.x - segB.start.x) < eps) {
            const aMinY = Math.min(segA.start.y, segA.end.y);
            const aMaxY = Math.max(segA.start.y, segA.end.y);
            const bMinY = Math.min(segB.start.y, segB.end.y);
            const bMaxY = Math.max(segB.start.y, segB.end.y);
            return !(aMaxY <= bMinY || bMaxY <= aMinY);
        }

        // Perpendicular crossing.
        if (aHorizontal && bVertical) {
            const hy = segA.start.y;
            const hMinX = Math.min(segA.start.x, segA.end.x);
            const hMaxX = Math.max(segA.start.x, segA.end.x);
            const vx = segB.start.x;
            const vMinY = Math.min(segB.start.y, segB.end.y);
            const vMaxY = Math.max(segB.start.y, segB.end.y);
            return (vx >= hMinX && vx <= hMaxX && hy >= vMinY && hy <= vMaxY);
        }
        if (aVertical && bHorizontal) {
            // symmetric case
            return this.segmentIntersects(segB, segA);
        }
        return false;
    }

    // Returns true if the candidate path would overlap any existing route in the same direction.
    pathOverlapsExisting(path) {
        // Build segment list for the new path.
        const newSegments = [];
        for (let i = 0; i < path.length - 1; i++) {
            newSegments.push({ start: path[i], end: path[i + 1] });
        }
        // Compare against each existing route's segments that already have a concrete path.
        for (const existing of this.routes) {
            if (!existing.path) continue; // Skip routes not yet laid out to avoid recursion.
            const existingPath = existing.path;
            let intersectCount = 0;
            for (let i = 0; i < existingPath.length - 1; i++) {
                const existingSeg = { start: existingPath[i], end: existingPath[i + 1] };
                for (const seg of newSegments) {
                    if (this.segmentIntersects(seg, existingSeg)) {
                        intersectCount++;
                        if (intersectCount >= 2) return true; // two or more intersections
                    }
                }
            }
        }
        return false;
    }

    calculateRoutePath(route, additionalObstacles) {
        const startX = route.usesFillProbability
            ? route.source.x + 15 * S + route.outletIndex * 20 * S
            : route.source.x + 85 * S - route.outletIndex * 20 * S;
        const startY = route.source.y + 61 * S;
        const endX = route.destination.x + 15 * S + route.inletIndex * 20 * S;
        const endY = route.destination.y - 1 * S;
        const outletStubY = startY + 20 * S;
        const inletStubY = endY - 20 * S;
        const middleY = (startY + endY) / 2;
        const obstacles = this.getObstacles(route).concat(additionalObstacles);
        const lanesY = [middleY, outletStubY, inletStubY];
        const lanesX = [];
        const sideClearance = 24 * S;
        const maxPoolRight = Math.max(...this.pools.map((pool) => pool.x + 100 * S));
        const maxPoolBottom = Math.max(...this.pools.map((pool) => pool.y + 50 * S));
        lanesY.push(8 * S, maxPoolBottom + 40 * S);
        lanesX.push(8 * S, maxPoolRight + 40 * S);

        for (const pool of this.pools) {
            lanesX.push(pool.x - sideClearance, pool.x + 100 * S + sideClearance);
        }
        for (const obstacle of obstacles) {
            lanesY.push(obstacle.top - 2 * S, obstacle.bottom + 2 * S);
            lanesX.push(obstacle.left - 2 * S, obstacle.right + 2 * S);
        }

        const middleCandidates = [];
        // Standard middle candidates using all computed laneY values.
        for (const laneY of lanesY) {
            middleCandidates.push(this.compactPath([
                { x: startX, y: startY },
                { x: startX, y: outletStubY },
                { x: startX, y: laneY },
                { x: endX, y: laneY },
                { x: endX, y: inletStubY },
                { x: endX, y: endY }
            ]));
        }
        // Additional middle candidates using multiples of outletStubY (1‑8).
        for (let factor = 1; factor <= 8; factor++) {
            const mulY = outletStubY * factor;
            middleCandidates.push(this.compactPath([
                { x: startX, y: startY },
                { x: startX, y: outletStubY },
                { x: startX, y: mulY },
                { x: endX, y: mulY },
                { x: endX, y: inletStubY },
                { x: endX, y: endY }
            ]));
        }
        const sideCandidates = [];
        for (const laneX of lanesX) {
            sideCandidates.push(this.compactPath([
                { x: startX, y: startY },
                { x: startX, y: outletStubY },
                { x: laneX, y: outletStubY },
                { x: laneX, y: inletStubY },
                { x: endX, y: inletStubY },
                { x: endX, y: endY }
            ]));
        }

        // ---------------------------------------------------------------------
        // Additional candidates that treat the inlet and outlet stubs as if they
        // were offset by the values -12, 24, 36, and 48 (in units of S). These
        // variations give the routing algorithm many more intermediate Y
        // positions to consider.
        // ---------------------------------------------------------------------
        const stubOffsetValues = [-12, 24, 36, 48]; // multiples of S
        const extraStubCandidates = [];
        for (const offsetMul of stubOffsetValues) {
            const offset = offsetMul * S;
            const variantOutletStubY = startY + offset; // treat outlet stub as +/- this amount
            const variantInletStubY = endY - offset; // treat inlet stub oppositely
            // Create a middle‑style candidate using this variant stub pair.
            extraStubCandidates.push(this.compactPath([
                { x: startX, y: startY },
                { x: startX, y: variantOutletStubY },
                { x: startX, y: variantInletStubY },
                { x: endX, y: variantInletStubY },
                { x: endX, y: endY }
            ]));
            // Also create a side‑style candidate using the same Y offsets.
            for (const laneX of lanesX) {
                extraStubCandidates.push(this.compactPath([
                    { x: startX, y: startY },
                    { x: startX, y: variantOutletStubY },
                    { x: laneX, y: variantOutletStubY },
                    { x: laneX, y: variantInletStubY },
                    { x: endX, y: variantInletStubY },
                    { x: endX, y: endY }
                ]));
            }
        }
        // Generate a richer set of deterministic candidates that avoid going all the way to the bottom.
        const deterministicCandidates = [];
        // Create a series of Y‑offsets ranging from well above the bottom to slightly below it.
        const detYOffsets = [];
        // Above‑bottom offsets (step 5 S).
        for (let i = 4; i >= 0; i--) {
            detYOffsets.push(maxPoolBottom - i * 5 * S);
        }
        // Original bottom and a few below‑bottom offsets.
        detYOffsets.push(maxPoolBottom);
        detYOffsets.push(maxPoolBottom + 5 * S);
        detYOffsets.push(maxPoolBottom + 10 * S);
        detYOffsets.push(maxPoolBottom + 20 * S);

        // Additional candidates using multiples of the outlet stub Y position (1×‑8×).
        for (let factor = 1; factor <= 8; factor++) {
            const mulY = outletStubY * factor;
            detYOffsets.push(mulY);
        }

        // For each Y offset, also vary the intermediate X position using a subset of lanesX.
        const sampleX = lanesX.slice(0, Math.min(lanesX.length, 5)); // take up to 5 X lanes for variety
        for (const offsetY of detYOffsets) {
            for (const midX of sampleX) {
                deterministicCandidates.push(this.compactPath([
                    { x: startX, y: startY },
                    { x: startX, y: outletStubY },
                    { x: startX, y: offsetY },
                    { x: midX, y: offsetY },
                    { x: midX, y: inletStubY },
                    { x: endX, y: inletStubY },
                    { x: endX, y: endY }
                ]));
            }
        }

        // ---------------------------------------------------------------------
        // Fractional‑vertical candidates (single definition).
        // Paths descend a fraction (1/4, 1/2, 3/4) of the total vertical
        // distance, move horizontally across, then finish the remaining
        // vertical distance.
        // ---------------------------------------------------------------------
        const fractionCandidates = [];
        const verticalDiff = endY - startY;
        const fractionValues = [0.25, 0.5, 0.75];
        for (const f of fractionValues) {
            const midY = startY + verticalDiff * f;
            fractionCandidates.push(this.compactPath([
                { x: startX, y: startY },
                { x: startX, y: midY },
                { x: endX, y: midY },
                { x: endX, y: endY }
            ]));
        }


        // Validate paths: must be clear, not overlapping existing routes, and have no U‑turns.
        const pathScore = (path) => {
            return 1 + (this.pathIsClear(path, obstacles) ? -2 : 1) + (this.pathOverlapsExisting(path) ? -4 : 1) + (this.pathHasUTurn(path) ? -1 : 1);
        };

        // Direct L‑shaped path.
        const directPath = this.compactPath([
            { x: startX, y: startY },
            { x: startX, y: outletStubY },
            { x: endX, y: outletStubY },
            { x: endX, y: inletStubY },
            { x: endX, y: endY }
        ]);

        // Gather all candidates: direct, side, middle, and deterministic variants.
        const allCandidates = [directPath, ...sideCandidates, ...middleCandidates, ...deterministicCandidates, ...fractionCandidates, ...extraStubCandidates];
        const validPaths = allCandidates.filter((path) => pathScore(path) > 0);
        if (validPaths.length > 0) {
            // Score each path: higher score for fewer points (simpler routes).
            const scored = validPaths.map(p => ({ path: p, score: -p.length }));
            const maxScore = Math.max(...scored.map(s => s.score));
            const topScored = scored.filter(s => s.score === maxScore).map(s => s.path);
            if (topScored && topScored.length > 0 && topScored[0].score > 0) {
                // Among the top‑scored paths, select the shortest by geometric length.
                return topScored.reduce((shortest, path) => {
                    const pathLength = path.reduce((total, pt, i) => (
                        i === 0 ? total : total + Math.hypot(pt.x - path[i - 1].x, pt.y - path[i - 1].y)
                    ), 0);
                    const shortestLength = shortest.reduce((total, pt, i) => (
                        i === 0 ? total : total + Math.hypot(pt.x - shortest[i - 1].x, pt.y - shortest[i - 1].y)
                    ), 0);
                    return pathLength < shortestLength ? path : shortest;
                });
            }
        }

        // No valid pre‑generated candidates – try a few deterministic, orthogonal random paths.
        const randomCandidates = [];
        const maxRandom = 5;
        // Deterministic RNG seeded by source/destination identifiers ensures repeatability.
        const routeSeed = __hashString(route.source.name + ':' + route.destination.name + ':' + __globalSeed);
        const rng = __makeRng(routeSeed);
        // Define horizontal bounds for random X positions (Y will be aligned to start/end rows).
        const minX = 0;
        const maxX = maxPoolRight + 40 * S;
        for (let i = 0; i < maxRandom; i++) {
            const randX = rng() * (maxX - minX) + minX;
            // Path respects stub length 12*S from outlet and inlet:
            // start -> outlet stub -> horizontal to randX -> vertical to inlet stub -> horizontal to end -> end stub.
            const randPath = this.compactPath([
                { x: startX, y: startY },               // start
                { x: startX, y: outletStubY },        // down stub (12*S)
                { x: randX, y: outletStubY },         // horizontal across
                { x: randX, y: inletStubY },          // vertical down to inlet level
                { x: endX, y: inletStubY },          // horizontal to end column
                { x: endX, y: endY }                 // final stub to end
            ]);
            randomCandidates.push(randPath);
        }
        const randomValid = randomCandidates.filter((path) => pathScore(path) > 0);
        if (randomValid.length > 0) {
            // Apply same scoring/shortest logic to random valid paths.
            const scoredRand = randomValid.map(p => ({ path: p, score: -p.length }));
            const maxScoreRand = Math.max(...scoredRand.map(s => s.score));
            const topRand = scoredRand.filter(s => s.score === maxScoreRand).map(s => s.path);
            return topRand.reduce((shortest, path) => {
                const pathLength = path.reduce((total, pt, i) => (
                    i === 0 ? total : total + Math.hypot(pt.x - path[i - 1].x, pt.y - path[i - 1].y)
                ), 0);
                const shortestLength = shortest.reduce((total, pt, i) => (
                    i === 0 ? total : total + Math.hypot(pt.x - shortest[i - 1].x, pt.y - shortest[i - 1].y)
                ), 0);
                return pathLength < shortestLength ? path : shortest;
            });
        }

        // As a final safety net, fall back to the original deterministic path.
        return this.compactPath([
            { x: startX, y: startY },
            { x: startX, y: outletStubY },
            { x: startX, y: maxPoolBottom + 40 * S },
            { x: maxPoolRight + 40 * S, y: maxPoolBottom + 40 * S },
            { x: maxPoolRight + 40 * S, y: inletStubY },
            { x: endX, y: inletStubY },
            { x: endX, y: endY }
        ]);
    }

    /** Move a coin from its source pool to the destination pool.
     *  The source pool is identified via the route object.
     */
    transferCoin(coin, route) {
        // Determine the inlet position in the destination pool.
        const inletX = route.destination.x + 15 * S + route.inletIndex * 20 * S;
        const queueSize = route.destination.coins.filter((c) => !c.hasEnteredPool).length;
        // Place the coin at the destination inlet without resetting its visual state.
        const destY = route.destination.y - 2 * S - queueSize * 5 * S;
        coin.x = inletX;
        coin.y = destY;
        // Preserve existing opacity and clear removal flags so the coin continues smoothly.
        coin.removing = false;
        coin.exiting = false;
        coin.exitComplete = false;
        coin.exitCallback = null;
        // Preserve full visibility after transfer.
        coin.opacity = 1;
        // Add to destination pool.
        route.destination.coins.push(coin);
        // Remove from source pool to prevent duplication.
        if (route.source && Array.isArray(route.source.coins)) {
            route.source.coins = route.source.coins.filter((c) => c !== coin);
        }
        // Reset transferred flag.
        coin.transferred = false;
    }

    draw(ctx) {
        for (const route of this.routes) {
            const path = this.getRoutePath(route);

            ctx.beginPath();
            ctx.moveTo(path[0].x, path[0].y);
            for (let pointIndex = 1; pointIndex < path.length; pointIndex++) {
                ctx.lineTo(path[pointIndex].x, path[pointIndex].y);
            }
            ctx.strokeStyle = 'rgb(0, 50, 0)';
            ctx.lineWidth = 9 * S;
            ctx.stroke();

            ctx.beginPath();
            ctx.moveTo(path[0].x, path[0].y);
            for (let pointIndex = 1; pointIndex < path.length; pointIndex++) {
                ctx.lineTo(path[pointIndex].x, path[pointIndex].y);
            }
            ctx.strokeStyle = 'rgb(0, 255, 0)';
            ctx.lineWidth = 8 * S;
            ctx.stroke();

        }
    }

    drawOpeningEdges(ctx) {
        ctx.strokeStyle = 'rgb(0, 0, 0)';
        ctx.lineWidth = 1 * S;
        const pipeRadius = 4 * S;

        for (const route of this.routes) {
            const path = this.getRoutePath(route);
            const openings = [
                [path[0], path[1]],
                [path[path.length - 1], path[path.length - 2]]
            ];

            for (const [opening, nextPoint] of openings) {
                const directionX = nextPoint.x - opening.x;
                const directionY = nextPoint.y - opening.y;
                const length = Math.hypot(directionX, directionY) || 1;
                const normalX = -directionY / length;
                const normalY = directionX / length;

                ctx.beginPath();
                ctx.moveTo(
                    opening.x - normalX * pipeRadius,
                    opening.y - normalY * pipeRadius
                );
                ctx.lineTo(
                    opening.x + normalX * pipeRadius,
                    opening.y + normalY * pipeRadius
                );
                ctx.stroke();
            }
        }
    }

    drawTravelingCoins(ctx) {
        for (const pool of this.pools) {
            for (const coin of pool.coins) {
                if (coin.exiting && !coin.transferred) coin.draw(ctx);
            }
        }
    }
}

const pools = [new Pool(250, 250, 0, [1], [1, 1], 'Test Pool', 'rgba(200, 0, 0)', 0.5),
new Pool(450, 750, 1, [0], [], 'Second Pooll', 'rgba(0, 0, 200)', 0.25)];
// The following UI code only runs in a browser environment.
if (typeof document !== 'undefined') {
    const pipeNetwork = new PipeNetwork(pools);
    const canvas = document.getElementById('c');
    const ctx = canvas.getContext('2d');

    setInterval(() => {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        pipeNetwork.rebuild();
        pipeNetwork.draw(ctx);
        pipeNetwork.drawTravelingCoins(ctx);
        for (const pool of pools) {
            pool.update(1 / 24, pipeNetwork);
            pool.draw(ctx);
        }
        pipeNetwork.drawOpeningEdges(ctx);
    }, 1000 / 24);

    canvas.addEventListener("mousedown", function (event) {
        // If mouse is over a pool's lever, start dragging the lever
        for (const pool of pools) {
            const leverAngle = (1 - (0.6 + (0.8 * pool.dialLevel))) * Math.PI;
            const leverX = pool.x + 100 * S + (35 * S * Math.cos(leverAngle));
            const leverY = pool.y + 25 * S + (35 * S * Math.sin(leverAngle));
            const dx = event.offsetX - leverX;
            const dy = event.offsetY - leverY;
            if (Math.sqrt(dx * dx + dy * dy) < 10 * S) {
                // Start dragging this lever
                canvas.addEventListener("mousemove", onMouseMove);
                canvas.addEventListener("mouseup", onMouseUp);
                function onMouseMove(event) {
                    if (event.buttons === 0) {
                        onMouseUp();
                        return;
                    }
                    const yTL = 1 - ((event.offsetY - (pool.y + 25 * S)) / (35 * S));
                    const xTL = 1 - ((event.offsetX - (pool.x + 100 * S)) / (35 * S));
                    pool.targetDialLevel = (yTL);
                    if (pool.targetDialLevel < 0) pool.targetDialLevel = 0;
                    if (pool.targetDialLevel > 1) pool.targetDialLevel = 1;
                    pool.targetDialLevel = Math.round(pool.targetDialLevel * 100) / 100; // Round to 2 decimal places
                }
                function onMouseUp() {
                    canvas.removeEventListener("mousemove", onMouseMove);
                    canvas.removeEventListener("mouseup", onMouseUp);
                    console.log(`Final targetDialLevel for pool ${pool.id}: ${pool.targetDialLevel}`);
                }
                break;
            }
        }
    });
}