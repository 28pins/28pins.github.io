class Pool {
    id: number;
    x: number;
    y: number;
    inlets: number[];
    outlets: number[];
    name: string;
    color: string;
    fillPct: number;
    dialLevel: number;

    constructor(x: number, y: number, id: number, inlets: number[], outlets: number[], name: string, color: string, fillPct: number = 0, dialLevel: number = 0) {
        this.id = id;
        this.x = x;
        this.y = y;
        this.inlets = inlets;
        this.outlets = outlets;
        this.name = name;
        this.color = color;
        this.fillPct = fillPct;
        this.dialLevel = dialLevel;
    }

    draw(ctx: CanvasRenderingContext2D) {
        // Pool round rect, filled with inset to `fillPct` percent
        ctx.fillStyle = this.color;
        ctx.roundRect(this.x, this.y, 100, 50, 10);
        ctx.fill();
        ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        ctx.fillRect(this.x + 5, this.y + (50 * (1 - this.fillPct)) + 5, 90, (50 * this.fillPct) - 10);
        // Label of name
        ctx.fillStyle = 'rgba(0, 0, 0, 1)';
        ctx.font = '12px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(this.name, this.x + 50, this.y + 25);
        // Lever on the side of the pool to set and show `dialLevel`
        // - Rectangle as vertical lever holder
        // - Rectangle as track
        // - Tilting rectangle as lever, tilted based on `dialLevel`
        // - Circle as knob on the end of the lever
        // - DialLevel as pct text on the lever holder
        ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        ctx.fillRect(this.x + 110, this.y + 5, 10, 40);
        ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
        ctx.fillRect(this.x + 115, this.y + 10, 5, 30);
        ctx.save();
        ctx.translate(this.x + 117.5, this.y + 25);
        ctx.rotate((this.dialLevel - 0.5) * Math.PI / 2);
        ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        ctx.fillRect(-2.5, -15, 5, 30);
        ctx.beginPath();
        ctx.arc(0, -15, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
        ctx.fillStyle = 'rgba(0, 0, 0, 1)';
        ctx.font = '12px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(`${Math.round(this.dialLevel * 100)}%`, this.x + 115, this.y + 50);
        // Inlets and outlets as green pipe connectors (warp pipe style) on top and bottom of the pool
        ctx.fillStyle = 'rgba(0, 255, 0, 1)';
        for (let i = 0; i < this.inlets.length; i++) {
            ctx.beginPath();
            ctx.arc(this.x + 10 + (i * 20), this.y, 5, 0, Math.PI * 2);
            ctx.fill();
        }
        for (let i = 0; i < this.outlets.length; i++) {
            ctx.beginPath();
            ctx.arc(this.x + 10 + (i * 20), this.y + 50, 5, 0, Math.PI * 2);
            ctx.fill();
        }
    }
}

const test = new Pool(50, 50, 0, [1, 2], [3, 4], 'Test Pool', 'rgba(0, 0, 255, 0.5)', 0.5, 0.75);
const canvas = document.getElementById('c') as HTMLCanvasElement;
const ctx = canvas.getContext('2d')!;
test.draw(ctx);