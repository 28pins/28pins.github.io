"use strict";
const S = 5;

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
    /**
     * Creates a new Pool instance.
     * @param {number} x - The x position of the pool on the canvas
     * @param {number} y - The y position of the pool on the canvas
     * @param {number} id - The unique identifier for the pool
     * @param {Array<number>} inlets - The list of inlet identifiers for the pool
     * @param {Array<number>} outlets - The list of outlet identifiers for the pool
     * @param {Array<number>} inverseOutlets - The list of inverse outlet identifiers for the pool
     * @param {string} name - The name of the pool
     * @param {string} color - The color of the pool in rgba format
     * @param {number} dialLevel - The level of the dial (0 to 1)
     */
    constructor(x, y, id, inlets, outlets, inverseOutlets, name, color, dialLevel = 0) {
        this.id = id;
        this.x = x;
        this.y = y;
        this.inlets = inlets;
        this.outlets = outlets;
        this.inverseOutlets = inverseOutlets;
        this.name = name;
        this.color = color;
        this.dialLevel = dialLevel;
        this.targetDialLevel = dialLevel;
        const leverAngle = (1 - (0.6 + (0.8 * this.dialLevel))) * Math.PI;
        this.leverX = this.x + 100 * S + (35 * S * Math.cos(leverAngle));
        this.leverY = this.y + 25 * S + (35 * S * Math.sin(leverAngle));
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
            ctx.fillStyle = 'rgb(0, 50, 0)';
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
            ctx.fillStyle = 'rgb(0, 50, 0)';
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
            ctx.fillStyle = 'rgb(0, 50, 0)';
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

        ctx.beginPath();
        ctx.fillStyle = 'rgb(70, 70, 70)';
        ctx.fillRect(this.x + 80 * S, this.y + 25 * S, 30 * S, 26 * S);

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
        ctx.font = `${6 * S}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.fillText(`${Math.round(this.dialLevel * 100)}`, this.x + 105 * S, this.y + 48 * S);

        // Pool round rect, filled with inset to `fillPct` percent
        ctx.beginPath();
        ctx.lineWidth = 2 * S;
        ctx.strokeStyle = 'rgba(0, 0, 0, 1)';
        ctx.roundRect(this.x, this.y, 100 * S, 50 * S, 12 * S);
        ctx.stroke();
        ctx.fillStyle = this.color;
        ctx.fill();

        // // Inset fill to `fillPct` percent
        // ctx.fillStyle = 'rgb(0, 255, 255)';
        // ctx.roundRect(this.x + 3 * S, this.y + (50 * S * (1 - this.fillPct)) - 3 * S, 94 * S, (5 * S * this.fillPct) - 6 * S, 6 * S);
        // ctx.fill();

        // // Label of name
        // ctx.fillStyle = 'rgba(0, 0, 0, 1)';
        // ctx.font = `${12 * S}px sans-serif`;
        // ctx.textAlign = 'center';
        // ctx.fillText(this.name, this.x + 50 * S, this.y + 25 * S);

    }
}
const pools = [new Pool(50, 50, 0, [1, 2], [3, 4], [5, 6], 'Test Pool', 'rgba(200, 0, 0)', 0.5, 0.75)];
const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');

setInterval(() => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (const pool of pools) {
        pool.draw(ctx);
    }
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
                pool.targetDialLevel = (yTL)// + pool.targetDialLevel > 50 ? (0.3 * xTL) : (-0.3 * xTL);
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